/**
 * Regression tests for the team-workspace security review: removed members and invites,
 * queued uploads after revocation, draft visibility over API tokens, the last-owner race,
 * invites burned by failed joins, and duplicate-slug races.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CustomerDoc, TeamDoc } from "../src/models";
import { Customer, TeamComponent, TeamInvite, TeamMember } from "../src/models";
import { processTeamBundleJob } from "../src/services/teamRepo";
import {
  addMember,
  bearer,
  bundle,
  createTeam,
  customer,
  login,
  reset,
  setup,
  teardown,
  token,
  type App,
} from "./helpers";
import request from "supertest";

let app: App;
let team: TeamDoc;
let owner: CustomerDoc;
let admin: CustomerDoc;
let x: CustomerDoc;
let other: CustomerDoc;

beforeAll(async () => {
  ({ app } = await setup());
});
afterAll(() => teardown(app));
beforeEach(async () => {
  await reset();
  owner = await customer({ email: "owner@example.com" });
  admin = await customer({ email: "admin@example.com" });
  x = await customer({ email: "x@example.com" });
  other = await customer({ email: "other@example.com" });
  team = await createTeam("acme", owner, "Acme");
  await addMember(team, admin, "admin");
});

const isMember = async (c: CustomerDoc) =>
  !!(await TeamMember.exists({ teamId: team._id, customerId: c._id }));

async function makeLink(who: CustomerDoc, body: Record<string, unknown> = {}) {
  const agent = await login(app, who);
  const res = await agent
    .post("/api/teams/acme/invites")
    .send({ kind: "link", role: "member", ...body });
  expect(res.status).toBe(201);
  return (res.body.url as string).split("#")[1]!;
}

describe("a removed member cannot come back through an old invite", () => {
  it("pending email invite is revoked on removal and cannot be accepted", async () => {
    const a = await login(app, admin);
    expect(
      (
        await a
          .post("/api/teams/acme/invites")
          .send({ kind: "email", email: x.email, role: "member" })
      ).status,
    ).toBe(201);
    // X joins through a link, leaving the email invite pending.
    const link = await makeLink(admin);
    const xa = await login(app, x);
    expect((await xa.post("/api/join").send({ token: link })).status).toBe(200);
    const pending = await xa.get("/api/invites");
    expect(pending.body).toHaveLength(1);
    const inviteId = pending.body[0].id as string;

    expect((await a.delete(`/api/teams/acme/members/${x._id}`)).status).toBe(200);
    expect(await isMember(x)).toBe(false);

    const accept = await xa.post(`/api/invites/${inviteId}/accept`);
    expect([404, 410]).toContain(accept.status);
    expect(await isMember(x)).toBe(false);
    expect((await xa.get("/api/teams/acme/components")).status).toBe(404);
  });

  it("an email invite that escaped revocation is still refused (removal guard)", async () => {
    const a = await login(app, admin);
    await a.post("/api/teams/acme/invites").send({ kind: "email", email: x.email, role: "member" });
    await addMember(team, x, "member");
    const xa = await login(app, x);
    const inviteId = (await xa.get("/api/invites")).body[0].id as string;
    expect((await a.delete(`/api/teams/acme/members/${x._id}`)).status).toBe(200);
    // Simulate a path that did not revoke it (e.g. the account email changed since).
    await TeamInvite.updateOne({ _id: inviteId, teamId: team._id }, { $unset: { revokedAt: 1 } });
    expect((await xa.post(`/api/invites/${inviteId}/accept`)).status).toBe(410);
    expect(await isMember(x)).toBe(false);
  });

  it("an unlocked link created before the removal is refused, and is not burned", async () => {
    const link = await makeLink(admin);
    await addMember(team, x, "member");
    const a = await login(app, admin);
    expect((await a.delete(`/api/teams/acme/members/${x._id}`)).status).toBe(200);
    const xa = await login(app, x);
    expect((await xa.post("/api/join/inspect").send({ token: link })).status).toBe(410);
    expect((await xa.post("/api/join").send({ token: link })).status).toBe(410);
    expect(await isMember(x)).toBe(false);
    // Somebody else can still use it.
    const o = await login(app, other);
    expect((await o.post("/api/join").send({ token: link })).status).toBe(200);
  });

  it("a new invite made after the removal works", async () => {
    await addMember(team, x, "member");
    const a = await login(app, admin);
    expect((await a.delete(`/api/teams/acme/members/${x._id}`)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 5));
    const link = await makeLink(admin);
    const xa = await login(app, x);
    expect((await xa.post("/api/join").send({ token: link })).status).toBe(200);
    expect(await isMember(x)).toBe(true);
  });
});

describe("queued team uploads re-check the uploader when they run", () => {
  const job = (c: CustomerDoc, slug = "late") => ({
    bundle: bundle(slug, "acme"),
    teamId: String(team._id),
    customerId: String(c._id),
  });

  it("an admin still in the team can write", async () => {
    await processTeamBundleJob(job(admin));
    expect(await TeamComponent.exists({ teamId: team._id, slug: "late" })).toBeTruthy();
  });
  it("a demoted uploader cannot", async () => {
    await TeamMember.updateOne({ teamId: team._id, customerId: admin._id }, { role: "member" });
    await expect(processTeamBundleJob(job(admin))).rejects.toThrow(/permission/);
    expect(await TeamComponent.exists({ teamId: team._id, slug: "late" })).toBeNull();
  });
  it("a removed uploader cannot", async () => {
    await TeamMember.deleteOne({ teamId: team._id, customerId: admin._id });
    await expect(processTeamBundleJob(job(admin))).rejects.toThrow(/permission/);
    expect(await TeamComponent.exists({ teamId: team._id, slug: "late" })).toBeNull();
  });
  it("a disabled uploader cannot", async () => {
    await Customer.updateOne({ _id: admin._id }, { disabled: true });
    await expect(processTeamBundleJob(job(admin))).rejects.toThrow(/permission/);
    expect(await TeamComponent.exists({ teamId: team._id, slug: "late" })).toBeNull();
  });
});

describe("API tokens never see drafts", () => {
  beforeEach(async () => {
    const a = await login(app, owner);
    expect((await a.post("/api/teams/acme/components").send(bundle("live", "acme"))).status).toBe(
      201,
    );
    expect((await a.post("/api/teams/acme/components/live/publish")).status).toBe(200);
    expect(
      (
        await a
          .put("/api/teams/acme/components/live")
          .send(bundle("live", "acme", { version: "2.0.0" }))
      ).status,
    ).toBe(200);
    expect((await a.post("/api/teams/acme/components").send(bundle("secret", "acme"))).status).toBe(
      201,
    );
  });

  it("cookie admin sees drafts; the same owner's personal and team tokens do not", async () => {
    const a = await login(app, owner);
    const cookie = await a.get("/api/teams/acme/components");
    expect(cookie.body.map((r: { slug: string }) => r.slug).sort()).toEqual(["live", "secret"]);
    expect((await a.get("/api/teams/acme/components/secret/thumbnail?draft=1")).status).toBe(200);

    for (const t of [await token(owner), await token(owner, team._id)]) {
      const list = await request(app).get("/api/teams/acme/components").set(bearer(t));
      expect(list.status).toBe(200);
      expect(list.body.map((r: { slug: string }) => r.slug)).toEqual(["live"]);
      expect(list.body[0]).toMatchObject({
        version: "1.0.0",
        draftVersion: null,
        hasUnpublishedChanges: false,
      });
      const thumb = await request(app)
        .get("/api/teams/acme/components/secret/thumbnail?draft=1")
        .set(bearer(t));
      expect(thumb.status).toBe(404);
    }
  });

  it("plain members see no draft details", async () => {
    await addMember(team, x, "member");
    const xa = await login(app, x);
    const list = await xa.get("/api/teams/acme/components");
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      slug: "live",
      status: "published",
      version: "1.0.0",
      draftVersion: null,
      hasUnpublishedChanges: false,
    });
  });
});

describe("last owner cannot be lost to a race", () => {
  it("two owners removing each other at once leave at least one owner", async () => {
    await TeamMember.create({ teamId: team._id, customerId: x._id, role: "owner" });
    const o = await login(app, owner);
    const xa = await login(app, x);
    const [r1, r2] = await Promise.all([
      o.delete(`/api/teams/acme/members/${x._id}`),
      xa.delete(`/api/teams/acme/members/${owner._id}`),
    ]);
    expect([r1.status, r2.status]).toContain(409);
    expect(await TeamMember.countDocuments({ teamId: team._id, role: "owner" })).toBeGreaterThan(0);
  });

  it("two owners leaving at once leave at least one owner", async () => {
    await TeamMember.create({ teamId: team._id, customerId: x._id, role: "owner" });
    const o = await login(app, owner);
    const xa = await login(app, x);
    await Promise.all([
      o.delete(`/api/teams/acme/members/${owner._id}`),
      xa.delete(`/api/teams/acme/members/${x._id}`),
    ]);
    expect(await TeamMember.countDocuments({ teamId: team._id, role: "owner" })).toBeGreaterThan(0);
  });
});

describe("a failed join does not burn the invite", () => {
  it("team full: 409 and the link stays usable", async () => {
    const link = await makeLink(admin);
    const filler = await Promise.all(Array.from({ length: 23 }, () => customer()));
    for (const f of filler) await addMember(team, f, "member");
    expect(await TeamMember.countDocuments({ teamId: team._id })).toBe(25);
    const xa = await login(app, x);
    const full = await xa.post("/api/join").send({ token: link });
    expect(full.status).toBe(409);
    expect(full.body.error).toBe("limit_reached");
    const inv = await TeamInvite.findOne({ teamId: team._id, kind: "link" }).lean();
    expect(inv?.usedAt ?? null).toBeNull();
    await TeamMember.deleteOne({ teamId: team._id, customerId: filler[0]!._id });
    expect((await xa.post("/api/join").send({ token: link })).status).toBe(200);
  });

  it("email + link accepted at once by one customer: no 500, one membership", async () => {
    const a = await login(app, admin);
    await a.post("/api/teams/acme/invites").send({ kind: "email", email: x.email, role: "member" });
    const link = await makeLink(admin);
    const xa = await login(app, x);
    const inviteId = (await xa.get("/api/invites")).body[0].id as string;
    const [r1, r2] = await Promise.all([
      xa.post(`/api/invites/${inviteId}/accept`),
      xa.post("/api/join").send({ token: link }),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(await TeamMember.countDocuments({ teamId: team._id, customerId: x._id })).toBe(1);
  });
});

describe("concurrent creates of one slug", () => {
  it("return 201 + 409, never 500", async () => {
    const a = await login(app, owner);
    const [r1, r2] = await Promise.all([
      a.post("/api/teams/acme/components").send(bundle("dup", "acme")),
      a.post("/api/teams/acme/components").send(bundle("dup", "acme")),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    expect(await TeamComponent.countDocuments({ teamId: team._id, slug: "dup" })).toBe(1);
  });
});
