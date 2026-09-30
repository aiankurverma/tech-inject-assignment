import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CustomerDoc, TeamDoc } from "../src/models";
import { TeamInvite, TeamMember } from "../src/models";
import { TEAM_LIMITS } from "../src/services/teamRepo";
import {
  addMember,
  bundle,
  createTeam,
  customer,
  login,
  reset,
  setup,
  teardown,
  type App,
} from "./helpers";

let app: App;
let team: TeamDoc;
let owner: CustomerDoc;
let admin: CustomerDoc;
let member: CustomerDoc;

beforeAll(async () => {
  ({ app } = await setup());
});
afterAll(() => teardown(app));
beforeEach(async () => {
  await reset();
  owner = await customer({ email: "owner@example.com" });
  admin = await customer({ email: "admin@example.com" });
  member = await customer({ email: "member@example.com" });
  team = await createTeam("acme", owner, "Acme");
  await addMember(team, admin, "admin");
  await addMember(team, member, "member");
});

describe("member role", () => {
  it("gets 403 on upload, publish, invite and draft preview", async () => {
    const m = await login(app, member);
    const checks = [
      m.post("/api/teams/acme/components").send(bundle("card", "acme")),
      m.post("/api/teams/acme/components/card/publish"),
      m.post("/api/teams/acme/invites").send({ kind: "link", role: "member" }),
      m.get("/api/teams/acme/components/card/draft-preview"),
      m.get("/api/teams/acme/components/card/draft"),
      m.get("/api/teams/acme/invites"),
      m.patch("/api/teams/acme").send({ name: "Nope" }),
    ];
    for (const res of await Promise.all(checks)) {
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("team_role_required");
    }
    // But they can read the team and its members.
    expect((await m.get("/api/teams/acme")).body.role).toBe("member");
    expect((await m.get("/api/teams/acme/members")).status).toBe(200);
  });
  it("sees only published components, never drafts", async () => {
    const a = await login(app, admin);
    expect(
      (await a.post("/api/teams/acme/components").send(bundle("draft-only", "acme"))).status,
    ).toBe(201);
    const m = await login(app, member);
    expect((await m.get("/api/teams/acme/components")).body).toEqual([]);
    expect((await m.get("/api/teams/acme/components/draft-only")).status).toBe(404);
    expect((await m.get("/api/teams/acme/components/draft-only/copy")).status).toBe(404);
    // Admins see the draft row in the list.
    const rows = (await a.get("/api/teams/acme/components")).body;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("draft");
  });
});

describe("admin role", () => {
  it("cannot grant owner, remove an owner, or demote an owner", async () => {
    const a = await login(app, admin);
    const grant = await a.patch(`/api/teams/acme/members/${member._id}`).send({ role: "owner" });
    expect(grant.status).toBe(403);
    const remove = await a.delete(`/api/teams/acme/members/${owner._id}`);
    expect(remove.status).toBe(403);
    const demote = await a.patch(`/api/teams/acme/members/${owner._id}`).send({ role: "member" });
    expect(demote.status).toBe(403);
    expect(await TeamMember.countDocuments({ teamId: team._id, role: "owner" })).toBe(1);
  });
  it("can switch member <-> admin and remove members", async () => {
    const a = await login(app, admin);
    expect(
      (await a.patch(`/api/teams/acme/members/${member._id}`).send({ role: "admin" })).status,
    ).toBe(200);
    expect(
      (await a.patch(`/api/teams/acme/members/${member._id}`).send({ role: "member" })).status,
    ).toBe(200);
    expect((await a.delete(`/api/teams/acme/members/${member._id}`)).status).toBe(200);
    expect(await TeamMember.countDocuments({ teamId: team._id })).toBe(2);
  });
  it("invites follow canInviteRole (never owner)", async () => {
    const a = await login(app, admin);
    expect(
      (await a.post("/api/teams/acme/invites").send({ kind: "link", role: "member" })).status,
    ).toBe(201);
    expect(
      (await a.post("/api/teams/acme/invites").send({ kind: "link", role: "admin" })).status,
    ).toBe(201);
    const asOwner = await a.post("/api/teams/acme/invites").send({ kind: "link", role: "owner" });
    expect(asOwner.status).toBe(400); // not even a valid role for an invite
    const o = await login(app, owner);
    expect(
      (await o.post("/api/teams/acme/invites").send({ kind: "link", role: "owner" })).status,
    ).toBe(400);
  });
});

describe("owner role", () => {
  it("the last owner cannot leave or be demoted (409)", async () => {
    const o = await login(app, owner);
    const leave = await o.delete(`/api/teams/acme/members/${owner._id}`);
    expect(leave.status).toBe(409);
    expect(leave.body.error).toBe("last_owner");
    const demote = await o.patch(`/api/teams/acme/members/${owner._id}`).send({ role: "admin" });
    expect(demote.status).toBe(409);
    expect(
      (await TeamMember.findOne({ teamId: team._id, customerId: owner._id }).lean())!.role,
    ).toBe("owner");
  });
  it("a second owner lets the first leave", async () => {
    const o = await login(app, owner);
    expect(
      (await o.patch(`/api/teams/acme/members/${admin._id}`).send({ role: "owner" })).status,
    ).toBe(200);
    expect((await o.delete(`/api/teams/acme/members/${owner._id}`)).status).toBe(200);
    expect((await o.get("/api/teams/acme")).status).toBe(404);
  });
  it("a plain member can leave", async () => {
    const m = await login(app, member);
    expect((await m.delete(`/api/teams/acme/members/${member._id}`)).status).toBe(200);
    expect((await m.get("/api/teams/acme")).status).toBe(404);
  });
});

describe("limits and duplicates", () => {
  it("a duplicate member is rejected by the unique index", async () => {
    await expect(
      TeamMember.create({ teamId: team._id, customerId: member._id, role: "member" }),
    ).rejects.toThrow(/E11000|duplicate/);
  });
  it("owned-team limit", async () => {
    const o = await login(app, owner);
    for (let i = 1; i < TEAM_LIMITS.ownedTeamsPerCustomer; i++) {
      expect(
        (await o.post("/api/teams").send({ name: `Team ${i}`, slug: `team-${i}` })).status,
      ).toBe(201);
    }
    const over = await o.post("/api/teams").send({ name: "One more", slug: "one-more" });
    expect(over.status).toBe(409);
    expect(over.body.error).toBe("limit_reached");
    const taken = await login(app, member);
    const dup = await taken.post("/api/teams").send({ name: "Acme again", slug: "acme" });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe("slug_taken");
  });
  it("component limit", async () => {
    const a = await login(app, admin);
    for (let i = 0; i < TEAM_LIMITS.componentsPerTeam; i++) {
      // Seed directly through the API would be slow at 100; use the scoped repo route once each.
      const res = await a.post("/api/teams/acme/components").send(bundle(`c-${i}`, "acme"));
      expect(res.status).toBe(201);
    }
    const over = await a.post("/api/teams/acme/components").send(bundle("c-over", "acme"));
    expect(over.status).toBe(409);
    expect(over.body.error).toBe("limit_reached");
  }, 60_000);
  it("invite limit", async () => {
    const a = await login(app, admin);
    for (let i = 0; i < TEAM_LIMITS.activeInvitesPerTeam; i++) {
      expect(
        (await a.post("/api/teams/acme/invites").send({ kind: "link", role: "member" })).status,
      ).toBe(201);
    }
    const over = await a
      .post("/api/teams/acme/invites")
      .send({ kind: "email", email: "x@example.com", role: "member" });
    expect(over.status).toBe(409);
    expect(over.body.error).toBe("limit_reached");
    expect(await TeamInvite.countDocuments({ teamId: team._id })).toBe(
      TEAM_LIMITS.activeInvitesPerTeam,
    );
  });
  it("team-token limit per member per team", async () => {
    const m = await login(app, member);
    for (let i = 0; i < TEAM_LIMITS.teamTokensPerMember; i++) {
      expect((await m.post("/api/tokens").send({ name: `t${i}`, team: "acme" })).status).toBe(201);
    }
    const over = await m.post("/api/tokens").send({ name: "over", team: "acme" });
    expect(over.status).toBe(409);
    // A non-member cannot create a token for the team at all.
    const outsider = await login(app, await customer());
    expect((await outsider.post("/api/tokens").send({ name: "x", team: "acme" })).status).toBe(404);
    // Token list shows the scope.
    const list = await m.get("/api/tokens");
    expect(list.body.every((t: { team: string }) => t.team === "acme")).toBe(true);
  });
});
