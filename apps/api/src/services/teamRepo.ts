import { Types, type Model } from "mongoose";
import { validateBundle } from "@ti/core";
import {
  Team,
  TeamComponent,
  TeamInvite,
  TeamJob,
  type TeamComponentRecord,
  type TeamDoc,
  type TeamInviteDoc,
} from "../models";
import {
  createDraftIn,
  runBundleJob,
  updateDraftIn,
  validOrThrow,
  type BundleJob,
  type DraftScope,
} from "./drafts";
import { HttpError } from "../utils/http";
import { log } from "../utils/logger";

/** Hard limits (constants, not stored in the DB). Each is a single check to change. */
export const TEAM_LIMITS = {
  ownedTeamsPerCustomer: 3,
  membersPerTeam: 25,
  componentsPerTeam: 100,
  activeInvitesPerTeam: 20,
  teamTokensPerMember: 10,
} as const;

type Id = Types.ObjectId;

/**
 * Every read and write of a team's private data goes through here, and every filter carries
 * the server-resolved `teamId` (lookups by id are `{ _id, teamId }`, which blocks IDOR).
 * `TeamComponent` is imported by this file only; the schema plugin additionally throws on
 * any query that reaches Mongo without a `teamId`.
 */
export function teamScope(teamId: Id, teamSlug: string, actor?: Id) {
  const filter = { teamId };
  const draftScope: DraftScope = {
    model: TeamComponent as unknown as Model<Record<string, unknown>>,
    filter,
    onCreate: { createdBy: actor, updatedBy: actor },
    onUpdate: { updatedBy: actor },
    validate: (input) => validOrThrow(input, { team: teamSlug }),
    forget: async () => {}, // team routes are never cached
    maxDocuments: TEAM_LIMITS.componentsPerTeam,
  };
  const byId = (id: string | Id) => ({ _id: id, teamId });

  return {
    teamId,
    teamSlug,
    /** Non-throwing validation for the upload form. `access` is forced to free first. */
    check(input: unknown) {
      return validateBundle(forceFree(input), { team: teamSlug });
    },

    list(status?: "published" | "draft" | "unpublished") {
      return TeamComponent.find(status ? { ...filter, status } : filter)
        .sort({ updatedAt: -1 })
        .lean<TeamComponentRecord[]>();
    },
    get(slug: string) {
      return TeamComponent.findOne({ ...filter, slug }).lean<TeamComponentRecord>();
    },
    getPublished(slug: string) {
      return TeamComponent.findOne({
        ...filter,
        slug,
        status: "published",
      }).lean<TeamComponentRecord>();
    },
    count() {
      return TeamComponent.countDocuments(filter);
    },
    create(input: unknown) {
      return createDraftIn<TeamComponentRecord>(draftScope, forceFree(input));
    },
    updateDraft(slug: string, input: unknown) {
      return updateDraftIn<TeamComponentRecord>(draftScope, slug, forceFree(input));
    },
    runJob(job: BundleJob) {
      return runBundleJob({ ...job, bundle: forceFree(job.bundle) }, draftScope);
    },
    /** Re-validates the draft, then copies it into the immutable published snapshot. */
    async publish(slug: string) {
      const doc = await this.get(slug);
      if (!doc) throw new HttpError(404, "not_found", "Component not found.");
      const bundle = validOrThrow(forceFree(doc.draft), { team: teamSlug });
      const updated = await TeamComponent.findOneAndUpdate(
        { ...filter, slug },
        { status: "published", published: bundle, publishedAt: new Date(), updatedBy: actor },
        { new: true },
      ).lean<TeamComponentRecord>();
      log.info("team component published", { team: teamSlug, slug });
      return updated!;
    },
    async unpublish(slug: string) {
      const doc = await this.get(slug);
      if (!doc) throw new HttpError(404, "not_found", "Component not found.");
      if (doc.status !== "published")
        throw new HttpError(400, "not_published", "Component is not published.");
      const updated = await TeamComponent.findOneAndUpdate(
        { ...filter, slug },
        { status: "unpublished", updatedBy: actor },
        { new: true },
      ).lean<TeamComponentRecord>();
      log.info("team component unpublished", { team: teamSlug, slug });
      return updated!;
    },
    async remove(slug: string) {
      const { deletedCount } = await TeamComponent.deleteOne({ ...filter, slug });
      if (!deletedCount) throw new HttpError(404, "not_found", "Component not found.");
      log.info("team component deleted", { team: teamSlug, slug });
    },
    /** Cascade helper: drops every component of the team (used after the Team row is gone). */
    removeAllComponents() {
      return TeamComponent.deleteMany(filter);
    },

    jobs: {
      /** Records who owns a queued upload; `teamId` comes from the resolved team, never the body. */
      record(id: string, slug: string | undefined) {
        return TeamJob.create({
          _id: id,
          teamId,
          slug,
          createdBy: actor,
          expiresAt: new Date(Date.now() + 60 * 60_000),
        });
      },
      get(id: string) {
        return TeamJob.findOne(byId(id)).lean<{ _id: string; slug?: string }>();
      },
      removeAll() {
        return TeamJob.deleteMany(filter);
      },
    },

    invites: {
      pending() {
        return TeamInvite.find({
          ...filter,
          usedAt: null,
          revokedAt: null,
          declinedAt: null,
          expiresAt: { $gt: new Date() },
        })
          .sort({ createdAt: -1 })
          .lean<TeamInviteDoc[]>();
      },
      countActive() {
        return TeamInvite.countDocuments({
          ...filter,
          usedAt: null,
          revokedAt: null,
          declinedAt: null,
          expiresAt: { $gt: new Date() },
        });
      },
      create(doc: Omit<Partial<TeamInviteDoc>, "teamId">) {
        return TeamInvite.create({ ...doc, teamId });
      },
      async revoke(id: string) {
        const r = await TeamInvite.updateOne(
          { ...byId(id), revokedAt: null },
          { revokedAt: new Date() },
        );
        return r.matchedCount > 0;
      },
      removeAll() {
        return TeamInvite.deleteMany(filter);
      },
    },
  };
}

export type TeamScope = ReturnType<typeof teamScope>;

/**
 * Queue processor for big team uploads. The team is re-resolved when the job runs: a team
 * deleted or disabled in the meantime makes the job fail instead of writing orphan data.
 */
export async function processTeamBundleJob(job: BundleJob) {
  const team = await Team.findOne({ _id: job.teamId, disabled: false }).lean<TeamDoc>();
  if (!team) throw new Error("Team no longer exists.");
  const actor = job.customerId ? new Types.ObjectId(job.customerId) : undefined;
  await teamScope(team._id, team.slug, actor).runJob(job);
}

/** Team bundles are never premium: the plan lock only applies to the public catalogue. */
function forceFree(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  return { ...(input as Record<string, unknown>), access: "free" };
}
