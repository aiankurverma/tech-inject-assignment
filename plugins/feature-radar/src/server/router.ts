import { Router } from "express";
import type { RequestHandler } from "express";
import { z } from "zod";
import { FeatureRequest } from "./model";
import type { IFeatureRequest } from "./model";
import { normalizeTerm, publicInterest } from "./normalize";
import { clusterTerms } from "./cluster";
import { demandScore, SUGGEST_BUILD_THRESHOLD } from "./demand";
import { buildBundle, type AiProvider, type ProviderConfig } from "./builder";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const searchBodySchema = z.object({
  term: z
    .string()
    .transform((v) => normalizeTerm(v))
    .pipe(
      z
        .string()
        .min(2, "Term must be at least 2 characters")
        .max(60, "Term must be at most 60 characters")
        .regex(/^[a-z0-9 \-&.]+$/, "Term contains invalid characters"),
    ),
});

const patchBodySchema = z.object({
  status: z.enum(["new", "valid", "rejected", "building"]),
  etaDays: z.number().int().min(1).max(90).optional(),
});

const idSchema = z.string().regex(/^[0-9a-f]{24}$/, "Invalid id");

// ---------------------------------------------------------------------------
// Per-IP rate limiter (30 req / 60 s), used when the host passes no `searchLimiter`
// ---------------------------------------------------------------------------

function makeIpLimiter(max: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { n: number; until: number }>();
  return (req, res, next) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.until < now) {
      hits.set(key, { n: 1, until: now + windowMs });
    } else {
      h.n += 1;
      if (h.n > max) {
        res
          .status(429)
          .json({ error: "rate_limited", message: "Too many requests. Try again later." });
        return;
      }
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Helper: format a lean doc as the admin row shape
// ---------------------------------------------------------------------------

function toRow(d: {
  _id: unknown;
  term: string;
  searchCount: number;
  status: string;
  eta: Date | null | undefined;
  lastSearchedAt: Date;
  createdAt: Date;
  buildStatus?: string;
  buildError?: string;
  draftSlug?: string;
}) {
  return {
    id: String(d._id),
    term: d.term,
    searchCount: d.searchCount,
    status: d.status,
    eta: d.eta != null ? d.eta.toISOString() : null,
    lastSearchedAt: d.lastSearchedAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
    buildStatus: d.buildStatus ?? "idle",
    buildError: d.buildError ?? null,
    draftSlug: d.draftSlug ?? null,
  };
}

type Row = ReturnType<typeof toRow>;

/** Insight cluster: summed real counts, canonical = most-searched member. */
export function buildInsights(rows: Row[], now: Date = new Date()) {
  const byTerm = new Map(rows.map((r) => [r.term, r]));
  const clusters = clusterTerms(rows.map((r) => r.term)).map((terms) => {
    const members = terms
      .map((t) => byTerm.get(t))
      .filter((r): r is Row => r != null)
      .sort((a, b) => b.searchCount - a.searchCount || a.term.localeCompare(b.term));
    const canonical = members[0];
    if (!canonical) return null;
    const totalCount = members.reduce((n, r) => n + r.searchCount, 0);
    const last = Math.max(...members.map((r) => Date.parse(r.lastSearchedAt)));
    const score = demandScore({ searchCount: totalCount, lastSearchedAt: new Date(last) }, now);
    const anyBuilding = members.some((r) => r.status === "building");
    const suggestion: "suggest-build" | "building" | "watch" = anyBuilding
      ? "building"
      : canonical.status === "new" && score >= SUGGEST_BUILD_THRESHOLD
        ? "suggest-build"
        : "watch";
    return {
      canonicalId: canonical.id,
      canonicalTerm: canonical.term,
      status: canonical.status,
      totalCount,
      lastSearchedAt: new Date(last).toISOString(),
      demandScore: score,
      suggestion,
      members: members.map((r) => ({
        id: r.id,
        term: r.term,
        searchCount: r.searchCount,
        status: r.status,
      })),
    };
  });
  return {
    threshold: SUGGEST_BUILD_THRESHOLD,
    clusters: clusters
      .filter((c) => c != null)
      .sort((a, b) => b.demandScore - a.demandScore || b.totalCount - a.totalCount),
  };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BuilderConfig {
  provider?: AiProvider;
  fallbacks?: ProviderConfig[];
  apiKey?: string;
  model: string;
  styleExample: string;
  themeClasses: string;
  allowedDependencies?: readonly string[];
  fetchImpl?: typeof fetch;
}

export interface FeatureRadarOptions {
  requireAdmin: RequestHandler;
  /** Validate + store a bundle as a DRAFT component (never published). */
  createDraft: (bundle: unknown) => Promise<{ slug: string }>;
  validate: (bundle: unknown) => { ok: true } | { ok: false; errors: string[] };
  builder?: BuilderConfig;
  /** Rate limit for the public search endpoint. Default: 30 per minute per IP, in memory. */
  searchLimiter?: RequestHandler;
  /**
   * Hand a draft build to a background queue, which later calls `processBuild(job)`.
   * Default: run it in this process right after responding.
   */
  enqueueBuild?: (job: BuildJob) => Promise<unknown>;
}

/** Serializable work item for one AI draft build. */
export interface BuildJob {
  id: string;
  term: string;
}

/** Short, secret-free error text for the admin UI. */
function shortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Draft build failed.";
  return msg.length > 200 ? `${msg.slice(0, 197)}...` : msg;
}

async function runBuild(
  id: string,
  term: string,
  apiKey: string,
  opts: FeatureRadarOptions & { builder: BuilderConfig },
): Promise<void> {
  const base = { ...opts.builder, apiKey };
  try {
    let fixErrors: string[] | undefined;
    let bundle: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const built = await buildBundle(term, { ...base, fixErrors });
      if (!built.ok) {
        // A rejected key will not fix itself on retry: fail fast with the clear message.
        if (/key was rejected/.test(built.error)) throw new Error(built.error);
        fixErrors = [built.error];
        continue;
      }
      const v = opts.validate(built.bundle);
      if (v.ok) {
        bundle = built.bundle;
        break;
      }
      fixErrors = v.errors;
    }
    if (bundle === undefined) {
      const first = fixErrors?.[0] ?? "unknown error";
      throw new Error(`AI bundle invalid after retry: ${first}`);
    }
    const { slug } = await opts.createDraft(bundle);
    await FeatureRequest.updateOne(
      { _id: id },
      { $set: { buildStatus: "done", draftSlug: slug }, $unset: { buildError: 1 } },
    );
  } catch (e) {
    await FeatureRequest.updateOne(
      { _id: id },
      { $set: { buildStatus: "failed", buildError: shortError(e) } },
    ).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function featureRadarRoutes(opts: FeatureRadarOptions): {
  publicRouter: Router;
  adminRouter: Router;
  processBuild: (job: BuildJob) => Promise<void>;
} {
  const publicRouter = Router();
  const adminRouter = Router();
  const searchLimiter = opts.searchLimiter ?? makeIpLimiter(30, 60_000);

  /** Runs one build; the outcome is stored on the feature request (buildStatus). */
  const processBuild = async ({ id, term }: BuildJob) => {
    const { builder } = opts;
    if (!builder?.apiKey) throw new Error("AI builder not configured.");
    await runBuild(id, term, builder.apiKey, { ...opts, builder });
  };
  const enqueueBuild =
    opts.enqueueBuild ??
    (async (job: BuildJob) => {
      void processBuild(job);
    });

  // -------------------------------------------------------------------------
  // Public: POST /features/searches
  // -------------------------------------------------------------------------
  publicRouter.post("/features/searches", searchLimiter, async (req, res) => {
    const parsed = searchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: "validation_error",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      });
      return;
    }
    const { term } = parsed.data;
    await FeatureRequest.findOneAndUpdate(
      { term },
      {
        $inc: { searchCount: 1 },
        $set: { lastSearchedAt: new Date() },
        $setOnInsert: { createdAt: new Date(), status: "new" },
      },
      { upsert: true },
    );
    res.status(204).end();
  });

  // -------------------------------------------------------------------------
  // Public: GET /features/lookup?term=x
  // -------------------------------------------------------------------------
  publicRouter.get("/features/lookup", async (req, res) => {
    const raw = typeof req.query["term"] === "string" ? req.query["term"] : "";
    const term = normalizeTerm(raw);
    const doc = await FeatureRequest.findOne({ term }).lean<IFeatureRequest>();
    if (!doc || doc.status !== "building") {
      res.json({ status: "none" });
      return;
    }
    res.json({
      status: "building",
      term: doc.term,
      eta: doc.eta != null ? doc.eta.toISOString() : null,
      interested: publicInterest(doc.searchCount),
    });
  });

  // -------------------------------------------------------------------------
  // Admin: all routes behind requireAdmin
  // -------------------------------------------------------------------------
  adminRouter.use(opts.requireAdmin);

  // GET / — list all, sorted by searchCount desc
  adminRouter.get("/", async (_req, res) => {
    const docs = await FeatureRequest.find().sort({ searchCount: -1 }).lean<IFeatureRequest[]>();
    res.json(docs.map(toRow));
  });

  // GET /insights: similar terms clustered and ranked by demand (real counts only)
  adminRouter.get("/insights", async (_req, res) => {
    const docs = await FeatureRequest.find().sort({ searchCount: -1 }).lean<IFeatureRequest[]>();
    res.json(buildInsights(docs.map(toRow)));
  });

  // PATCH /:id — update status (and optionally eta when building)
  adminRouter.patch("/:id", async (req, res) => {
    const idResult = idSchema.safeParse(req.params["id"]);
    if (!idResult.success) {
      res.status(400).json({ error: "validation_error", message: "Invalid id" });
      return;
    }
    const bodyResult = patchBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(422).json({
        error: "validation_error",
        message: bodyResult.error.errors[0]?.message ?? "Invalid input",
      });
      return;
    }
    const { status, etaDays } = bodyResult.data;
    const eta =
      status === "building" ? new Date(Date.now() + (etaDays ?? 7) * 24 * 60 * 60 * 1000) : null;

    const doc = await FeatureRequest.findByIdAndUpdate(
      idResult.data,
      { $set: { status, eta } },
      { new: true },
    ).lean<IFeatureRequest>();
    if (!doc) {
      res.status(404).json({ error: "not_found", message: "Feature request not found" });
      return;
    }
    res.json(toRow(doc));
  });

  // POST /:id/generate: start an AI draft build (async; poll GET / for the result)
  adminRouter.post("/:id/generate", async (req, res) => {
    const idResult = idSchema.safeParse(req.params["id"]);
    if (!idResult.success) {
      res.status(400).json({ error: "validation_error", message: "Invalid id" });
      return;
    }
    const doc = await FeatureRequest.findById(idResult.data).lean<IFeatureRequest>();
    if (!doc) {
      res.status(404).json({ error: "not_found", message: "Feature request not found" });
      return;
    }
    if (doc.status !== "building") {
      res
        .status(409)
        .json({ error: "not_building", message: "Start building this feature first." });
      return;
    }
    if (doc.buildStatus === "running") {
      res
        .status(409)
        .json({ error: "build_running", message: "A draft build is already running." });
      return;
    }
    if (!opts.builder?.apiKey) {
      res.status(503).json({
        error: "builder_not_configured",
        message: "AI builder not configured (set ANTHROPIC_API_KEY).",
      });
      return;
    }
    // Atomic claim so two clicks cannot start two builds.
    const claimed = await FeatureRequest.findOneAndUpdate(
      { _id: idResult.data, buildStatus: { $ne: "running" } },
      { $set: { buildStatus: "running" }, $unset: { buildError: 1, draftSlug: 1 } },
    );
    if (!claimed) {
      res
        .status(409)
        .json({ error: "build_running", message: "A draft build is already running." });
      return;
    }
    try {
      await enqueueBuild({ id: idResult.data, term: doc.term });
    } catch (e) {
      await FeatureRequest.updateOne(
        { _id: idResult.data },
        { $set: { buildStatus: "failed", buildError: "Could not queue the build." } },
      );
      throw e;
    }
    res.status(202).json({ buildStatus: "running" });
  });

  // DELETE /:id
  adminRouter.delete("/:id", async (req, res) => {
    const idResult = idSchema.safeParse(req.params["id"]);
    if (!idResult.success) {
      res.status(400).json({ error: "validation_error", message: "Invalid id" });
      return;
    }
    const doc = await FeatureRequest.findByIdAndDelete(idResult.data).lean<IFeatureRequest>();
    if (!doc) {
      res.status(404).json({ error: "not_found", message: "Feature request not found" });
      return;
    }
    res.status(204).end();
  });

  return { publicRouter, adminRouter, processBuild };
}
