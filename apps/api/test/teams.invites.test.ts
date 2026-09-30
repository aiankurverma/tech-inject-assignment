import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CustomerDoc, TeamDoc } from "../src/models";
import { TeamInvite, TeamMember } from "../src/models";
import { sha256 } from "../src/middleware/auth";
import {
  addMember,
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
let joiner: CustomerDoc;
let other: CustomerDoc;

beforeAll(async () => {
  ({ app } = await setup());
});
afterAll(() => teardown(app));
beforeEach(async () => {
  await reset();
  owner = await customer({ email: "owner@example.com" });
  admin = await customer({ email: "admin@example.com" });
  joiner = await customer({ email: "joiner@example.com" });
  other = await customer({ email: "other@example.com" });
  team = await createTeam("acme", owner, "Acme");
  await addMember(team, admin, "admin");
});

async function makeLink(who: CustomerDoc, body: Record<string, unknown> = {}) {
  const agent = await login(app, who);
  const res = await agent
    .post("/api/teams/acme/invites")
    .send({ kind: "link", role: "member", ...body });
  expect(res.status).toBe(201);
  expect(res.body.url).toMatch(/^http:\/\/localhost:4000\/join#kbi_/);
  return { token: (res.body.url as string).split("#")[1]!, agent };
}

describe("link invites", () => {
  it("inspect shows the team, join works once, then 410", async () => {
    const { token } = await makeLink(admin);
    const j = await login(app, joiner);
    const inspect = await j.post("/api/join/inspect").send({ token });
    expect(inspect.status).toBe(200);
    expect(inspect.body).toEqual({ team: { name: "Acme", slug: "acme" }, role: "member" });
    const join = await j.post("/api/join").send({ token });
    expect(join.status).toBe(200);
    expect(join.body).toMatchObject({ ok: true, team: "acme", already: false });
    expect((await j.get("/api/teams/acme")).body.role).toBe("member");
    const again = await login(app, other);
    expect((await again.post("/api/join").send({ token })).status).toBe(410);
    expect((await again.post("/api/join/inspect").send({ token })).status).toBe(410);
  });
  it("two concurrent joins produce exactly one success and one 410", async () => {
    const { token } = await makeLink(admin);
    const a = await login(app, joiner);
    const b = await login(app, other);
    const [ra, rb] = await Promise.all([
      a.post("/api/join").send({ token }),
      b.post("/api/join").send({ token }),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([200, 410]);
    expect(await TeamMember.countDocuments({ teamId: team._id })).toBe(3);
  });
  it("expired and revoked links fail", async () => {
    const { token, agent } = await makeLink(admin);
    const j = await login(app, joiner);
    const invite = await TeamInvite.findOne({ teamId: team._id }).lean();
    await TeamInvite.updateOne(
      { _id: invite!._id, teamId: team._id },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    expect((await j.post("/api/join").send({ token })).status).toBe(410);
    // Revoked
    const { token: token2 } = await makeLink(admin);
    const pending = (await agent.get("/api/teams/acme/invites")).body;
    expect(pending).toHaveLength(1);
    expect(pending[0]).not.toHaveProperty("tokenHash");
    expect((await agent.delete(`/api/teams/acme/invites/${pending[0].id}`)).status).toBe(200);
    expect((await j.post("/api/join").send({ token: token2 })).status).toBe(410);
    expect((await agent.get("/api/teams/acme/invites")).body).toHaveLength(0);
  });
  it("a link locked to one email rejects any other account", async () => {
    const { token } = await makeLink(admin, { email: "Joiner@example.com" });
    const o = await login(app, other);
    expect((await o.post("/api/join/inspect").send({ token })).status).toBe(410);
    expect((await o.post("/api/join").send({ token })).status).toBe(410);
    // The wrong account must not have consumed it.
    expect((await TeamInvite.findOne({ teamId: team._id }).lean())!.usedAt).toBeFalsy();
    const j = await login(app, joiner);
    expect((await j.post("/api/join").send({ token })).status).toBe(200);
  });
  it("fails after its creator is demoted", async () => {
    const { token } = await makeLink(admin);
    const o = await login(app, owner);
    expect(
      (await o.patch(`/api/teams/acme/members/${admin._id}`).send({ role: "member" })).status,
    ).toBe(200);
    const j = await login(app, joiner);
    expect((await j.post("/api/join").send({ token })).status).toBe(410);
    expect(await TeamMember.countDocuments({ teamId: team._id, customerId: joiner._id })).toBe(0);
  });
  it("stores only the hash", async () => {
    const { token } = await makeLink(admin);
    const docs = await TeamInvite.find({ teamId: team._id }).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(docs)).not.toContain(token);
  });
  it("accepting when already a member is a no-op (but keeps the higher role)", async () => {
    const { token } = await makeLink(admin, { role: "admin" });
    await addMember(team, joiner, "member");
    const j = await login(app, joiner);
    const res = await j.post("/api/join").send({ token });
    expect(res.status).toBe(200);
    expect(res.body.already).toBe(true);
    expect(
      (await TeamMember.findOne({ teamId: team._id, customerId: joiner._id }).lean())!.role,
    ).toBe("admin");
    expect(await TeamMember.countDocuments({ teamId: team._id })).toBe(3);
  });
  it("rejects malformed tokens without touching the DB", async () => {
    const j = await login(app, joiner);
    expect((await j.post("/api/join").send({ token: "kbi_short" })).status).toBe(400);
    expect((await j.post("/api/join").send({})).status).toBe(400);
  });
});

describe("email invites", () => {
  it("unknown and known emails both return 201 {ok:true}", async () => {
    const a = await login(app, admin);
    const known = await a
      .post("/api/teams/acme/invites")
      .send({ kind: "email", email: "joiner@example.com", role: "member" });
    const unknown = await a
      .post("/api/teams/acme/invites")
      .send({ kind: "email", email: "nobody@example.com", role: "member" });
    expect(known.status).toBe(201);
    expect(unknown.status).toBe(201);
    expect(known.body).toEqual(unknown.body);
  });
  it("only the matching customer sees and accepts it; others get 404", async () => {
    const a = await login(app, admin);
    await a
      .post("/api/teams/acme/invites")
      .send({ kind: "email", email: "JOINER@example.com", role: "admin" });
    const o = await login(app, other);
    expect((await o.get("/api/invites")).body).toEqual([]);
    const j = await login(app, joiner);
    const mine = (await j.get("/api/invites")).body;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ role: "admin", team: { slug: "acme", name: "Acme" } });
    expect((await o.post(`/api/invites/${mine[0].id}/accept`)).status).toBe(404);
    expect((await o.post(`/api/invites/${mine[0].id}/decline`)).status).toBe(404);
    const accept = await j.post(`/api/invites/${mine[0].id}/accept`);
    expect(accept.status).toBe(200);
    expect((await j.get("/api/teams/acme")).body.role).toBe("admin");
    expect((await j.post(`/api/invites/${mine[0].id}/accept`)).status).toBe(404);
    expect((await j.get("/api/invites")).body).toEqual([]);
  });
  it("decline works and the invite disappears", async () => {
    const a = await login(app, admin);
    await a
      .post("/api/teams/acme/invites")
      .send({ kind: "email", email: "joiner@example.com", role: "member" });
    const j = await login(app, joiner);
    const [inv] = (await j.get("/api/invites")).body;
    expect((await j.post(`/api/invites/${inv.id}/decline`)).status).toBe(200);
    expect((await j.get("/api/invites")).body).toEqual([]);
    expect((await j.post(`/api/invites/${inv.id}/accept`)).status).toBe(404);
    expect(await TeamMember.countDocuments({ teamId: team._id, customerId: joiner._id })).toBe(0);
    expect((await a.get("/api/teams/acme/invites")).body).toEqual([]);
  });
  it("pending list shows prefix and email only", async () => {
    const a = await login(app, admin);
    await a
      .post("/api/teams/acme/invites")
      .send({ kind: "email", email: "joiner@example.com", role: "member" });
    const [row] = (await a.get("/api/teams/acme/invites")).body;
    expect(Object.keys(row).sort()).toEqual([
      "createdAt",
      "email",
      "expiresAt",
      "id",
      "kind",
      "prefix",
      "role",
    ]);
    expect(row.prefix).toMatch(/^kbi_/);
  });
});
