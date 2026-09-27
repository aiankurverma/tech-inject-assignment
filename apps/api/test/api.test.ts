import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCache } from "@ti/cache";
import { createApp } from "../src/app";
import { loadEnv } from "../src/config/env";
import { ApiToken, ComponentModel, Customer, RefreshToken } from "../src/models";
import { loadTheme } from "../src/services/theme";

const run = promisify(execFile);
const CLI = fileURLToPath(new URL("../../../packages/cli/bin/kitbase.js", import.meta.url));

const env = loadEnv({
  NODE_ENV: "test",
  MONGODB_URI: process.env.TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27017/kitbase_test",
  JWT_SECRET: "test-secret-test-secret-test-secret-123456",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "admin-password-123",
  PUBLIC_ORIGIN: "http://localhost:4000",
});
const cache = createCache({ redis: null, prefix: "test:", defaultTtlSeconds: 60 });
const app = createApp(env, loadTheme(), { cache });

const bundle = (over: Record<string, unknown> = {}) => ({
  name: "Deal Card",
  slug: "deal-card",
  description: "Premium deal summary card for tests.",
  category: "Data display",
  version: "1.0.0",
  access: "premium",
  dependencies: [],
  files: [
    {
      path: "components/crm/deal-card.tsx",
      content:
        'import { cn } from "@/lib/utils";\nexport function DealCard() { return <div className={cn("p-2")}>SECRET_PREMIUM_SOURCE</div>; }\n',
    },
  ],
  examples: [
    {
      title: "Default",
      code: 'import { DealCard } from "@/components/crm/deal-card";\nexport default function E() { return <DealCard />; }\n',
    },
  ],
  ...over,
});

const admin = request.agent(app);
async function loginCustomer(email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "password-123" }).expect(200);
  return agent;
}

beforeAll(async () => {
  await mongoose.connect(env.MONGODB_URI);
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
beforeEach(async () => {
  await cache.delPrefix("");
  await Promise.all([
    ComponentModel.deleteMany({}),
    Customer.deleteMany({}),
    ApiToken.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);
  const passwordHash = await bcrypt.hash("password-123", 4);
  await Customer.create([
    { email: "free@test.dev", name: "Free", passwordHash, plan: "free" },
    { email: "premium@test.dev", name: "Premium", passwordHash, plan: "premium" },
  ]);
  await admin
    .post("/api/admin/login")
    .send({ username: "admin", password: "admin-password-123" })
    .expect(200);
});

async function createAndPublish(b = bundle()) {
  await admin.post("/api/admin/components").send(b).expect(201);
  await admin.post(`/api/admin/components/${b.slug}/publish`).expect(200);
}

describe("admin protection", () => {
  it("rejects anonymous and customer calls to admin APIs", async () => {
    const free = await loginCustomer("free@test.dev");
    const premium = await loginCustomer("premium@test.dev");
    for (const agent of [request(app), free, premium]) {
      await agent.get("/api/admin/components").expect(401);
      await agent.post("/api/admin/components").send(bundle()).expect(401);
      await agent
        .post("/api/admin/customers/000000000000000000000000/plan")
        .send({ plan: "premium" })
        .expect(401);
    }
    expect(await ComponentModel.countDocuments()).toBe(0);
  });

  it("customers cannot upgrade themselves", async () => {
    const free = await loginCustomer("free@test.dev");
    const me = await Customer.findOne({ email: "free@test.dev" });
    await free.post(`/api/admin/customers/${me!._id}/plan`).send({ plan: "premium" }).expect(401);
    await free
      .post("/api/auth/login")
      .send({ email: "free@test.dev", password: "password-123", plan: "premium" })
      .expect(200);
    await free
      .get("/api/auth/me")
      .expect(200)
      .expect((r) => expect(r.body.plan).toBe("free"));
  });

  it("wrong admin password fails and cross-site writes are blocked", async () => {
    await request(app)
      .post("/api/admin/login")
      .send({ username: "admin", password: "nope" })
      .expect(401);
    await admin
      .post("/api/admin/components")
      .set("Origin", "https://evil.example")
      .send(bundle())
      .expect(403);
  });
});

describe("publishing", () => {
  it("rejects invalid uploads with readable errors", async () => {
    const res = await admin
      .post("/api/admin/components")
      .send(bundle({ slug: "Bad Slug", files: [{ path: "../x.tsx", content: "x" }] }))
      .expect(422);
    expect(res.body.details.join(" ")).toMatch(/slug/);
    expect(res.body.details.join(" ")).toMatch(/path/);
    const bad = bundle({
      files: [{ path: "components/crm/deal-card.tsx", content: 'import fs from "fs";' }],
    });
    await admin.post("/api/admin/components").send(bad).expect(422);
  });

  it("drafts are private; publish makes them visible; unpublish hides them everywhere", async () => {
    const free = bundle({ access: "free", slug: "draft-card" });
    await admin.post("/api/admin/components").send(free).expect(201);
    const premium = await loginCustomer("premium@test.dev");
    for (const agent of [request(app), premium]) {
      await agent
        .get("/api/components")
        .expect(200)
        .expect((r) => expect(r.body).toEqual([]));
      for (const p of ["", "/preview", "/copy", "/prompt", "/thumbnail"])
        await agent.get(`/api/components/draft-card${p}`).expect(404);
      await agent.get("/api/registry/draft-card").expect(404);
    }

    await admin.post("/api/admin/components/draft-card/publish").expect(200);
    await request(app)
      .get("/api/components")
      .expect((r) => expect(r.body.map((c: { slug: string }) => c.slug)).toEqual(["draft-card"]));
    await request(app).get("/api/registry/draft-card").expect(200);

    await admin.post("/api/admin/components/draft-card/unpublish").expect(200);
    await request(app)
      .get("/api/components")
      .expect((r) => expect(r.body).toEqual([]));
    await request(app).get("/api/components/draft-card").expect(404);
    await request(app).get("/api/registry/draft-card").expect(404);
    await premium.get("/api/components/draft-card/copy").expect(404);
  });

  it("editing a draft does not change the published version until publish", async () => {
    await createAndPublish(bundle({ access: "free" }));
    const v2 = bundle({ access: "free", version: "2.0.0" });
    v2.files = [
      {
        path: "components/crm/deal-card.tsx",
        content: "export function DealCard() { return <div>v2</div>; }\n",
      },
    ];
    await admin.put("/api/admin/components/deal-card").send(v2).expect(200);
    await request(app)
      .get("/api/registry/deal-card")
      .expect((r) => expect(r.body.version).toBe("1.0.0"));
    await admin.post("/api/admin/components/deal-card/publish").expect(200);
    await request(app)
      .get("/api/registry/deal-card")
      .expect((r) => expect(r.body.version).toBe("2.0.0"));
  });

  it("preview, copy code, installer and prompt all use the same published source", async () => {
    await createAndPublish(bundle({ access: "free" }));
    const src = bundle().files[0]!.content;
    const [detail, preview, copy, registry, prompt] = await Promise.all(
      ["", "/preview", "/copy", "", "/prompt"].map((p, i) =>
        request(app).get(i === 3 ? "/api/registry/deal-card" : `/api/components/deal-card${p}`),
      ),
    );
    expect(
      detail!.body.files.find((f: { path: string }) => f.path.endsWith("deal-card.tsx")).content,
    ).toBe(src);
    expect(
      preview!.body.files.find((f: { path: string }) => f.path.endsWith("deal-card.tsx")).content,
    ).toBe(src);
    expect(
      registry!.body.files.find((f: { path: string }) => f.path.endsWith("deal-card.tsx")).content,
    ).toBe(src);
    expect(copy!.text).toContain(src.trimEnd());
    expect(prompt!.text).toContain("add deal-card");
    expect(registry!.body.version).toBe(detail!.body.version);
  });
});

describe("premium access", () => {
  beforeEach(() => createAndPublish());
  const protectedPaths = [
    "/api/components/deal-card/preview",
    "/api/components/deal-card/copy",
    "/api/components/deal-card/prompt",
    "/api/registry/deal-card",
  ];

  it("signed-out visitors get metadata + thumbnail only", async () => {
    const d = await request(app).get("/api/components/deal-card").expect(200);
    expect(d.body.locked).toBe("sign_in_required");
    expect(JSON.stringify(d.body)).not.toContain("SECRET_PREMIUM_SOURCE");
    await request(app).get("/api/components/deal-card/thumbnail").expect(200);
    for (const p of protectedPaths) await request(app).get(p).expect(401);
  });

  it("free customers are locked out with premium_required", async () => {
    const free = await loginCustomer("free@test.dev");
    const d = await free.get("/api/components/deal-card").expect(200);
    expect(d.body.locked).toBe("premium_required");
    for (const p of protectedPaths) {
      const r = await free.get(p).expect(403);
      expect(JSON.stringify(r.body)).not.toContain("SECRET_PREMIUM_SOURCE");
    }
  });

  it("grant gives access, revoke removes it on the next request (session and token)", async () => {
    const user = await loginCustomer("free@test.dev");
    const { body } = await user.post("/api/tokens").send({ name: "cli" }).expect(201);
    const bearer = { authorization: `Bearer ${body.token}` };
    await request(app).get("/api/registry/deal-card").set(bearer).expect(403);

    const id = (await Customer.findOne({ email: "free@test.dev" }))!._id;
    await admin.post(`/api/admin/customers/${id}/plan`).send({ plan: "premium" }).expect(200);
    for (const p of protectedPaths) await user.get(p).expect(200);
    await request(app).get("/api/registry/deal-card").set(bearer).expect(200);

    await admin.post(`/api/admin/customers/${id}/plan`).send({ plan: "free" }).expect(200);
    for (const p of protectedPaths) await user.get(p).expect(403);
    await request(app).get("/api/registry/deal-card").set(bearer).expect(403);
    // Free components keep working.
    await createAndPublish(bundle({ slug: "free-card", access: "free" }));
    await user.get("/api/registry/free-card").expect(200);
  });

  it("revoked and fake tokens are rejected", async () => {
    const user = await loginCustomer("premium@test.dev");
    const { body } = await user.post("/api/tokens").send({ name: "cli" }).expect(201);
    await request(app)
      .get("/api/registry/deal-card")
      .set("authorization", `Bearer ${body.token}`)
      .expect(200);
    await user.delete(`/api/tokens/${body.id}`).expect(200);
    await request(app)
      .get("/api/registry/deal-card")
      .set("authorization", `Bearer ${body.token}`)
      .expect(401);
    await request(app)
      .get("/api/registry/deal-card")
      .set("authorization", "Bearer ti_fake")
      .expect(401);
  });

  it("premium responses are never cacheable", async () => {
    const premium = await loginCustomer("premium@test.dev");
    const r = await premium.get("/api/registry/deal-card").expect(200);
    expect(r.headers["cache-control"]).toBe("no-store");
  });
});

describe("CLI installer (end to end)", () => {
  let server: Server;
  let api: string;
  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    const addr = server.address();
    api = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const project = () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ti-consumer-"));
    writeFileSync(path.join(dir, "package.json"), "{}");
    return dir;
  };
  const cli = (cwd: string, args: string[], extraEnv: Record<string, string> = {}) =>
    run(process.execPath, [CLI, "add", ...args, "--api", api], {
      cwd,
      env: { ...process.env, KITBASE_TOKEN: "", ...extraEnv },
    });

  it("installs a free component into src/", async () => {
    await createAndPublish(bundle({ access: "free" }));
    const dir = project();
    const { stdout } = await cli(dir, ["deal-card"]);
    expect(stdout).toContain("created");
    expect(readFileSync(path.join(dir, "src/components/crm/deal-card.tsx"), "utf8")).toContain(
      "SECRET_PREMIUM_SOURCE",
    );
    expect(existsSync(path.join(dir, "src/styles/crm-theme.css"))).toBe(true);
    expect(existsSync(path.join(dir, "src/lib/utils.ts"))).toBe(true);
  });

  it("does not overwrite changed files unless --overwrite", async () => {
    await createAndPublish(bundle({ access: "free" }));
    const dir = project();
    const target = path.join(dir, "src/components/crm/deal-card.tsx");
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, "// my edits");
    await expect(cli(dir, ["deal-card"])).rejects.toMatchObject({ code: 2 });
    expect(readFileSync(target, "utf8")).toBe("// my edits");
    await cli(dir, ["deal-card", "--overwrite"]);
    expect(readFileSync(target, "utf8")).toContain("DealCard");
  });

  it("fails clearly for premium without a token, works with a premium token", async () => {
    await createAndPublish();
    const dir = project();
    await expect(cli(dir, ["deal-card"])).rejects.toMatchObject({
      stderr: expect.stringMatching(/premium|KITBASE_TOKEN/i),
    });
    expect(existsSync(path.join(dir, "src"))).toBe(false);

    const user = await loginCustomer("premium@test.dev");
    const { body } = await user.post("/api/tokens").send({ name: "cli" }).expect(201);
    await cli(dir, ["deal-card"], { KITBASE_TOKEN: body.token });
    expect(existsSync(path.join(dir, "src/components/crm/deal-card.tsx"))).toBe(true);
  });

  it("refuses registry responses with unsafe paths", async () => {
    await createAndPublish(bundle({ access: "free" }));
    // Simulate a tampered record that bypassed validation.
    await ComponentModel.updateOne(
      { slug: "deal-card" },
      { "published.files": [{ path: "../../evil.tsx", content: "x" }] },
    );
    const dir = project();
    await expect(cli(dir, ["deal-card"])).rejects.toMatchObject({
      stderr: expect.stringMatching(/unsafe/i),
    });
    expect(existsSync(path.join(dir, "..", "evil.tsx"))).toBe(false);
  });
});

describe("privileges: customer enable/disable and component delete", () => {
  it("disabling a customer blocks login, the live session and tokens; enabling restores", async () => {
    await createAndPublish();
    const user = await loginCustomer("premium@test.dev");
    const { body } = await user.post("/api/tokens").send({ name: "cli" }).expect(201);
    const id = (await Customer.findOne({ email: "premium@test.dev" }))!._id;

    await user.post(`/api/admin/customers/${id}/status`).send({ disabled: true }).expect(401);
    await admin.post(`/api/admin/customers/${id}/status`).send({ disabled: true }).expect(200);
    await user.get("/api/components/deal-card/copy").expect(401);
    await request(app)
      .get("/api/registry/deal-card")
      .set("authorization", `Bearer ${body.token}`)
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ email: "premium@test.dev", password: "password-123" })
      .expect(403);

    await admin.post(`/api/admin/customers/${id}/status`).send({ disabled: false }).expect(200);
    await user.get("/api/components/deal-card/copy").expect(200);
  });

  it("admin can delete a component; customers cannot", async () => {
    await createAndPublish(bundle({ access: "free" }));
    const premium = await loginCustomer("premium@test.dev");
    await premium.delete("/api/admin/components/deal-card").expect(401);
    await admin.delete("/api/admin/components/deal-card").expect(200);
    await request(app).get("/api/components/deal-card").expect(404);
    await request(app).get("/api/registry/deal-card").expect(404);
    await admin.delete("/api/admin/components/deal-card").expect(404);
  });
});

describe("feature-radar plugin", () => {
  it("records searches, keeps admin routes protected and never inflates counts", async () => {
    await mongoose.connection.collection("feature_requests").deleteMany({});
    await request(app)
      .post("/api/features/searches")
      .send({ term: "  Kanban   Board " })
      .expect((r) => expect(r.status).toBeLessThan(300));
    await request(app).get("/api/admin/features").expect(401);
    const free = await loginCustomer("free@test.dev");
    await free.get("/api/admin/features").expect(401);

    const list = await admin.get("/api/admin/features").expect(200);
    const item = list.body.find((f: { term: string }) => f.term === "kanban board");
    expect(item.searchCount).toBe(1);
    await request(app)
      .get("/api/features/lookup?term=kanban board")
      .expect((r) => expect(r.body.status).toBe("none"));

    await admin
      .patch(`/api/admin/features/${item.id}`)
      .send({ status: "building", etaDays: 7 })
      .expect(200);
    const look = await request(app).get("/api/features/lookup?term=Kanban Board").expect(200);
    expect(look.body.status).toBe("building");
    expect(look.body.interested).toBeNull(); // 1 real search: below the threshold, so no number is shown
  });
  const aiReply = (text: string): typeof fetch =>
    (async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

  async function buildingRequest(term: string) {
    await mongoose.connection.collection("feature_requests").deleteMany({});
    await request(app).post("/api/features/searches").send({ term }).expect(204);
    const list = await admin.get("/api/admin/features").expect(200);
    const item = list.body.find((f: { term: string }) => f.term === term);
    return item.id as string;
  }

  async function adminFor(a: ReturnType<typeof createApp>) {
    const agent = request.agent(a);
    await agent
      .post("/api/admin/login")
      .send({ username: "admin", password: "admin-password-123" })
      .expect(200);
    return agent;
  }

  async function waitForBuild(agent: ReturnType<typeof request.agent>, id: string) {
    for (let i = 0; i < 40; i++) {
      const list = await agent.get("/api/admin/features").expect(200);
      const row = list.body.find((f: { id: string }) => f.id === id);
      if (row.buildStatus !== "running") return row;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("build did not finish");
  }

  it("generate: 409 unless building, 503 without API key, 401 for customers/anon", async () => {
    const noKey = createApp(env, loadTheme(), { builder: { apiKey: undefined } });
    const agent = await adminFor(noKey);
    const id = await buildingRequest("sales funnel");
    await agent.post(`/api/admin/features/${id}/generate`).expect(409);
    await agent.patch(`/api/admin/features/${id}`).send({ status: "building" }).expect(200);
    const r = await agent.post(`/api/admin/features/${id}/generate`).expect(503);
    expect(r.body.error).toBe("builder_not_configured");
    await request(noKey).post(`/api/admin/features/${id}/generate`).expect(401);
    const free = await loginCustomer("free@test.dev");
    await free.post(`/api/admin/features/${id}/generate`).expect(401);
  });

  it("generate: valid AI bundle becomes a DRAFT, never auto-published", async () => {
    const aiBundle = bundle({
      name: "Sales Funnel",
      slug: "sales-funnel",
      access: "free",
      files: [
        {
          path: "components/crm/sales-funnel.tsx",
          content:
            'import { cn } from "@/lib/utils";\nexport function SalesFunnel() { return <div className={cn("p-2")}>Funnel</div>; }\n',
        },
      ],
      examples: [
        {
          title: "Default",
          code: 'import { SalesFunnel } from "@/components/crm/sales-funnel";\nexport default function E() { return <SalesFunnel />; }\n',
        },
      ],
    });
    const ai = createApp(env, loadTheme(), {
      builder: {
        apiKey: "test-key",
        fetchImpl: aiReply("```json\n" + JSON.stringify(aiBundle) + "\n```"),
      },
    });
    const agent = await adminFor(ai);
    const id = await buildingRequest("sales funnel");
    await agent.patch(`/api/admin/features/${id}`).send({ status: "building" }).expect(200);
    const start = await agent.post(`/api/admin/features/${id}/generate`).expect(202);
    expect(start.body.buildStatus).toBe("running");
    const row = await waitForBuild(agent, id);
    expect(row.buildStatus).toBe("done");
    expect(row.draftSlug).toBe("sales-funnel");
    const comp = await agent.get("/api/admin/components/sales-funnel").expect(200);
    expect(comp.body.status).toBe("draft");
    await request(ai).get("/api/components/sales-funnel").expect(404);
  });

  it("generate: invalid AI output twice marks the build failed and creates nothing", async () => {
    const ai = createApp(env, loadTheme(), {
      builder: { apiKey: "test-key", fetchImpl: aiReply("sorry, not json") },
    });
    const agent = await adminFor(ai);
    const id = await buildingRequest("sales funnel");
    await agent.patch(`/api/admin/features/${id}`).send({ status: "building" }).expect(200);
    await agent.post(`/api/admin/features/${id}/generate`).expect(202);
    const row = await waitForBuild(agent, id);
    expect(row.buildStatus).toBe("failed");
    expect(row.buildError).toBeTruthy();
    expect(row.buildError).not.toContain("test-key");
    expect(await ComponentModel.countDocuments({})).toBe(0);
  });
});

describe("admin access switch", () => {
  it("switching free -> premium locks the live component on the next request, and back", async () => {
    await createAndPublish(bundle({ access: "free" }));
    const free = await loginCustomer("free@test.dev");
    await free.get("/api/components/deal-card/copy").expect(200);
    await free
      .post("/api/admin/components/deal-card/access")
      .send({ access: "premium" })
      .expect(401);
    await admin
      .post("/api/admin/components/deal-card/access")
      .send({ access: "premium" })
      .expect(200);
    await free.get("/api/components/deal-card/copy").expect(403);
    await request(app).get("/api/registry/deal-card").expect(401);
    await admin.post("/api/admin/components/deal-card/access").send({ access: "free" }).expect(200);
    await free.get("/api/components/deal-card/copy").expect(200);
    await admin.post("/api/admin/components/deal-card/access").send({ access: "gold" }).expect(400);
  });
});

describe("infrastructure: cache, queue, rate limit", () => {
  it("caches the published catalogue, and admin writes invalidate it at once", async () => {
    await createAndPublish(bundle({ access: "free" }));
    const names = async () =>
      (await request(app).get("/api/components").expect(200)).body.map(
        (c: { name: string }) => c.name,
      );
    expect(await names()).toEqual(["Deal Card"]);

    // A write that bypasses the admin API is not seen: the list is served from the cache.
    await ComponentModel.updateOne({ slug: "deal-card" }, { "published.name": "Changed" });
    expect(await names()).toEqual(["Deal Card"]);

    await admin.post("/api/admin/components/deal-card/unpublish").expect(200);
    expect(await names()).toEqual([]);
    await request(app).get("/api/components/deal-card").expect(404);
    await admin.post("/api/admin/components/deal-card/publish").expect(200);
    await request(app).get("/api/components/deal-card").expect(200);

    // Access is still decided per request, on the cached document.
    await admin.post("/api/admin/components/deal-card/access").send({ access: "premium" });
    await request(app).get("/api/registry/deal-card").expect(401);
  });

  it("bundles above QUEUE_THRESHOLD_BYTES are saved by a job: 202, then poll", async () => {
    const small = createApp({ ...env, QUEUE_THRESHOLD_BYTES: 2_000 }, loadTheme(), { cache });
    const agent = request.agent(small);
    await agent
      .post("/api/admin/login")
      .send({ username: "admin", password: "admin-password-123" })
      .expect(200);
    const waitJob = async (id: string) => {
      for (let i = 0; i < 50; i++) {
        const { body } = await agent.get(`/api/admin/jobs/${id}`).expect(200);
        if (body.state === "completed" || body.state === "failed") return body;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error("job did not finish");
    };
    const big = bundle();
    big.files[0]!.content += `// ${"x".repeat(3_000)}\n`;

    const created = await agent.post("/api/admin/components").send(big).expect(202);
    expect(created.body).toEqual({ status: "queued", jobId: expect.any(String) });
    expect((await waitJob(created.body.jobId)).state).toBe("completed");
    const doc = await agent.get("/api/admin/components/deal-card").expect(200);
    expect(doc.body.status).toBe("draft");

    // Update with a broken big bundle: the job fails with the validation details.
    const broken = { ...big, version: "not-semver" };
    const put = await agent.put("/api/admin/components/deal-card").send(broken).expect(202);
    const failed = await waitJob(put.body.jobId);
    expect(failed.state).toBe("failed");
    expect(failed.error).toMatch(/bundle has problems/);

    await agent
      .post("/api/admin/components")
      .send(bundle({ slug: "tiny" }))
      .expect(201); // small: sync
    await agent.get("/api/admin/jobs/unknown-id").expect(404);
    await request(small).get(`/api/admin/jobs/${created.body.jobId}`).expect(401);
  });

  it("login is rate limited per IP outside test mode (sliding window, 10 per 15 min)", async () => {
    const strict = createApp({ ...env, NODE_ENV: "development" }, loadTheme(), { cache });
    for (let i = 0; i < 10; i++) {
      await request(strict)
        .post("/api/auth/login")
        .send({ email: "free@test.dev", password: "wrong-password" })
        .expect(401);
    }
    const r = await request(strict)
      .post("/api/auth/login")
      .send({ email: "free@test.dev", password: "password-123" })
      .expect(429);
    expect(r.body.error).toBe("rate_limited");
    expect(Number(r.headers["retry-after"])).toBeGreaterThan(0);
    // Admin login has its own counter.
    await request(strict)
      .post("/api/admin/login")
      .send({ username: "admin", password: "admin-password-123" })
      .expect(200);
  });
});

describe("refresh tokens (15-minute access, 10-day refresh)", () => {
  /** Value of one cookie from a response's set-cookie headers. */
  const cookie = (res: request.Response, name: string) => {
    const raw = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
    const line = raw.find((c) => c.startsWith(`${name}=`));
    return line ? decodeURIComponent((line.split(";")[0] ?? "").slice(name.length + 1)) : undefined;
  };
  const login = () =>
    request(app)
      .post("/api/auth/login")
      .send({ email: "premium@test.dev", password: "password-123" });

  it("login sets a 15-minute access cookie and a 10-day refresh cookie scoped to /api/auth", async () => {
    const res = await login().expect(200);
    const raw = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
    expect(raw.find((c) => c.startsWith("ti_session="))).toMatch(/Max-Age=900;/);
    const refresh = raw.find((c) => c.startsWith("ti_refresh="));
    expect(refresh).toMatch(/Max-Age=864000;/);
    expect(refresh).toMatch(/Path=\/api\/auth;/);
    expect(refresh).toMatch(/HttpOnly/);
  });

  it("refresh rotates the token, and /auth/me renews an expired access cookie", async () => {
    const first = cookie(await login().expect(200), "ti_refresh");
    const rotated = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `ti_refresh=${first}`)
      .expect(200);
    const second = cookie(rotated, "ti_refresh");
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(cookie(rotated, "ti_session")).toBeDefined();

    // No access cookie at all (expired): /auth/me signs the customer back in from the refresh cookie.
    const me = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `ti_refresh=${second}`)
      .expect(200);
    expect(me.body).toMatchObject({ email: "premium@test.dev", plan: "premium" });
    expect(cookie(me, "ti_session")).toBeDefined();
  });

  it("reusing an old refresh token revokes the whole family", async () => {
    const first = cookie(await login().expect(200), "ti_refresh")!;
    const second = cookie(
      await request(app).post("/api/auth/refresh").set("Cookie", `ti_refresh=${first}`).expect(200),
      "ti_refresh",
    )!;
    // Pretend the first use was a minute ago, outside the two-tab race window.
    await RefreshToken.updateMany(
      { usedAt: { $ne: null } },
      { usedAt: new Date(Date.now() - 60_000) },
    );
    await request(app).post("/api/auth/refresh").set("Cookie", `ti_refresh=${first}`).expect(401);
    // The attacker's reuse also killed the legitimate newer token.
    await request(app).post("/api/auth/refresh").set("Cookie", `ti_refresh=${second}`).expect(401);
  });

  it("logout revokes the refresh token; disabled customers cannot refresh", async () => {
    const token = cookie(await login().expect(200), "ti_refresh")!;
    await request(app).post("/api/auth/logout").set("Cookie", `ti_refresh=${token}`).expect(200);
    await request(app).post("/api/auth/refresh").set("Cookie", `ti_refresh=${token}`).expect(401);

    const again = cookie(await login().expect(200), "ti_refresh")!;
    await Customer.updateOne({ email: "premium@test.dev" }, { disabled: true });
    await request(app).post("/api/auth/refresh").set("Cookie", `ti_refresh=${again}`).expect(401);
  });

  it("admin refresh works, and a customer refresh token cannot renew an admin session", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ username: "admin", password: "admin-password-123" })
      .expect(200);
    const adminRefresh = cookie(res, "ti_admin_refresh")!;
    const renewed = await request(app)
      .post("/api/admin/refresh")
      .set("Cookie", `ti_admin_refresh=${adminRefresh}`)
      .expect(200);
    const access = cookie(renewed, "ti_admin")!;
    await request(app).get("/api/admin/me").set("Cookie", `ti_admin=${access}`).expect(200);

    const customerRefresh = cookie(await login().expect(200), "ti_refresh")!;
    await request(app)
      .post("/api/admin/refresh")
      .set("Cookie", `ti_admin_refresh=${customerRefresh}`)
      .expect(401);
  });

  it("blocking a customer ends their sessions for good, even after unblocking", async () => {
    const token = cookie(await login().expect(200), "ti_refresh")!;
    const c = await Customer.findOne({ email: "premium@test.dev" }).lean();
    const id = String(c!._id);
    await admin.post(`/api/admin/customers/${id}/status`).send({ disabled: true }).expect(200);
    await admin.post(`/api/admin/customers/${id}/status`).send({ disabled: false }).expect(200);
    await request(app).post("/api/auth/refresh").set("Cookie", `ti_refresh=${token}`).expect(401);
    await login().expect(200); // an unblocked customer can sign in again
  });
});
