import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { CustomerDoc, TeamDoc } from "../src/models";
import { ApiToken, Customer, Team, TeamComponent, TeamInvite, TeamMember } from "../src/models";
import {
  addMember,
  bearer,
  bigBundle,
  bundle,
  createTeam,
  customer,
  login,
  publishPublic,
  reset,
  setup,
  teardown,
  token,
  type App,
} from "./helpers";

let app: App;
let cache: Awaited<ReturnType<typeof setup>>["cache"];
let teamA: TeamDoc;
let teamB: TeamDoc;
let ownerA: CustomerDoc;
let adminA: CustomerDoc;
let memberA: CustomerDoc;
let ownerB: CustomerDoc;
let outsider: CustomerDoc;
let blocked: CustomerDoc;
const SLUG = "pipeline-card";

/** Publishes `slug` in a team through the API, as `who` (must be admin+). */
async function publishIn(team: TeamDoc, who: CustomerDoc, slug: string, marker: string) {
  const agent = await login(app, who);
  const b = bundle(slug, team.slug, {
    files: [
      {
        path: `components/${team.slug}/${slug}.tsx`,
        content: `export function X() { return <div>${marker}</div>; }`,
      },
    ],
  });
  const created = await agent.post(`/api/teams/${team.slug}/components`).send(b);
  expect(created.status).toBe(201);
  const published = await agent.post(`/api/teams/${team.slug}/components/${slug}/publish`);
  expect(published.status).toBe(200);
  return agent;
}

async function seed() {
  await reset();
  ownerA = await customer({ email: "owner-a@example.com", plan: "premium" });
  adminA = await customer({ email: "admin-a@example.com" });
  memberA = await customer({ email: "member-a@example.com" });
  ownerB = await customer({ email: "owner-b@example.com" });
  outsider = await customer({ email: "outsider@example.com" });
  blocked = await customer({ email: "blocked@example.com" });
  teamA = await createTeam("acme", ownerA, "Acme");
  teamB = await createTeam("globex", ownerB, "Globex");
  await addMember(teamA, adminA, "admin");
  await addMember(teamA, memberA, "member");
  await addMember(teamA, blocked, "member");
  await publishPublic(SLUG, "premium");
  await publishIn(teamA, ownerA, SLUG, "TEAM_A_SOURCE");
  await publishIn(teamB, ownerB, SLUG, "TEAM_B_SOURCE");
}

beforeAll(async () => {
  ({ app, cache } = await setup());
});
afterAll(() => teardown(app));
beforeEach(seed);

const READ_ROUTES = (team: string, slug = SLUG) => [
  `/api/teams/${team}/components`,
  `/api/teams/${team}/components/${slug}`,
  `/api/teams/${team}/components/${slug}/preview`,
  `/api/teams/${team}/components/${slug}/copy`,
  `/api/teams/${team}/components/${slug}/prompt`,
  `/api/teams/${team}/components/${slug}/thumbnail`,
  `/api/teams/${team}/registry/${slug}`,
];
type Method = "post" | "put" | "patch" | "delete";
const WRITE_ROUTES = (team: string, slug = SLUG): [Method, string, object][] => [
  ["post", `/api/teams/${team}/validate`, bundle(slug, team)],
  ["post", `/api/teams/${team}/components`, bundle("other", team)],
  ["put", `/api/teams/${team}/components/${slug}`, bundle(slug, team)],
  ["post", `/api/teams/${team}/components/${slug}/publish`, {}],
  ["post", `/api/teams/${team}/components/${slug}/unpublish`, {}],
  ["delete", `/api/teams/${team}/components/${slug}`, {}],
  ["patch", `/api/teams/${team}`, { name: "Renamed" }],
  ["delete", `/api/teams/${team}`, { confirm: team }],
  ["post", `/api/teams/${team}/invites`, { kind: "link", role: "member" }],
  ["patch", `/api/teams/${team}/members/${"a".repeat(24)}`, { role: "admin" }],
  ["delete", `/api/teams/${team}/members/${"a".repeat(24)}`, {}],
];

describe("1. public catalogue never leaks team components", () => {
  it("list, detail and registry only ever return the public component", async () => {
    for (let round = 0; round < 2; round++) {
      // Round 1 warms the cache; round 2 runs against it after a fresh team publish.
      if (round === 1) await publishIn(teamA, ownerA, "second", "TEAM_A_SECOND");
      const premiumAgent = await login(app, ownerA);
      const list = await request(app).get("/api/components");
      expect(list.status).toBe(200);
      expect(list.body.map((c: { slug: string }) => c.slug)).toEqual([SLUG]);
      const detail = await premiumAgent.get(`/api/components/${SLUG}`);
      expect(detail.status).toBe(200);
      expect(detail.body.access).toBe("premium");
      expect(JSON.stringify(detail.body)).not.toContain("TEAM_A");
      const registry = await premiumAgent.get(`/api/registry/${SLUG}`);
      expect(registry.status).toBe(200);
      expect(JSON.stringify(registry.body)).toContain("public pipeline-card");
      expect(JSON.stringify(registry.body)).not.toContain("TEAM_");
      expect(await request(app).get("/api/components/second")).toMatchObject({ status: 404 });
    }
    expect(await cache.get("list")).toBeDefined();
  });
});

describe("2. cross-tenant matrix", () => {
  it("ownerB (cookie + personal token) gets 404 on all team-A read routes", async () => {
    const agent = await login(app, ownerB);
    const t = await token(ownerB);
    for (const url of READ_ROUTES("acme")) {
      expect((await agent.get(url)).status, url).toBe(404);
      expect((await request(app).get(url).set(bearer(t))).status, url).toBe(404);
    }
  });
  it("ownerB and outsider get 404 on every team-A write route; nothing changes", async () => {
    for (const who of [ownerB, outsider]) {
      const agent = await login(app, who);
      for (const [method, url, body] of WRITE_ROUTES("acme")) {
        const res = await agent[method](url).send(body);
        expect(res.status, `${who.email} ${method} ${url}`).toBe(404);
        expect(res.body.error).toBe("not_found");
      }
    }
    expect(await Team.countDocuments({ slug: "acme", name: "Acme" })).toBe(1);
    expect(await TeamComponent.countDocuments({ teamId: teamA._id, status: "published" })).toBe(1);
    expect(await TeamMember.countDocuments({ teamId: teamA._id })).toBe(4);
  });
  it("outsider gets 404 on team-A reads", async () => {
    const agent = await login(app, outsider);
    for (const url of READ_ROUTES("acme")) expect((await agent.get(url)).status, url).toBe(404);
  });
  it("anonymous gets 401 with identical bodies whether or not the team exists", async () => {
    const existing = await Promise.all(READ_ROUTES("acme").map((u) => request(app).get(u)));
    const missing = await Promise.all(READ_ROUTES("nope").map((u) => request(app).get(u)));
    for (let i = 0; i < existing.length; i++) {
      expect(existing[i]!.status).toBe(401);
      expect(missing[i]!.status).toBe(401);
      expect(existing[i]!.body).toEqual(missing[i]!.body);
      expect(existing[i]!.body.error).toBe("sign_in_required");
    }
  });
});

describe("3. IDOR: team-A ids under team-B URLs", () => {
  it("invite, job and member ids from A are 404 under B and A is unchanged", async () => {
    const a = await login(app, ownerA);
    const b = await login(app, ownerB);
    // A's invite
    const inv = await a.post("/api/teams/acme/invites").send({ kind: "link", role: "member" });
    expect(inv.status).toBe(201);
    const invite = await TeamInvite.findOne({ teamId: teamA._id }).lean();
    expect((await b.delete(`/api/teams/globex/invites/${invite!._id}`)).status).toBe(404);
    expect((await TeamInvite.findOne({ teamId: teamA._id }).lean())!.revokedAt).toBeFalsy();
    // A's member
    expect(
      (await b.patch(`/api/teams/globex/members/${memberA._id}`).send({ role: "admin" })).status,
    ).toBe(404);
    expect((await b.delete(`/api/teams/globex/members/${memberA._id}`)).status).toBe(404);
    expect(
      (await TeamMember.findOne({ teamId: teamA._id, customerId: memberA._id }).lean())!.role,
    ).toBe("member");
    // A's job (a big upload is queued)
    const queued = await a.post("/api/teams/acme/components").send(bigBundle("big", "acme"));
    expect(queued.status).toBe(202);
    expect((await b.get(`/api/teams/globex/jobs/${queued.body.jobId}`)).status).toBe(404);
    expect((await a.get(`/api/teams/acme/jobs/${queued.body.jobId}`)).status).toBe(200);
  });
});

describe("4. slug collision across teams", () => {
  it("each member only ever gets their own team's source (copy + registry)", async () => {
    const a = await login(app, memberA);
    const b = await login(app, ownerB);
    const ta = await token(memberA);
    const tb = await token(ownerB);
    for (const [agent, t, team, mine, theirs] of [
      [a, ta, "acme", "TEAM_A_SOURCE", "TEAM_B_SOURCE"],
      [b, tb, "globex", "TEAM_B_SOURCE", "TEAM_A_SOURCE"],
    ] as const) {
      const copy = await agent.get(`/api/teams/${team}/components/${SLUG}/copy`);
      expect(copy.status).toBe(200);
      expect(copy.text).toContain(mine);
      expect(copy.text).not.toContain(theirs);
      const reg = await request(app).get(`/api/teams/${team}/registry/${SLUG}`).set(bearer(t));
      expect(reg.status).toBe(200);
      expect(JSON.stringify(reg.body)).toContain(mine);
      expect(JSON.stringify(reg.body)).not.toContain(theirs);
      expect(JSON.stringify(reg.body)).not.toContain("public pipeline-card");
    }
  });
});

describe("5. team tokens", () => {
  it("a token scoped to A is 404 on B and cannot use the owner's premium plan", async () => {
    const t = await token(ownerA, teamA._id); // ownerA is premium
    expect((await request(app).get(`/api/teams/acme/registry/${SLUG}`).set(bearer(t))).status).toBe(
      200,
    );
    expect(
      (await request(app).get(`/api/teams/globex/registry/${SLUG}`).set(bearer(t))).status,
    ).toBe(404);
    const pub = await request(app).get(`/api/components/${SLUG}/copy`).set(bearer(t));
    expect(pub.status).toBe(401);
    expect(pub.body.error).toBe("token_scope");
    // The premium owner's personal token still works on public premium.
    const personal = await token(ownerA);
    expect(
      (await request(app).get(`/api/components/${SLUG}/copy`).set(bearer(personal))).status,
    ).toBe(200);
  });
  it("a personal token of memberA works on A", async () => {
    const t = await token(memberA);
    const res = await request(app).get(`/api/teams/acme/registry/${SLUG}`).set(bearer(t));
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(SLUG);
  });
});

describe("6. live revocation (the very next request)", () => {
  const allFor = async (agent: request.Agent | null, tokens: string[]) => {
    const out: number[] = [];
    if (agent) out.push((await agent.get(`/api/teams/acme/components/${SLUG}`)).status);
    for (const t of tokens)
      out.push((await request(app).get(`/api/teams/acme/registry/${SLUG}`).set(bearer(t))).status);
    return out;
  };
  it("removing memberA kills cookie, personal token and A-scoped token", async () => {
    const agent = await login(app, memberA);
    const personal = await token(memberA);
    const scoped = await token(memberA, teamA._id);
    expect(await allFor(agent, [personal, scoped])).toEqual([200, 200, 200]);
    const owner = await login(app, ownerA);
    expect((await owner.delete(`/api/teams/acme/members/${memberA._id}`)).status).toBe(200);
    // Scoped token is revoked (401 invalid_token); personal token is a non-member (404).
    expect(await allFor(agent, [personal, scoped])).toEqual([404, 404, 401]);
  });
  it("blocking the customer makes everything fail", async () => {
    const agent = await login(app, blocked);
    const personal = await token(blocked);
    expect(await allFor(agent, [personal])).toEqual([200, 200]);
    await Customer.updateOne({ _id: blocked._id }, { disabled: true });
    expect(await allFor(agent, [personal])).toEqual([401, 401]);
  });
  it("disabling team A gives 404 for everyone", async () => {
    const owner = await login(app, ownerA);
    const t = await token(ownerA);
    await Team.updateOne({ _id: teamA._id }, { disabled: true });
    expect(await allFor(owner, [t])).toEqual([404, 404]);
    expect((await owner.get("/api/teams/acme")).status).toBe(404);
  });
  it("deleting A gives 404 and its invites return 410", async () => {
    const owner = await login(app, ownerA);
    const inv = await owner.post("/api/teams/acme/invites").send({ kind: "link", role: "member" });
    const tokenA = (inv.body.url as string).split("#")[1]!;
    expect((await owner.delete("/api/teams/acme").send({ confirm: "acme" })).status).toBe(200);
    expect(await allFor(owner, [await token(ownerA)])).toEqual([404, 404]);
    const joiner = await login(app, outsider);
    expect((await joiner.post("/api/join/inspect").send({ token: tokenA })).status).toBe(410);
    expect((await joiner.post("/api/join").send({ token: tokenA })).status).toBe(410);
    expect(await TeamComponent.countDocuments({ teamId: teamA._id })).toBe(0);
    expect(await TeamMember.countDocuments({ teamId: teamA._id })).toBe(0);
    expect(await ApiToken.countDocuments({ teamId: teamA._id })).toBe(0);
  });
  it("demoting an admin to member makes publish return 403", async () => {
    const admin = await login(app, adminA);
    expect((await admin.post(`/api/teams/acme/components/${SLUG}/publish`)).status).toBe(200);
    const owner = await login(app, ownerA);
    expect(
      (await owner.patch(`/api/teams/acme/members/${adminA._id}`).send({ role: "member" })).status,
    ).toBe(200);
    const res = await admin.post(`/api/teams/acme/components/${SLUG}/publish`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("team_role_required");
  });
});

describe("7. bearer tokens cannot write", () => {
  it("every write route with a bearer token and no cookie gives 401", async () => {
    const t = await token(ownerA);
    for (const [method, url, body] of WRITE_ROUTES("acme")) {
      const res = await request(app)[method](url).set(bearer(t)).send(body);
      expect(res.status, `${method} ${url}`).toBe(401);
    }
    for (const [method, url, body] of [
      ["post", "/api/teams", { name: "New team", slug: "new-team" }],
      ["post", "/api/join", { token: `kbi_${"a".repeat(43)}` }],
      ["post", "/api/join/inspect", { token: `kbi_${"a".repeat(43)}` }],
      ["post", `/api/invites/${"a".repeat(24)}/accept`, {}],
      ["post", "/api/tokens", { name: "x", team: "acme" }],
    ] as [Method, string, object][]) {
      expect((await request(app)[method](url).set(bearer(t)).send(body)).status, url).toBe(401);
    }
  });
  it("a cookie POST with a foreign Origin gives 403 bad_origin", async () => {
    const owner = await login(app, ownerA);
    const res = await owner
      .post("/api/teams/acme/invites")
      .set("Origin", "https://evil.example")
      .send({ kind: "link", role: "member" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("bad_origin");
  });
});

describe("8. guard and headers", () => {
  it("an unscoped TeamComponent query throws", async () => {
    await expect(TeamComponent.find({}).exec()).rejects.toThrow(/unscoped team query/);
    await expect(
      TeamComponent.updateOne({ slug: SLUG }, { status: "draft" }).exec(),
    ).rejects.toThrow(/unscoped team query/);
    await expect(TeamComponent.countDocuments({ status: "published" }).exec()).rejects.toThrow(
      /unscoped team query/,
    );
    await expect(TeamInvite.find({ kind: "link" }).exec()).rejects.toThrow(/unscoped team query/);
  });
  it("only teamRepo.ts imports TeamComponent", () => {
    const src = path.resolve(__dirname, "../src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(name)) files.push(p);
      }
    };
    walk(src);
    const importers = files.filter((f) => {
      const text = readFileSync(f, "utf8");
      // Import statements only; the model definition and type names do not count.
      return /import\s*\{[^}]*\bTeamComponent\b[^}]*\}\s*from/.test(text);
    });
    expect(importers.map((f) => path.relative(src, f).replace(/\\/g, "/"))).toEqual([
      "services/teamRepo.ts",
    ]);
  });
  it("every team response has Cache-Control: no-store; thumbnails are sandboxed", async () => {
    const owner = await login(app, ownerA);
    const t = await token(memberA);
    const responses = [
      await owner.get("/api/teams"),
      await owner.get("/api/teams/acme"),
      await owner.get("/api/teams/acme/members"),
      await owner.get("/api/teams/acme/invites"),
      await owner.get(`/api/teams/acme/components/${SLUG}/draft`),
      await request(app).get(`/api/teams/acme/components/${SLUG}/copy`).set(bearer(t)),
      await request(app).get(`/api/teams/acme/components/${SLUG}`),
      await request(app).get(`/api/teams/globex/components/${SLUG}`).set(bearer(t)),
    ];
    for (const res of responses) expect(res.headers["cache-control"]).toBe("no-store");
    for (const url of [
      `/api/teams/acme/components/${SLUG}/thumbnail`,
      `/api/components/${SLUG}/thumbnail`,
    ]) {
      const res = await owner.get(url);
      expect(res.status, url).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["content-security-policy"]).toBe("sandbox");
      expect(res.headers["content-type"]).toMatch(/^image\/(png|webp|svg\+xml)/);
    }
    // Team thumbnails never serve SVG uploads: an SVG-only bundle is rejected on upload.
    const svg = bundle("svg-thumb", "acme", { thumbnail: "data:image/svg+xml;base64,PHN2Zy8+" });
    const res = await owner.post("/api/teams/acme/components").send(svg);
    expect(res.status).toBe(422);
    expect(res.body.details.join()).toMatch(/SVG/);
  });
});
