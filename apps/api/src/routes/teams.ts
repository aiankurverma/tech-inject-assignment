import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import type { Types } from "mongoose";
import { z } from "zod";
import { canInviteRole, roleRank, slugSchema, type TeamRole, type ThemeFiles } from "@ti/core";
import type { Env } from "../config/env";
import {
  sha256,
  usesBearer,
  type Auth,
  type Principal,
  type TeamContext,
} from "../middleware/auth";
import { previewPayload } from "../services/catalog";
import { makeTeamCatalog, teamSummary } from "../services/teamCatalog";
import { TEAM_LIMITS, teamScope } from "../services/teamRepo";
import { HttpError, parseBody, teamErrors } from "../utils/http";
import { log } from "../utils/logger";
import {
  ApiToken,
  Customer,
  Team,
  TeamInvite,
  TeamMember,
  TeamRemoval,
  type CustomerDoc,
  type TeamDoc,
  type TeamInviteDoc,
  type TeamMemberDoc,
} from "../models";
import { sendText, sendThumbnail, type RouteDeps } from "./index";

/** Invites (both kinds) expire after 7 days. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;
const OBJECT_ID = /^[a-f0-9]{24}$/;
const JOB_ID = /^[\w-]{1,64}$/;

const teamParam = (req: Request) => {
  const parsed = slugSchema.safeParse(req.params.team);
  if (!parsed.success) throw teamErrors.notFound();
  return parsed.data;
};
const slugParam = (req: Request) => {
  const parsed = slugSchema.safeParse(req.params.slug);
  if (!parsed.success) throw teamErrors.notFound();
  return parsed.data;
};
const idParam = (value: unknown, re = OBJECT_ID) => {
  if (typeof value !== "string" || !re.test(value)) throw teamErrors.notFound();
  return value;
};

/** Link invite token: 32 random bytes, only its sha256 is stored. */
function newInviteToken() {
  const token = `kbi_${crypto.randomBytes(32).toString("base64url")}`;
  return { token, hash: sha256(token), prefix: token.slice(0, 8) };
}

/**
 * Invite lookups that are not scoped to one team (matched by the secret token or by the
 * caller's own email instead). `teamId: { $exists: true }` satisfies the scope guard and
 * states the intent: every invite belongs to some team, and the result is re-checked against
 * that team before anything happens.
 */
const ANY_TEAM = { teamId: { $exists: true } } as const;
const isDuplicateKey = (e: unknown) => (e as { code?: number }).code === 11000;
const openInvite = () => ({
  ...ANY_TEAM,
  usedAt: null,
  revokedAt: null,
  declinedAt: null,
  expiresAt: { $gt: new Date() },
});

export function teamRoutes(auth: Auth, theme: ThemeFiles, env: Env, deps: RouteDeps) {
  const r = Router();
  const catalog = makeTeamCatalog(theme, env.PUBLIC_ORIGIN);

  // Private data: never cached by browsers or proxies.
  r.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  /** Cookie routes: `requireCustomer` ran, so the principal is the session customer. */
  const cookiePrincipal = (res: Response): Principal => ({
    customer: res.locals.customer as CustomerDoc,
    tokenTeamId: null,
  });
  const cookieCtx = (req: Request, res: Response, action: Parameters<Auth["teamContext"]>[2]) =>
    auth.teamContextFor(cookiePrincipal(res), teamParam(req), action);
  /** Read routes: cookie or bearer token. */
  const anyCtx = (req: Request) => auth.teamContext(req, teamParam(req), "read");

  const isAdmin = (ctx: TeamContext) => roleRank(ctx.member.role) >= roleRank("admin");
  const ownerCount = (teamId: Types.ObjectId) =>
    TeamMember.countDocuments({ teamId, role: "owner" });

  const teamView = async (team: TeamDoc, role: TeamRole) => ({
    slug: team.slug,
    name: team.name,
    role,
    memberCount: await TeamMember.countDocuments({ teamId: team._id }),
    componentCount: await teamScope(team._id, team.slug).count(),
    createdAt: team.createdAt,
  });

  /** True if `customerId` was removed from the team at or after `since` (an invite's creation). */
  const removedSince = async (teamId: Types.ObjectId, customerId: Types.ObjectId, since: Date) => {
    const removal = await TeamRemoval.findOne({ teamId, customerId }).lean<{ removedAt: Date }>();
    return !!removal && removal.removedAt.getTime() >= new Date(since).getTime();
  };

  /**
   * The team must be live, the invite's creator still an admin, and the caller must not have
   * been removed from the team after the invite was made (a removed member can never come
   * back through an invite that predates the removal).
   */
  const inviteStillValid = async (invite: TeamInviteDoc, me: CustomerDoc) => {
    const team = await Team.findOne({ _id: invite.teamId, disabled: false }).lean<TeamDoc>();
    if (!team) return null;
    const creator = await TeamMember.findOne({
      teamId: team._id,
      customerId: invite.createdBy,
    }).lean<TeamMemberDoc>();
    if (!creator || roleRank(creator.role) < roleRank("admin")) return null;
    if (await removedSince(team._id, me._id, invite.createdAt)) return null;
    return team;
  };

  /** Adds the customer to the team with at least `role`; returns whether they were already in. */
  const joinTeam = async (
    team: TeamDoc,
    customer: CustomerDoc,
    role: TeamRole,
    addedBy: unknown,
  ) => {
    const existing = await TeamMember.findOne({
      teamId: team._id,
      customerId: customer._id,
    }).lean<TeamMemberDoc>();
    if (existing) {
      if (roleRank(role) > roleRank(existing.role))
        await TeamMember.updateOne({ _id: existing._id, teamId: team._id }, { role });
      return true;
    }
    const limit = () => teamErrors.limit(`${TEAM_LIMITS.membersPerTeam} members per team`);
    if ((await TeamMember.countDocuments({ teamId: team._id })) >= TEAM_LIMITS.membersPerTeam)
      throw limit();
    let created;
    try {
      created = await TeamMember.create({
        teamId: team._id,
        customerId: customer._id,
        role,
        addedBy,
      });
    } catch (e) {
      // The same customer joining twice at once (email + link invite): one insert wins.
      if (isDuplicateKey(e)) return true;
      throw e;
    }
    // Concurrent joins can pass the count together: re-check after the insert and undo ours.
    if ((await TeamMember.countDocuments({ teamId: team._id })) > TEAM_LIMITS.membersPerTeam) {
      await TeamMember.deleteOne({ _id: created._id, teamId: team._id });
      throw limit();
    }
    log.info("team member joined", { team: team.slug, role });
    return false;
  };

  /**
   * Validates, consumes and applies one invite. Every check that can fail runs before the
   * invite is marked used, and if joining still fails afterwards the invite is released
   * again, so a failed join never burns a one-time invite.
   */
  const acceptInvite = async (
    filter: Record<string, unknown>,
    me: CustomerDoc,
    missing: () => HttpError,
  ) => {
    const found = await TeamInvite.findOne(filter).lean<TeamInviteDoc>();
    if (!found) throw missing();
    const team = await inviteStillValid(found, me);
    if (!team) throw teamErrors.inviteInvalid();
    const isMember = await TeamMember.exists({ teamId: team._id, customerId: me._id });
    if (
      !isMember &&
      (await TeamMember.countDocuments({ teamId: team._id })) >= TEAM_LIMITS.membersPerTeam
    )
      throw teamErrors.limit(`${TEAM_LIMITS.membersPerTeam} members per team`);
    // Atomic consume: two concurrent accepts can only ever get one document.
    const invite = await TeamInvite.findOneAndUpdate(
      { ...filter, _id: found._id },
      { usedAt: new Date(), usedBy: me._id },
      { new: true },
    ).lean<TeamInviteDoc>();
    if (!invite) throw missing();
    try {
      const already = await joinTeam(team, me, invite.role, invite.createdBy);
      // A removal that ran while this accept was in flight wins over the invite.
      if (!already && (await removedSince(team._id, me._id, invite.createdAt))) {
        await TeamMember.deleteOne({ teamId: team._id, customerId: me._id });
        throw teamErrors.inviteInvalid();
      }
      return { team, invite, already };
    } catch (e) {
      await TeamInvite.updateOne(
        { _id: invite._id, teamId: invite.teamId },
        { $unset: { usedAt: 1, usedBy: 1 } },
      );
      throw e;
    }
  };

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  r.get("/teams", auth.requireCustomer, async (_req, res) => {
    const c = res.locals.customer as CustomerDoc;
    const memberships = await TeamMember.find({ customerId: c._id }).lean<TeamMemberDoc[]>();
    const teams = memberships.length
      ? await Team.find({ _id: { $in: memberships.map((m) => m.teamId) }, disabled: false })
          .sort({ name: 1 })
          .lean<TeamDoc[]>()
      : [];
    const roleOf = new Map(memberships.map((m) => [String(m.teamId), m.role]));
    res.json(await Promise.all(teams.map((t) => teamView(t, roleOf.get(String(t._id))!))));
  });

  r.post("/teams", auth.requireCustomer, async (req, res) => {
    const { name, slug } = parseBody(
      z.object({ name: z.string().trim().min(2).max(60), slug: slugSchema }),
      req.body,
    );
    const c = res.locals.customer as CustomerDoc;
    const owned = await TeamMember.countDocuments({ customerId: c._id, role: "owner" });
    if (owned >= TEAM_LIMITS.ownedTeamsPerCustomer)
      throw teamErrors.limit(`${TEAM_LIMITS.ownedTeamsPerCustomer} teams you own`);
    if (await Team.exists({ slug })) throw teamErrors.slugTaken();
    let team;
    try {
      team = await Team.create({ slug, name, createdBy: c._id });
    } catch (e) {
      if (isDuplicateKey(e)) throw teamErrors.slugTaken();
      throw e;
    }
    try {
      await TeamMember.create({
        teamId: team._id,
        customerId: c._id,
        role: "owner",
        addedBy: c._id,
      });
    } catch (e) {
      await Team.deleteOne({ _id: team._id });
      throw e;
    }
    // Concurrent creates can pass the owned-teams count together: re-check and undo ours.
    if (
      (await TeamMember.countDocuments({ customerId: c._id, role: "owner" })) >
      TEAM_LIMITS.ownedTeamsPerCustomer
    ) {
      await Team.deleteOne({ _id: team._id });
      await TeamMember.deleteOne({ teamId: team._id, customerId: c._id });
      throw teamErrors.limit(`${TEAM_LIMITS.ownedTeamsPerCustomer} teams you own`);
    }
    log.info("team created", { team: slug });
    res.status(201).json(await teamView(team.toObject() as TeamDoc, "owner"));
  });

  r.get("/teams/:team", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "read");
    res.json(await teamView(ctx.team, ctx.member.role));
  });

  r.patch("/teams/:team", auth.requireCustomer, async (req, res) => {
    const { name } = parseBody(z.object({ name: z.string().trim().min(2).max(60) }), req.body);
    const ctx = await cookieCtx(req, res, "manage_members");
    await Team.updateOne({ _id: ctx.team._id }, { name });
    res.json(await teamView({ ...ctx.team, name }, ctx.member.role));
  });

  // Delete the Team row first: every route 404s at once, and leftovers are unreachable.
  r.delete("/teams/:team", auth.requireCustomer, async (req, res) => {
    const { confirm } = parseBody(z.object({ confirm: z.string() }), req.body);
    const ctx = await cookieCtx(req, res, "manage_owners");
    if (confirm !== ctx.team.slug)
      throw new HttpError(400, "confirm_mismatch", "Type the team slug to confirm.");
    await Team.deleteOne({ _id: ctx.team._id });
    await Promise.all([
      TeamMember.deleteMany({ teamId: ctx.team._id }),
      ctx.repo.removeAllComponents(),
      ctx.repo.invites.removeAll(),
      ctx.repo.jobs.removeAll(),
      ApiToken.deleteMany({ teamId: ctx.team._id }),
      TeamRemoval.deleteMany({ teamId: ctx.team._id }),
    ]);
    log.info("team deleted", { team: ctx.team.slug });
    res.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Members
  // -------------------------------------------------------------------------

  r.get("/teams/:team/members", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "read");
    const members = await TeamMember.find({ teamId: ctx.team._id })
      .sort({ createdAt: 1 })
      .lean<TeamMemberDoc[]>();
    const customers = await Customer.find({ _id: { $in: members.map((m) => m.customerId) } })
      .select("email name")
      .lean<CustomerDoc[]>();
    const byId = new Map(customers.map((c) => [String(c._id), c]));
    res.json(
      members.map((m) => ({
        customerId: String(m.customerId),
        name: byId.get(String(m.customerId))?.name ?? "",
        email: byId.get(String(m.customerId))?.email ?? "",
        role: m.role,
        joinedAt: m.createdAt,
      })),
    );
  });

  r.patch("/teams/:team/members/:customerId", auth.requireCustomer, async (req, res) => {
    const { role } = parseBody(z.object({ role: z.enum(["owner", "admin", "member"]) }), req.body);
    const ctx = await cookieCtx(req, res, "manage_members");
    const customerId = idParam(req.params.customerId);
    const target = await TeamMember.findOne({
      teamId: ctx.team._id,
      customerId,
    }).lean<TeamMemberDoc>();
    if (!target) throw teamErrors.notFound();
    // Anything that touches the owner role needs an owner.
    if ((target.role === "owner" || role === "owner") && ctx.member.role !== "owner")
      throw new HttpError(403, "team_role_required", "Only an owner can change owners.");
    await TeamMember.updateOne({ _id: target._id, teamId: ctx.team._id }, { role });
    if (target.role === "owner" && role !== "owner" && (await ownerCount(ctx.team._id)) === 0) {
      await TeamMember.updateOne({ _id: target._id, teamId: ctx.team._id }, { role: "owner" });
      throw teamErrors.lastOwner();
    }
    log.info("team role changed", { team: ctx.team.slug, role });
    res.json({ ok: true, role });
  });

  r.delete("/teams/:team/members/:customerId", auth.requireCustomer, async (req, res) => {
    const customerId = idParam(req.params.customerId);
    const me = res.locals.customer as CustomerDoc;
    const self = customerId === String(me._id);
    const ctx = await cookieCtx(req, res, self ? "read" : "manage_members");
    const target = await TeamMember.findOne({
      teamId: ctx.team._id,
      customerId,
    }).lean<TeamMemberDoc>();
    if (!target) throw teamErrors.notFound();
    if (!self && target.role === "owner" && ctx.member.role !== "owner")
      throw new HttpError(403, "team_role_required", "Only an owner can remove an owner.");
    if (target.role === "owner" && (await ownerCount(ctx.team._id)) <= 1)
      throw teamErrors.lastOwner();
    if (!self) {
      // Recorded before the delete, so an invite accepted concurrently sees it (acceptInvite).
      await TeamRemoval.updateOne(
        { teamId: ctx.team._id, customerId: target.customerId },
        { removedAt: new Date() },
        { upsert: true },
      );
    }
    await TeamMember.deleteOne({ _id: target._id, teamId: ctx.team._id });
    // The count above is check-then-act: two owners removing each other (or leaving, or a
    // concurrent PATCH demotion) all pass it. Re-check after the write, as PATCH does, and
    // put the member back if the team was left without an owner.
    if (target.role === "owner" && (await ownerCount(ctx.team._id)) === 0) {
      try {
        await TeamMember.collection.insertOne(target);
      } catch (e) {
        if (!isDuplicateKey(e)) throw e;
      }
      throw teamErrors.lastOwner();
    }
    if (!self) {
      // Their open invites to this team die too (email invites and email-locked links).
      const removed = await Customer.findById(target.customerId)
        .select("email")
        .lean<CustomerDoc>();
      if (removed)
        await TeamInvite.updateMany(
          { teamId: ctx.team._id, email: removed.email, usedAt: null, revokedAt: null },
          { revokedAt: new Date() },
        );
    }
    // Their team-scoped tokens die with the membership.
    await ApiToken.updateMany(
      { customerId: target.customerId, teamId: ctx.team._id, revokedAt: null },
      { revokedAt: new Date() },
    );
    log.info(self ? "team member left" : "team member removed", { team: ctx.team.slug });
    res.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Invites
  // -------------------------------------------------------------------------

  const inviteView = (i: TeamInviteDoc) => ({
    id: String(i._id),
    kind: i.kind,
    role: i.role,
    prefix: i.prefix,
    email: i.email ?? null,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  });

  r.get("/teams/:team/invites", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "manage_members");
    res.json((await ctx.repo.invites.pending()).map(inviteView));
  });

  const inviteBody = z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("email"),
      email: z.string().trim().email().max(200),
      role: z.enum(["admin", "member"]),
    }),
    z.object({
      kind: z.literal("link"),
      role: z.enum(["admin", "member"]),
      email: z.string().trim().email().max(200).optional(),
    }),
  ]);
  r.post("/teams/:team/invites", auth.requireCustomer, deps.teamWriteLimit, async (req, res) => {
    const body = parseBody(inviteBody, req.body);
    const ctx = await cookieCtx(req, res, "manage_members");
    if (!canInviteRole(ctx.member.role, body.role))
      throw new HttpError(403, "team_role_required", "You cannot invite with that role.");
    if ((await ctx.repo.invites.countActive()) >= TEAM_LIMITS.activeInvitesPerTeam)
      throw teamErrors.limit(`${TEAM_LIMITS.activeInvitesPerTeam} pending invites`);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    if (body.kind === "email") {
      // Same answer for known and unknown emails: the invite waits for a matching account.
      await ctx.repo.invites.create({
        kind: "email",
        role: body.role,
        email: body.email.toLowerCase(),
        prefix: `kbi_${crypto.randomBytes(2).toString("hex")}`,
        createdBy: ctx.customer._id,
        expiresAt,
      });
      log.info("team invite created", { team: ctx.team.slug, kind: "email" });
      res.status(201).json({ ok: true });
      return;
    }
    const { token, hash, prefix } = newInviteToken();
    await ctx.repo.invites.create({
      kind: "link",
      role: body.role,
      email: body.email?.toLowerCase(),
      tokenHash: hash,
      prefix,
      createdBy: ctx.customer._id,
      expiresAt,
    });
    log.info("team invite created", { team: ctx.team.slug, kind: "link" });
    // The token lives in the fragment: browsers never send it to any server or referrer.
    res.status(201).json({ url: `${env.PUBLIC_ORIGIN}/join#${token}`, expiresAt });
  });

  r.delete("/teams/:team/invites/:id", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "manage_members");
    if (!(await ctx.repo.invites.revoke(idParam(req.params.id)))) throw teamErrors.notFound();
    res.json({ ok: true });
  });

  /** My pending email invites (matched on my account email). */
  r.get("/invites", auth.requireCustomer, async (_req, res) => {
    const me = res.locals.customer as CustomerDoc;
    const invites = await TeamInvite.find({ ...openInvite(), kind: "email", email: me.email })
      .sort({ createdAt: -1 })
      .lean<TeamInviteDoc[]>();
    const teams = await Team.find({
      _id: { $in: invites.map((i) => i.teamId) },
      disabled: false,
    }).lean<TeamDoc[]>();
    const byId = new Map(teams.map((t) => [String(t._id), t]));
    res.json(
      invites
        .filter((i) => byId.has(String(i.teamId)))
        .map((i) => ({
          id: String(i._id),
          role: i.role,
          team: { slug: byId.get(String(i.teamId))!.slug, name: byId.get(String(i.teamId))!.name },
          expiresAt: i.expiresAt,
        })),
    );
  });

  const myEmailInvite = (id: string, me: CustomerDoc) => ({
    ...openInvite(),
    _id: id,
    kind: "email",
    email: me.email,
  });
  r.post("/invites/:id/accept", auth.requireCustomer, async (req, res) => {
    const me = res.locals.customer as CustomerDoc;
    const { team, already } = await acceptInvite(
      myEmailInvite(idParam(req.params.id), me),
      me,
      teamErrors.notFound,
    );
    res.json({ ok: true, team: team.slug, already });
  });
  r.post("/invites/:id/decline", auth.requireCustomer, async (req, res) => {
    const me = res.locals.customer as CustomerDoc;
    const { matchedCount } = await TeamInvite.updateOne(myEmailInvite(idParam(req.params.id), me), {
      declinedAt: new Date(),
    });
    if (!matchedCount) throw teamErrors.notFound();
    res.json({ ok: true });
  });

  // Link invites. The token only ever travels in a POST body.
  const joinBody = z.object({ token: z.string().regex(/^kbi_[A-Za-z0-9_-]{40,50}$/) });
  const byCustomer = (req: Request) =>
    String((req.res?.locals.customer as CustomerDoc | undefined)?._id ?? req.ip);
  const joinLimit = [deps.teamWriteLimit, deps.makeLimit("team-join-customer", byCustomer)];

  /**
   * A link invite the caller may use: open, matching token, and either not locked to an
   * email or locked to the caller's own. The lock is part of the filter so that a wrong
   * account can never consume (burn) someone else's invite.
   */
  const myLinkInvite = (token: string, me: CustomerDoc) => ({
    ...openInvite(),
    kind: "link",
    tokenHash: sha256(token),
    $or: [{ email: null }, { email: me.email }],
  });

  r.post("/join/inspect", auth.requireCustomer, ...joinLimit, async (req, res) => {
    const { token } = parseBody(joinBody, req.body);
    const me = res.locals.customer as CustomerDoc;
    const invite = await TeamInvite.findOne(myLinkInvite(token, me)).lean<TeamInviteDoc>();
    if (!invite) throw teamErrors.inviteInvalid();
    const team = await inviteStillValid(invite, me);
    if (!team) throw teamErrors.inviteInvalid();
    res.json({ team: { name: team.name, slug: team.slug }, role: invite.role });
  });

  r.post("/join", auth.requireCustomer, ...joinLimit, async (req, res) => {
    const { token } = parseBody(joinBody, req.body);
    const me = res.locals.customer as CustomerDoc;
    const { team, invite, already } = await acceptInvite(
      myLinkInvite(token, me),
      me,
      teamErrors.inviteInvalid,
    );
    res.json({ ok: true, team: team.slug, role: invite.role, already });
  });

  // -------------------------------------------------------------------------
  // Components: write side (cookie, admin)
  // -------------------------------------------------------------------------

  const isBig = (body: unknown) =>
    Buffer.byteLength(JSON.stringify(body ?? null)) > env.QUEUE_THRESHOLD_BYTES;
  const enqueue = async (
    res: Response,
    ctx: TeamContext,
    slug: string | undefined,
    bundle: unknown,
  ) => {
    const jobId = await deps.bundleJobs.add({
      slug,
      bundle,
      teamId: String(ctx.team._id),
      customerId: String(ctx.customer._id),
    });
    await ctx.repo.jobs.record(jobId, slug);
    log.info("team bundle queued", { team: ctx.team.slug, slug: slug ?? null, jobId });
    res.status(202).json({ status: "queued", jobId });
  };
  const loadDraft = async (ctx: TeamContext, slug: string) => {
    const doc = await ctx.repo.get(slug);
    if (!doc) throw teamErrors.notFound();
    return doc;
  };

  r.post("/teams/:team/validate", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "manage_components");
    const result = ctx.repo.check(req.body);
    res.json(result.ok ? { ok: true, errors: [] } : result);
  });
  r.post("/teams/:team/components", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "manage_components");
    if (isBig(req.body)) return enqueue(res, ctx, undefined, req.body);
    const { record } = await ctx.repo.create(req.body);
    res.status(201).json(teamSummary(record));
  });
  r.get("/teams/:team/jobs/:id", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "manage_components");
    const id = idParam(req.params.id, JOB_ID);
    const owned = await ctx.repo.jobs.get(id);
    const job = owned ? await deps.bundleJobs.status(id) : null;
    if (!job) throw teamErrors.notFound();
    res.json(job);
  });
  r.get("/teams/:team/components/:slug/draft", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "read_draft");
    const doc = await loadDraft(ctx, slugParam(req));
    res.json({ ...teamSummary(doc), draft: doc.draft, published: doc.published ?? null });
  });
  r.get("/teams/:team/components/:slug/draft-preview", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "read_draft");
    const doc = await loadDraft(ctx, slugParam(req));
    res.json(previewPayload(doc.draft, theme));
  });
  r.put("/teams/:team/components/:slug", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "manage_components");
    const slug = slugParam(req);
    if (isBig(req.body)) return enqueue(res, ctx, slug, req.body);
    res.json(teamSummary(await ctx.repo.updateDraft(slug, req.body)));
  });
  r.post("/teams/:team/components/:slug/publish", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "manage_components");
    res.json(teamSummary(await ctx.repo.publish(slugParam(req))));
  });
  r.post("/teams/:team/components/:slug/unpublish", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "manage_components");
    res.json(teamSummary(await ctx.repo.unpublish(slugParam(req))));
  });
  r.delete("/teams/:team/components/:slug", auth.requireCustomer, async (req, res) => {
    const ctx = await cookieCtx(req, res, "manage_components");
    await ctx.repo.remove(slugParam(req));
    res.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Components: read side (cookie or bearer token, member)
  // -------------------------------------------------------------------------

  /**
   * Draft visibility (read_draft) is cookie-only, like /draft and /draft-preview: an API token
   * (personal or team-scoped) only ever sees published snapshots, whatever its owner's role.
   */
  const seesDrafts = (req: Request, ctx: TeamContext) => isAdmin(ctx) && !usesBearer(req);

  r.get("/teams/:team/components", async (req, res) => {
    const ctx = await anyCtx(req);
    res.json(await catalog.list(ctx.repo, seesDrafts(req, ctx)));
  });
  r.get("/teams/:team/components/:slug", async (req, res) => {
    const ctx = await anyCtx(req);
    res.json(await catalog.detail(ctx.repo, slugParam(req)));
  });
  r.get("/teams/:team/components/:slug/thumbnail", async (req, res) => {
    const ctx = await anyCtx(req);
    const draft = req.query.draft === "1" && seesDrafts(req, ctx);
    const { mime, bytes } = await catalog.thumbnail(ctx.repo, slugParam(req), draft);
    sendThumbnail(res, `data:${mime};base64,${bytes.toString("base64")}`);
  });
  r.get("/teams/:team/components/:slug/preview", async (req, res) => {
    const ctx = await anyCtx(req);
    res.json(await catalog.preview(ctx.repo, slugParam(req)));
  });
  r.get("/teams/:team/components/:slug/copy", async (req, res) => {
    const ctx = await anyCtx(req);
    sendText(res, await catalog.copyCode(ctx.repo, slugParam(req)));
  });
  r.get("/teams/:team/components/:slug/prompt", async (req, res) => {
    const ctx = await anyCtx(req);
    sendText(res, await catalog.prompt(ctx.repo, slugParam(req)));
  });
  /** CLI installer: `kitbase add @team/slug`. Cookie or bearer token; logs never include the token. */
  r.get("/teams/:team/registry/:slug", deps.registryLimit, async (req, res) => {
    const ctx = await anyCtx(req);
    const slug = slugParam(req);
    const item = await catalog.registryItem(ctx.repo, slug);
    log.info("team registry download", { team: ctx.team.slug, slug });
    res.json(item);
  });

  return r;
}

/** Platform admin: metadata only. No route here ever returns team source code. */
export function adminTeamRoutes(auth: Auth) {
  const r = Router();
  r.use(auth.requireAdmin);
  r.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  const view = async (t: TeamDoc) => {
    const owners = await TeamMember.find({ teamId: t._id, role: "owner" }).lean<TeamMemberDoc[]>();
    const emails = owners.length
      ? await Customer.find({ _id: { $in: owners.map((o) => o.customerId) } })
          .select("email")
          .lean<CustomerDoc[]>()
      : [];
    return {
      id: String(t._id),
      slug: t.slug,
      name: t.name,
      owners: emails.map((c) => c.email),
      memberCount: await TeamMember.countDocuments({ teamId: t._id }),
      componentCount: await teamScope(t._id, t.slug).count(),
      disabled: !!t.disabled,
      createdAt: t.createdAt,
    };
  };
  const loadTeam = async (rawId: unknown) => {
    const team = await Team.findById(idParam(rawId)).lean<TeamDoc>();
    if (!team) throw teamErrors.notFound();
    return team;
  };

  r.get("/", async (_req, res) => {
    const teams = await Team.find().sort({ createdAt: -1 }).lean<TeamDoc[]>();
    res.json(await Promise.all(teams.map(view)));
  });
  r.post("/:id/status", async (req, res) => {
    const { disabled } = parseBody(z.object({ disabled: z.boolean() }), req.body);
    const team = await loadTeam(req.params.id);
    await Team.updateOne({ _id: team._id }, { disabled });
    log.info(disabled ? "team disabled" : "team enabled", { team: team.slug });
    res.json(await view({ ...team, disabled }));
  });
  /** Rescue ownership: the customer must already be a member. */
  r.post("/:id/owner", async (req, res) => {
    const { customerId } = parseBody(
      z.object({ customerId: z.string().regex(OBJECT_ID) }),
      req.body,
    );
    const team = await loadTeam(req.params.id);
    const { matchedCount } = await TeamMember.updateOne(
      { teamId: team._id, customerId },
      { role: "owner" },
    );
    if (!matchedCount)
      throw new HttpError(404, "not_found", "That customer is not a member of the team.");
    log.info("team owner assigned", { team: team.slug });
    res.json(await view(team));
  });
  r.get("/:id/members", async (req, res) => {
    const team = await loadTeam(req.params.id);
    const members = await TeamMember.find({ teamId: team._id }).lean<TeamMemberDoc[]>();
    const customers = await Customer.find({ _id: { $in: members.map((m) => m.customerId) } })
      .select("email name")
      .lean<CustomerDoc[]>();
    const byId = new Map(customers.map((c) => [String(c._id), c]));
    res.json(
      members.map((m) => ({
        customerId: String(m.customerId),
        email: byId.get(String(m.customerId))?.email ?? "",
        name: byId.get(String(m.customerId))?.name ?? "",
        role: m.role,
      })),
    );
  });
  return r;
}
