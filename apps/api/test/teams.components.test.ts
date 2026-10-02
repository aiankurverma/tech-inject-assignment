import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CustomerDoc, TeamDoc } from "../src/models";
import { TeamComponent, TeamJob } from "../src/models";
import {
  addMember,
  bigBundle,
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
let teamA: TeamDoc;
let teamB: TeamDoc;
let ownerA: CustomerDoc;
let memberA: CustomerDoc;
let ownerB: CustomerDoc;

beforeAll(async () => {
  ({ app } = await setup());
});
afterAll(() => teardown(app));
beforeEach(async () => {
  await reset();
  ownerA = await customer({ email: "owner-a@example.com" });
  memberA = await customer({ email: "member-a@example.com" });
  ownerB = await customer({ email: "owner-b@example.com" });
  teamA = await createTeam("acme", ownerA, "Acme");
  teamB = await createTeam("globex", ownerB, "Globex");
  await addMember(teamA, memberA, "member");
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("team component lifecycle", () => {
  it("upload -> validate (422) -> publish -> unpublish", async () => {
    const a = await login(app, ownerA);
    const bad = bundle("card", "acme", {
      files: [{ path: "components/crm/card.tsx", content: "export const X = 1;" }],
    });
    const check = await a.post("/api/teams/acme/validate").send(bad);
    expect(check.status).toBe(200);
    expect(check.body.ok).toBe(false);
    expect(check.body.errors.join()).toMatch(/components\/acme\//);
    const rejected = await a.post("/api/teams/acme/components").send(bad);
    expect(rejected.status).toBe(422);
    expect(rejected.body.error).toBe("invalid_bundle");

    const created = await a.post("/api/teams/acme/components").send(bundle("card", "acme"));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ slug: "card", status: "draft", publishedVersion: null });
    const m = await login(app, memberA);
    expect((await m.get("/api/teams/acme/components/card")).status).toBe(404);

    const published = await a.post("/api/teams/acme/components/card/publish");
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ status: "published", publishedVersion: "1.0.0" });
    const detail = await m.get("/api/teams/acme/components/card");
    expect(detail.status).toBe(200);
    expect(detail.body.installCommand).toBe(
      "npx --yes http://localhost:4000/cli/kitbase.tgz add @acme/card",
    );
    expect(detail.body.team).toBe("acme");
    const prompt = await m.get("/api/teams/acme/components/card/prompt");
    expect(prompt.text).toContain("private to team @acme");
    expect(prompt.text).toContain("KITBASE_TOKEN");
    const preview = await m.get("/api/teams/acme/components/card/preview");
    expect(preview.body.files.map((f: { path: string }) => f.path)).toEqual([
      "lib/utils.ts",
      "components/acme/card.tsx",
    ]);

    const unpublished = await a.post("/api/teams/acme/components/card/unpublish");
    expect(unpublished.status).toBe(200);
    expect(unpublished.body.status).toBe("unpublished");
    expect((await m.get("/api/teams/acme/components/card")).status).toBe(404);
    expect((await a.post("/api/teams/acme/components/card/unpublish")).status).toBe(400);
    expect((await a.delete("/api/teams/acme/components/card")).status).toBe(200);
    expect((await a.get("/api/teams/acme/components/card/draft")).status).toBe(404);
  });

  it("the published snapshot does not change while the draft is edited", async () => {
    const a = await login(app, ownerA);
    await a.post("/api/teams/acme/components").send(bundle("card", "acme"));
    await a.post("/api/teams/acme/components/card/publish");
    const edited = bundle("card", "acme", {
      version: "1.1.0",
      files: [
        {
          path: "components/acme/card.tsx",
          content: "export function X() { return <b>EDITED</b>; }",
        },
      ],
    });
    const saved = await a.put("/api/teams/acme/components/card").send(edited);
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      draftVersion: "1.1.0",
      publishedVersion: "1.0.0",
      hasUnpublishedChanges: true,
    });
    const copy = await a.get("/api/teams/acme/components/card/copy");
    expect(copy.text).not.toContain("EDITED");
    const draftPreview = await a.get("/api/teams/acme/components/card/draft-preview");
    expect(JSON.stringify(draftPreview.body)).toContain("EDITED");
    const mismatch = await a.put("/api/teams/acme/components/card").send(bundle("other", "acme"));
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error).toBe("slug_mismatch");
  });

  it("forces access to free", async () => {
    const a = await login(app, ownerA);
    const res = await a
      .post("/api/teams/acme/components")
      .send(bundle("card", "acme", { access: "premium" }));
    expect(res.status).toBe(201);
    await a.post("/api/teams/acme/components/card/publish");
    const doc = await TeamComponent.findOne({ teamId: teamA._id, slug: "card" }).lean();
    expect(doc!.draft.access).toBe("free");
    expect(doc!.published.access).toBe("free");
    const m = await login(app, memberA);
    expect((await m.get("/api/teams/acme/components/card")).body.access).toBe("free");
  });

  it("409 on duplicate slug only within one team", async () => {
    const a = await login(app, ownerA);
    const b = await login(app, ownerB);
    expect((await a.post("/api/teams/acme/components").send(bundle("card", "acme"))).status).toBe(
      201,
    );
    const dup = await a.post("/api/teams/acme/components").send(bundle("card", "acme"));
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe("slug_taken");
    expect(
      (await b.post("/api/teams/globex/components").send(bundle("card", "globex"))).status,
    ).toBe(201);
    expect(await TeamComponent.countDocuments({ teamId: teamA._id })).toBe(1);
    expect(await TeamComponent.countDocuments({ teamId: teamB._id })).toBe(1);
  });

  it("a queued big upload carries the server's teamId", async () => {
    const a = await login(app, ownerA);
    // A forged teamId in the body is ignored: the bundle schema is strict and the job uses the resolved team.
    const res = await a.post("/api/teams/acme/components").send(bigBundle("big", "acme"));
    expect(res.status).toBe(202);
    const job = await TeamJob.findOne({ _id: res.body.jobId, teamId: teamA._id }).lean();
    expect(job).not.toBeNull();
    for (let i = 0; i < 50; i++) {
      const status = await a.get(`/api/teams/acme/jobs/${res.body.jobId}`);
      if (status.body.state === "completed" || status.body.state === "failed") {
        expect(status.body).toMatchObject({ state: "completed" });
        break;
      }
      await wait(100);
    }
    const doc = await TeamComponent.findOne({ teamId: teamA._id, slug: "big" }).lean();
    expect(doc).not.toBeNull();
    expect(String(doc!.teamId)).toBe(String(teamA._id));
    expect(await TeamComponent.countDocuments({ teamId: teamB._id })).toBe(0);
    // Unknown job id is 404, and B cannot see A's job.
    expect((await a.get("/api/teams/acme/jobs/does-not-exist")).status).toBe(404);
    const b = await login(app, ownerB);
    expect((await b.get(`/api/teams/globex/jobs/${res.body.jobId}`)).status).toBe(404);
  });
});
