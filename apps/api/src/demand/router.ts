import { Router } from "express";
import type { RequestHandler } from "express";
import { z } from "zod";
import type { Cache } from "@ti/cache";
import { FeatureRequest } from "@ti/feature-radar/server";
import type { Auth } from "../middleware/auth";
import type { Env } from "../config/env";
import { HttpError, parseBody } from "../utils/http";
import {
  ComponentRequest,
  DemandAudit,
  DemandNotification,
  DemandOpportunity,
  DemandSignal,
  QualityReport,
} from "./models";
import {
  approveOpportunity,
  confirmManualChecks,
  createRequest,
  getSettings,
  importGscCsv,
  linkFeatureRequest,
  listNotifications,
  listPublicRequests,
  markNotificationSent,
  overview,
  publishOpportunity,
  recordDraftQuality,
  recordSiteSearch,
  rejectOpportunity,
  runQualityGate,
  safeBuildTerm,
  scanOpportunities,
  setOpportunityDecision,
  toPublicRequest,
  updateSettings,
  voteRequest,
  weeklyReport,
} from "./service";

export interface DemandOptions {
  auth: Auth;
  cache: Cache;
  env: Env;
  requireAdmin: RequestHandler;
  searchLimit: RequestHandler;
  writeLimit: RequestHandler;
  adminWriteLimit: RequestHandler;
  /** Creates an AI draft and returns the FeatureRequest id used to poll it. */
  enqueueDraft?: (opportunityId: string, term: string) => Promise<string | null>;
}

const idSchema = z.string().regex(/^[0-9a-f]{24}$/, "Invalid id");
const searchBody = z.object({
  query: z.string().min(2).max(120),
  resultCount: z.number().int().min(0).max(100_000).optional(),
  clicked: z.boolean().optional(),
  matchedSlug: z.string().max(48).optional(),
});
const requestBody = z.object({
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(600),
  useCase: z.string().max(400).optional(),
  creditOptIn: z.boolean().optional(),
  notifyOptIn: z.boolean().optional(),
  website: z.string().max(100).optional(),
});
const voteBody = z.object({ voterToken: z.string().min(4).max(120) });
const decisionBody = z.object({
  decision: z.enum(["build", "improve", "ignore"]),
  note: z.string().max(400).optional(),
});
const settingsBody = z.object({
  killSwitch: z.boolean().optional(),
  autoBuild: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
  buildThreshold: z.number().int().min(1).max(1000).optional(),
  voteThreshold: z.number().int().min(1).max(1000).optional(),
  maxPublishPerDay: z.number().int().min(1).max(100).optional(),
});

/** Audit actor. The admin session is a single shared account, so the label is stable. */
const adminOf = (_req?: unknown) => "admin";

/** Public demand endpoints: search logging, the request board and upvotes. */
export function demandPublicRoutes(opts: DemandOptions) {
  const r = Router();

  r.post("/search", opts.searchLimit, async (req, res) => {
    const parsed = searchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "validation_error", message: "Invalid search signal." });
      return;
    }
    // Deliberately anonymous: no IP, email, user agent or hash is stored with the query.
    const result = await recordSiteSearch(opts.cache, parsed.data);
    res.status(result.recorded ? 204 : 422).end();
  });

  r.get("/requests", async (_req, res) => {
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json({ requests: await listPublicRequests() });
  });

  r.post("/requests", opts.writeLimit, async (req, res) => {
    const parsed = requestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: "validation_error",
        message: parsed.error.errors[0]?.message ?? "Invalid request.",
      });
      return;
    }
    const customer = await opts.auth.currentCustomer(req);
    const result = await createRequest(
      opts.cache,
      parsed.data,
      customer
        ? { customer: { id: String(customer._id), name: customer.name, email: customer.email } }
        : {},
    );
    res.status(result.duplicate ? 200 : 201).json(result);
  });

  r.post("/requests/:id/vote", opts.writeLimit, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, "not_found", "Request not found.");
    const body = voteBody.safeParse(req.body);
    if (!body.success) {
      res.status(422).json({ error: "validation_error", message: "Voter token required." });
      return;
    }
    const customer = await opts.auth.currentCustomer(req);
    const result = await voteRequest(
      id.data,
      body.data.voterToken,
      customer ? String(customer._id) : null,
    );
    res.json(result);
  });

  return r;
}

/** Admin review, imports, quality gates and publishing. */
export function demandAdminRoutes(opts: DemandOptions) {
  const r = Router();
  r.use(opts.requireAdmin);

  r.get("/overview", async (_req, res) => {
    res.json(await overview(opts.cache));
  });

  r.get("/signals", async (req, res) => {
    const source = typeof req.query.source === "string" ? req.query.source : null;
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const query: Record<string, unknown> = {};
    if (source) query.source = source;
    if (status) query.status = status;
    const signals = await DemandSignal.find(query)
      .sort({ lastSeen: -1, count: -1 })
      .limit(200)
      .lean();
    res.json(signals);
  });

  r.get("/opportunities", async (_req, res) => {
    const opps = await DemandOpportunity.find()
      .sort({ demandScore: -1, updatedAt: -1 })
      .limit(200)
      .lean();
    const features = await FeatureRequest.find().lean();
    const byId = new Map(features.map((f) => [String(f._id), f]));
    res.json(
      opps.map((o) => {
        const f = o.featureRequestId ? byId.get(String(o.featureRequestId)) : null;
        return {
          ...o,
          buildStatus: f?.buildStatus ?? null,
          buildError: f?.buildError ?? null,
          draftSlug: o.draftSlug ?? f?.draftSlug ?? null,
        };
      }),
    );
  });

  r.post("/scan", opts.adminWriteLimit, async (_req, res) => {
    res.json(await scanOpportunities(opts.cache, adminOf(_req)));
  });

  r.patch("/opportunities/:id", opts.adminWriteLimit, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, "not_found", "Opportunity not found.");
    const body = parseBody(decisionBody, req.body);
    res.json(await setOpportunityDecision(id.data, body.decision, adminOf(req), body.note));
  });

  r.post("/opportunities/:id/draft", opts.adminWriteLimit, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, "not_found", "Opportunity not found.");
    const settings = await getSettings();
    if (settings.killSwitch)
      throw new HttpError(409, "kill_switch", "Drafting is paused by the global kill switch.");
    if (!opts.enqueueDraft)
      throw new HttpError(503, "builder_unavailable", "AI drafting is not configured.");
    const opp = await DemandOpportunity.findById(id.data).lean();
    if (!opp) throw new HttpError(404, "not_found", "Opportunity not found.");
    const term = safeBuildTerm(opp.canonicalQuery);
    const featureRequestId = await opts.enqueueDraft(id.data, term);
    if (featureRequestId) await linkFeatureRequest(id.data, featureRequestId, adminOf(req));
    res.status(202).json({ buildStatus: "running", featureRequestId });
  });

  r.post("/opportunities/:id/quality", opts.adminWriteLimit, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, "not_found", "Opportunity not found.");
    const opp = await DemandOpportunity.findById(id.data).lean();
    if (!opp) throw new HttpError(404, "not_found", "Opportunity not found.");
    let draftSlug = opp.draftSlug ?? null;
    if (!draftSlug && opp.featureRequestId) {
      const feature = await FeatureRequest.findById(opp.featureRequestId).lean();
      draftSlug = feature?.draftSlug ?? null;
    }
    if (!draftSlug)
      throw new HttpError(
        409,
        "draft_not_ready",
        "The AI draft is not ready yet. Poll the opportunity list.",
      );
    res.json(await recordDraftQuality(id.data, draftSlug, adminOf(req)));
  });

  r.post("/quality/:id/confirm", opts.adminWriteLimit, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, "not_found", "Quality report not found.");
    const body = parseBody(
      z.object({ checks: z.array(z.enum(["a11y", "responsive", "performance"])).min(1) }),
      req.body,
    );
    res.json(await confirmManualChecks(id.data, body.checks, adminOf(req)));
  });

  r.post("/opportunities/:id/approve", opts.adminWriteLimit, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, "not_found", "Opportunity not found.");
    res.json(await approveOpportunity(id.data, adminOf(req)));
  });

  r.post("/opportunities/:id/reject", opts.adminWriteLimit, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, "not_found", "Opportunity not found.");
    const body = parseBody(z.object({ reason: z.string().min(3).max(400) }), req.body);
    res.json(await rejectOpportunity(id.data, adminOf(req), body.reason));
  });

  r.post("/opportunities/:id/publish", opts.adminWriteLimit, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, "not_found", "Opportunity not found.");
    res.json(await publishOpportunity(id.data, opts.cache, adminOf(req)));
  });

  r.post("/import/gsc", opts.adminWriteLimit, async (req, res) => {
    const body = parseBody(z.object({ csv: z.string().min(10).max(2_000_000) }), req.body);
    res.json(await importGscCsv(body.csv, adminOf(req)));
  });

  r.post("/report", opts.adminWriteLimit, async (req, res) => {
    res.json(await weeklyReport(opts.cache, adminOf(req)));
  });

  r.get("/quality", async (_req, res) => {
    res.json(await QualityReport.find().sort({ createdAt: -1 }).limit(100).lean());
  });

  r.get("/requests", async (_req, res) => {
    const docs = await ComponentRequest.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json(docs.map(toPublicRequest));
  });

  r.get("/notifications", async (_req, res) => {
    res.json(await listNotifications());
  });

  r.post("/notifications/:id/sent", opts.adminWriteLimit, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, "not_found", "Notification not found.");
    res.json(await markNotificationSent(id.data, adminOf(req)));
  });

  r.patch("/settings", opts.adminWriteLimit, async (req, res) => {
    const body = parseBody(settingsBody, req.body);
    res.json(await updateSettings(body, adminOf(req)));
  });

  r.get("/audit", async (_req, res) => {
    res.json(await DemandAudit.find().sort({ createdAt: -1 }).limit(200).lean());
  });

  // Re-run the gate for any draft without an opportunity (manual admin use).
  r.post("/quality/:slug/run", opts.adminWriteLimit, async (req, res) => {
    res.json(await runQualityGate(String(req.params.slug), adminOf(req)));
  });

  // A convenience endpoint for the admin UI: current settings + pending notifications.
  r.get("/settings", async (_req, res) => {
    res.json({
      settings: await getSettings(),
      pendingNotifications: await DemandNotification.countDocuments({ status: "pending" }),
    });
  });

  return r;
}
