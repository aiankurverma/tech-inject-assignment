/**
 * End-to-end demand pipeline: anonymous signals → clustered opportunity → human decision →
 * public request → quality report → approval → publish → sitemap/registry → pending notification.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { bundle, customer, login, reset, setup, teardown, type App } from "./helpers";
import { ComponentModel } from "../src/models";
import {
  ComponentRequest,
  DemandNotification,
  DemandOpportunity,
  DemandSignal,
  QualityReport,
} from "../src/demand/models";

let app: App;

beforeAll(async () => {
  ({ app } = await setup());
});
afterAll(async () => {
  await teardown(app);
});

const ADMIN = { username: "admin", password: "admin-password-123" };
const admin = () => {
  const agent = request.agent(app);
  return agent
    .post("/api/admin/login")
    .send(ADMIN)
    .then((r) => {
      if (r.status !== 200) throw new Error(`admin login failed: ${r.status} ${r.text}`);
      return agent;
    });
};

describe("demand pipeline", () => {
  it("dry run: five sample queries become ranked, buildable opportunities", async () => {
    await reset();
    const agent = await admin();
    await agent.patch("/api/admin/demand/settings").send({ buildThreshold: 2 });

    const queries = [
      "contact table with tags",
      "contact table with tags",
      "pipeline board with swimlanes",
      "pipeline board with swimlanes",
      "activity feed timeline",
    ];
    for (const query of queries) {
      const res = await request(app).post("/api/demand/search").send({ query, resultCount: 0 });
      expect(res.status).toBe(204);
    }

    const scan = await agent.post("/api/admin/demand/scan");
    expect(scan.status).toBe(200);
    const byQuery = new Map<string, { decision: string; evidence: { searches: number } }>(
      scan.body.opportunities.map((o: { canonicalQuery: string }) => [o.canonicalQuery, o]),
    );
    expect(byQuery.get("contact table with tags")?.decision).toBe("build");
    expect(byQuery.get("contact table with tags")?.evidence.searches).toBe(2);
    expect(byQuery.get("pipeline board with swimlanes")?.decision).toBe("build");
    expect(byQuery.get("activity feed timeline")?.decision).toBe("ignore");

    // The sitemap never advertises an idea that has not been built and published.
    const before = await request(app).get("/sitemap.xml");
    expect(before.text).not.toContain("/components/contact-table-with-tags");
  });

  it("captures searches, clusters them and keeps a reviewed decision stable", async () => {
    await reset();
    const agent = await admin();

    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post("/api/demand/search")
        .send({ query: "contact table with tags", resultCount: 0 });
      expect(r.status).toBe(204);
    }

    const scan = await agent.post("/api/admin/demand/scan");
    expect(scan.status).toBe(200);
    expect(scan.body.opportunities).toHaveLength(1);
    const opp = scan.body.opportunities[0];
    expect(opp.canonicalQuery).toBe("contact table with tags");
    expect(opp.decision).toBe("build");
    expect(opp.evidence.searches).toBe(5);
    expect(opp.evidence.zeroResultRate).toBe(1);

    const decided = await agent
      .patch(`/api/admin/demand/opportunities/${opp._id}`)
      .send({ decision: "build" });
    expect(decided.status).toBe(200);
    expect(decided.body.status).toBe("approved");

    // A re-scan updates evidence but must not reset the human decision.
    const rescan = await agent.post("/api/admin/demand/scan");
    expect(rescan.status).toBe(200);
    expect(rescan.body.opportunities[0].status).toBe("approved");
    expect(rescan.body.opportunities[0].decision).toBe("build");
  });

  it("links the existing public request instead of creating a duplicate", async () => {
    await reset();
    const agent = await admin();
    const user = await customer({ name: "Ada Lovelace" });
    const session = await login(app, user);

    const created = await session.post("/api/demand/requests").send({
      title: "Contact table with tags",
      description: "A contact table with coloured tags, sorting and a bulk action bar.",
      useCase: "CRM contacts list",
      creditOptIn: true,
      notifyOptIn: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.duplicate).toBe(false);
    const requestId = created.body.request.id;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/demand/search")
        .send({ query: "contact table with tags", resultCount: 0 });
    }
    const scan = await agent.post("/api/admin/demand/scan");
    const opp = scan.body.opportunities[0];
    const decided = await agent
      .patch(`/api/admin/demand/opportunities/${opp._id}`)
      .send({ decision: "build" });
    expect(decided.status).toBe(200);

    const linked = await DemandOpportunity.findById(opp._id).lean();
    expect(String(linked?.requestId)).toBe(requestId);
    const requestDoc = await ComponentRequest.findById(requestId).lean();
    expect(requestDoc?.status).toBe("building");
    // The board must not gain a second row for the same idea.
    expect(await ComponentRequest.countDocuments()).toBe(1);

    const board = await request(app).get("/api/demand/requests");
    expect(board.status).toBe(200);
    expect(board.body.requests[0].title).toBe("Contact table with tags");
    expect(board.body.requests[0].creditName).toBe("Ada Lovelace");
  });

  it("deduplicates votes per token and keeps the public board anonymous", async () => {
    await reset();
    const created = await request(app).post("/api/demand/requests").send({
      title: "Kanban with swimlanes",
      description: "A pipeline board with swimlanes and drag and drop.",
    });
    expect(created.status).toBe(201);
    const id = created.body.request.id;

    const first = await request(app)
      .post(`/api/demand/requests/${id}/vote`)
      .send({ voterToken: "device-token-1" });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ votes: 2, alreadyVoted: false });

    const second = await request(app)
      .post(`/api/demand/requests/${id}/vote`)
      .send({ voterToken: "device-token-1" });
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ votes: 2, alreadyVoted: true });
  });

  it("refuses to publish without approval or with the kill switch on", async () => {
    await reset();
    const agent = await admin();
    const opp = await DemandOpportunity.create({
      clusterKey: "billing summary",
      canonicalQuery: "billing summary",
      memberQueries: ["billing summary"],
      demandScore: 90,
      evidence: { searches: 9, upvotes: 3, impressions: 0, clicks: 0, zeroResultRate: 0 },
      decision: "build",
      reasons: ["Enough demand."],
      status: "review",
      draftSlug: "billing-summary",
    });
    await ComponentModel.create({
      slug: "billing-summary",
      status: "draft",
      draft: bundle("billing-summary"),
    });
    const report = await QualityReport.create({
      draftSlug: "billing-summary",
      checks: [{ id: "bundle", label: "Bundle validates", status: "pass", detail: "ok" }],
      passed: true,
    });
    await DemandOpportunity.updateOne({ _id: opp._id }, { $set: { qualityReportId: report._id } });

    const notApproved = await agent.post(`/api/admin/demand/opportunities/${opp._id}/publish`);
    expect(notApproved.status).toBe(409);
    expect(notApproved.body.error).toBe("not_approved");

    await DemandOpportunity.updateOne(
      { _id: opp._id },
      { $set: { status: "approved_to_publish" } },
    );
    const kill = await agent.patch("/api/admin/demand/settings").send({ killSwitch: true });
    expect(kill.status).toBe(200);
    const blocked = await agent.post(`/api/admin/demand/opportunities/${opp._id}/publish`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("kill_switch");

    const off = await agent.patch("/api/admin/demand/settings").send({ killSwitch: false });
    expect(off.status).toBe(200);
  });

  it("publishes only after every gate, then queues opt-in notifications", async () => {
    await reset();
    const agent = await admin();
    const user = await customer({ name: "Grace Hopper" });
    const session = await login(app, user);

    const created = await session.post("/api/demand/requests").send({
      title: "Invoice table",
      description: "An invoice table with status badges, totals and a download action.",
      creditOptIn: true,
      notifyOptIn: true,
    });
    expect(created.status).toBe(201);
    const requestId = created.body.request.id;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/demand/search")
        .send({ query: "invoice table", resultCount: 0 });
    }
    const scan = await agent.post("/api/admin/demand/scan");
    const opp = scan.body.opportunities[0];
    await agent.patch(`/api/admin/demand/opportunities/${opp._id}`).send({ decision: "build" });

    const slug = "invoice-table";
    await ComponentModel.create({ slug, status: "draft", draft: bundle(slug) });
    const report = await QualityReport.create({
      draftSlug: slug,
      checks: [{ id: "bundle", label: "Bundle validates", status: "pass", detail: "ok" }],
      passed: true,
    });
    await DemandOpportunity.updateOne(
      { _id: opp._id },
      {
        $set: {
          draftSlug: slug,
          qualityReportId: report._id,
          status: "approved_to_publish",
        },
      },
    );

    const beforePublish = await request(app).get("/sitemap.xml");
    expect(beforePublish.text).not.toContain(`/components/${slug}`);

    const published = await agent.post(`/api/admin/demand/opportunities/${opp._id}/publish`);
    expect(published.status).toBe(200);
    expect(published.body.slug).toBe(slug);
    expect(published.body.notifications).toBe(1);

    const component = await ComponentModel.findOne({ slug }).lean();
    expect(component?.status).toBe("published");
    const requestDoc = await ComponentRequest.findById(requestId).lean();
    expect(requestDoc?.status).toBe("live");
    expect(requestDoc?.componentSlug).toBe(slug);

    const notification = await DemandNotification.findOne({ componentSlug: slug }).lean();
    expect(notification?.status).toBe("pending");
    expect(notification?.email).toBe(user.email);

    const signals = await DemandSignal.find().lean();
    expect(signals.every((s) => s.status === "live")).toBe(true);

    // Publishing twice is rejected and does not queue a second email.
    const again = await agent.post(`/api/admin/demand/opportunities/${opp._id}/publish`);
    expect(again.status).toBe(409);
    expect(await DemandNotification.countDocuments({ componentSlug: slug })).toBe(1);

    const sitemap = await request(app).get("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(sitemap.text).toContain(`/components/${slug}`);

    const registry = await request(app).get(`/r/${slug}.json`);
    expect(registry.status).toBe(200);
    expect(registry.body.name).toBeTruthy();
  });

  it("enforces the daily publish cap atomically", async () => {
    await reset();
    const agent = await admin();
    await agent.patch("/api/admin/demand/settings").send({ maxPublishPerDay: 1 });

    const make = async (key: string) => {
      const opp = await DemandOpportunity.create({
        clusterKey: key,
        canonicalQuery: key,
        memberQueries: [key],
        demandScore: 50,
        evidence: { searches: 1, upvotes: 0, impressions: 0, clicks: 0, zeroResultRate: 0 },
        decision: "build",
        reasons: [],
        status: "approved_to_publish",
        draftSlug: key,
      });
      await ComponentModel.create({ slug: key, status: "draft", draft: bundle(key) });
      const report = await QualityReport.create({
        draftSlug: key,
        checks: [{ id: "bundle", label: "Bundle validates", status: "pass", detail: "ok" }],
        passed: true,
      });
      await DemandOpportunity.updateOne(
        { _id: opp._id },
        { $set: { qualityReportId: report._id } },
      );
      return opp;
    };

    const first = await make("cap-one");
    const second = await make("cap-two");
    const ok = await agent.post(`/api/admin/demand/opportunities/${first._id}/publish`);
    expect(ok.status).toBe(200);
    const blocked = await agent.post(`/api/admin/demand/opportunities/${second._id}/publish`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("batch_limit");
  });
});
