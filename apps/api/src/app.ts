import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import { getRedis } from "@ti/redis";
import { createCache, type Cache } from "@ti/cache";
import { rateLimit, slidingWindow, tokenBucket } from "@ti/rate-limit";
import { createQueue } from "@ti/queue";
import { ALLOWED_DEPENDENCIES, validateBundle, type ThemeFiles } from "@ti/core";
import type { Env } from "./config/env";
import { log } from "./utils/logger";
import { makeAuth, sameOriginWrites } from "./middleware/auth";
import { errorHandler, HttpError } from "./utils/http";
import { adminRoutes, customerRoutes, publicRoutes } from "./routes";
import { captureRoutes } from "./routes/captures";
import { adminTeamRoutes, teamRoutes } from "./routes/teams";
import { processCaptureJob, type CaptureJob } from "./services/capture";
import { CLI_SLUG, createUsageRecorder } from "./services/analytics";
import { createDraft, processBundleJob, updateDraft, type BundleJob } from "./services/drafts";
import {
  FeatureRequest,
  featureRadarRoutes,
  type BuildJob,
  type ProviderChain,
} from "@ti/feature-radar/server";
import { demandAdminRoutes, demandPublicRoutes } from "./demand/router";
import { screenRoutes } from "./routes/screens";
import { findPublishedDocs } from "./services/catalog";
import { makeScreens } from "./services/screens";
import { processScreenJob, recoverScreenJobs, type ScreenJobRef } from "./services/screenJobs";
import { processTeamBundleJob } from "./services/teamRepo";
import { renderDocument, renderSeoPage, isAppRoute } from "./seo/render";
import { canonicalOrigin, seoFileRoutes } from "./seo/files";

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

/** Key token classes from the CRM theme, given to the AI draft builder. */
const THEME_CLASSES = [
  "Surfaces: bg-crm-bg, bg-crm-card, bg-crm-raised, bg-crm-muted",
  "Text: text-crm-fg, text-crm-soft, text-crm-subtle; borders: border-crm-border",
  "Effects: shadow-crm-raised, rounded-crm; font: font-crm; type helpers: crm-caption, crm-eyebrow",
  "Tags (c = blue|green|amber|red|purple|teal|orange|yellow|moss|neutral): border-tag-<c>-border bg-tag-<c>-bg text-tag-<c>-text",
].join("\n");

function readStyleExample(): string {
  try {
    return readFileSync(root("packages/ui/src/components/crm/stat-card.tsx"), "utf8");
  } catch {
    return "";
  }
}

const PRIMARY_KEYS = {
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  inception: "INCEPTION_API_KEY",
} as const;
type PrimaryProvider = keyof typeof PRIMARY_KEYS;

const DEFAULT_INCEPTION_MODEL = "mercury-2.5";

/**
 * LLM provider chain from the environment, shared by every AI feature.
 * AI_PROVIDER=gemini uses GEMINI_API_KEY, AI_PROVIDER=inception uses INCEPTION_API_KEY
 * (model INCEPTION_MODEL); anything else uses ANTHROPIC_API_KEY.
 * Fallbacks: Inception (when its key is set and it is not the primary), every OpenRouter key
 * (comma separated), then Ollama Cloud.
 * Token use: identical requests are answered from a short-lived cache (AI_CACHE_TTL_SECONDS,
 * default 600, 0 disables) and every reply's token counts are logged.
 */
export function providerChain(
  options: AppOptions,
): Omit<ProviderChain, "apiKey"> & { apiKey: string | undefined } {
  const requested = process.env.AI_PROVIDER;
  const provider: PrimaryProvider =
    requested === "gemini" || requested === "inception" ? requested : "anthropic";
  const inceptionModel = process.env.INCEPTION_MODEL || DEFAULT_INCEPTION_MODEL;
  const cacheSeconds = Number(process.env.AI_CACHE_TTL_SECONDS ?? 600);
  return {
    provider,
    apiKey:
      options.builder && "apiKey" in options.builder
        ? options.builder.apiKey
        : process.env[PRIMARY_KEYS[provider]] || undefined,
    model:
      provider === "inception"
        ? inceptionModel
        : (process.env.FEATURE_BUILDER_MODEL ??
          (provider === "gemini" ? "gemini-2.5-flash" : "claude-sonnet-5")),
    // Tests inject a fake fetch and expect every call to reach it.
    cacheTtlMs:
      options.builder?.fetchImpl || !Number.isFinite(cacheSeconds)
        ? 0
        : Math.max(0, cacheSeconds) * 1000,
    onUsage: (u) => log.info("ai usage", { ...u }),
    fallbacks: [
      ...(provider !== "inception" && process.env.INCEPTION_API_KEY
        ? [
            {
              provider: "inception" as const,
              apiKey: process.env.INCEPTION_API_KEY,
              model: inceptionModel,
            },
          ]
        : []),
      ...(process.env.OPENROUTER_API_KEYS ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .map((apiKey) => ({
          provider: "openrouter" as const,
          apiKey,
          model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
        })),
      ...(process.env.OLLAMA_CLOUD_KEY
        ? [
            {
              provider: "ollama" as const,
              apiKey: process.env.OLLAMA_CLOUD_KEY,
              model: process.env.OLLAMA_CLOUD_MODEL ?? "gpt-oss:120b",
            },
          ]
        : []),
    ],
    fetchImpl: options.builder?.fetchImpl,
  };
}

export interface AppOptions {
  /** Overrides for the AI draft builder (tests inject a fake fetch / key). */
  builder?: { apiKey?: string; fetchImpl?: typeof fetch };
  /** Catalogue cache (tests pass one they can clear). */
  cache?: Cache;
}

/**
 * Paths that only vulnerability scanners ask for. We never serve them: a tiny 404 avoids
 * wasting bandwidth on a full SPA shell and keeps the logs useful.
 */
const SCANNER_PATH =
  /(?:^\/data:|\.env|\.git|wp-|wp-json|wp-admin|xmlrpc|META-INF|\.\.;|gcp-key|phpinfo|phpmyadmin|\.aws|\.ssh|cgi-bin|\.DS_Store|\/vendor\/)/i;

const isScannerPath = (pathname: string) => SCANNER_PATH.test(pathname);

/** 301 www -> canonical host and http -> https in production. API and non-GET traffic is left alone. */
function canonicalRedirect(env: Env) {
  const canonical = new URL(env.CANONICAL_ORIGIN ?? env.PUBLIC_ORIGIN);
  return (req: Request, res: Response, next: NextFunction) => {
    if (env.NODE_ENV !== "production") return next();
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/") || req.path.startsWith("/cli/")) return next();
    const host = (req.hostname || "").toLowerCase();
    const canonicalHost = canonical.hostname.toLowerCase();
    const isWww = host === `www.${canonicalHost}`;
    const wrongProto = canonical.protocol === "https:" && req.protocol !== "https";
    if (!isWww && !wrongProto) return next();
    const destination = isWww ? canonical.origin : `https://${host}`;
    res.redirect(301, `${destination}${req.originalUrl}`);
  };
}

export function createApp(env: Env, theme: ThemeFiles, options: AppOptions = {}) {
  const app = express();
  const auth = makeAuth(env);

  const redis = getRedis();
  const cache =
    options.cache ??
    createCache({
      redis,
      prefix: "ti:catalog:",
      defaultTtlSeconds: 60,
      // Misses only: at most one line per key per TTL, enough to prove the cache works.
      onLookup: (key, hit) => {
        if (!hit) log.info("catalog cache miss", { key, store: redis ? "redis" : "memory" });
      },
    });
  const test = env.NODE_ENV === "test"; // tests share one IP: keep limits out of their way
  const byIp = (req: Request) => req.ip ?? "unknown";
  const loginLimit = (name: string) =>
    rateLimit({
      algorithm: slidingWindow({ name, redis, limit: test ? 10_000 : 10, windowMs: 15 * 60_000 }),
      key: byIp,
      message: "Too many attempts. Try again later.",
    });
  const burstLimit = (name: string, capacity: number, refillPerSecond: number) =>
    rateLimit({
      algorithm: tokenBucket({ name, redis, capacity: test ? 10_000 : capacity, refillPerSecond }),
      key: byIp,
    });
  // Team jobs carry the server-resolved teamId and are saved through the team-scoped repo.
  const bundleJobs = createQueue<BundleJob>(
    "bundle-save",
    (job) => (job.teamId ? processTeamBundleJob(job) : processBundleJob(job, cache)),
    { redis },
  );
  // Capture Engine: one headless Chrome at a time.
  const captureJobs = createQueue<CaptureJob>("capture", processCaptureJob, { redis });
  // Anonymous usage counters, flushed to Mongo in batches (off in tests: no DB writes).
  const usage = createUsageRecorder({ enabled: !test });
  const deps = {
    cache,
    usage,
    beaconLimit: burstLimit("beacon", 120, 1),
    customerLoginLimit: loginLimit("customer-login"),
    adminLoginLimit: loginLimit("admin-login"),
    registryLimit: burstLimit("registry", 60, 2),
    teamWriteLimit: burstLimit("team-write", 30, 0.1),
    makeLimit: (name: string, key: (req: Request) => string) =>
      rateLimit({
        algorithm: tokenBucket({ name, redis, capacity: test ? 10_000 : 30, refillPerSecond: 0.1 }),
        key,
      }),
    bundleJobs,
  };
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Hash of the tiny inline theme script in apps/web/index.html (applies dark/light before first paint).
          scriptSrc: [
            "'self'",
            "'sha256-nJAN6+vI38DXNyARo5GBbRuzeCwTYcvGrGig2WALhKU='",
            "https://static.cloudflareinsights.com",
          ],
          frameSrc: [env.PREVIEW_ORIGIN],
          imgSrc: ["'self'", "data:"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: ["'self'", "https://cloudflareinsights.com"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  // Scanner probes never reach the SPA, a route handler or the database.
  app.use((req, res, next) => {
    if (!isScannerPath(req.path)) return next();
    log.warn("blocked scanner path", { path: req.path.slice(0, 200) });
    res.status(404).set("Cache-Control", "no-store").type("text/plain").send("Not found");
  });
  app.use(canonicalRedirect(env));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", sameOriginWrites(env));

  // Minimal, dependency-free liveness response. Uptime monitors hit this often; it must not
  // touch Mongo/Redis and must never be cached.
  app.get("/api/health", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ ok: true });
  });
  // Coarse safety net for API probing; auth routes have their own, stricter limits.
  app.use("/api", burstLimit("api-global", 600, 5));
  app.use("/api", publicRoutes(auth, theme, env, deps));
  app.use("/api", customerRoutes(auth, deps));
  // Team workspaces: private components, members, invites (routes/teams.ts).
  app.use("/api", teamRoutes(auth, theme, env, deps));
  app.use("/api/admin/teams", adminTeamRoutes(auth));
  app.use(
    "/api/admin/captures",
    captureRoutes(auth, { captureJobs, captureLimit: burstLimit("capture", 5, 0.02) }),
  );
  app.use("/api/admin", adminRoutes(auth, theme, env, deps));
  // Prompt to screen: AI composes a page tree from published components (services/screens).
  const chain = providerChain(options);
  const screens = makeScreens({
    theme,
    apiOrigin: env.PUBLIC_ORIGIN,
    chain:
      chain.apiKey || chain.fallbacks?.length ? { ...chain, apiKey: chain.apiKey ?? "" } : null,
    loadPublished: async () =>
      (await findPublishedDocs(cache)).flatMap((d) => (d.published ? [d.published] : [])),
  });
  const screenLimits = {
    generateLimit: burstLimit("screens-generate", 5, 0.05),
    renderLimit: burstLimit("screens-render", 30, 1),
  };
  // AI screen generation: time-consuming, so it runs on the queue and persists progress in Mongo.
  const screenJobs = createQueue<ScreenJobRef>("screens", (job) => processScreenJob(job, screens), {
    redis,
  });
  void recoverScreenJobs(screenJobs).catch((e: unknown) =>
    log.warn("screen job recovery failed", { error: String(e) }),
  );
  app.use("/api/screens", screenRoutes(auth, screens, { ...screenLimits, screenJobs }, "public"));
  app.use(
    "/api/admin/screens",
    screenRoutes(auth, screens, { ...screenLimits, screenJobs }, "admin"),
  );
  // Plugin: search-driven feature requests (plugins/feature-radar). Own models and routes.
  // AI draft builds are slow (LLM calls): they always go through the queue.
  const buildJobs = createQueue<BuildJob>(
    "feature-build",
    (job) => featureRadar.processBuild(job),
    {
      redis,
    },
  );
  const featureRadar = featureRadarRoutes({
    requireAdmin: auth.requireAdmin,
    searchLimiter: burstLimit("feature-search", 30, 0.5),
    enqueueBuild: (job) => buildJobs.add(job),
    // Regenerate replaces the existing draft (the live published version is untouched).
    createDraft: async (bundle) => {
      try {
        return await createDraft(bundle);
      } catch (e) {
        const slug = (bundle as { slug?: unknown }).slug;
        if (!(e instanceof HttpError && e.code === "slug_taken") || typeof slug !== "string")
          throw e;
        await updateDraft(slug, bundle, cache);
        return { slug };
      }
    },
    validate: (b) => {
      const r = validateBundle(b);
      return r.ok ? { ok: true } : { ok: false, errors: r.errors };
    },
    builder: {
      ...chain,
      styleExample: readStyleExample(),
      themeClasses: THEME_CLASSES,
      allowedDependencies: ALLOWED_DEPENDENCIES,
    },
  });
  app.use("/api", featureRadar.publicRouter);
  app.use("/api/admin/features", featureRadar.adminRouter);
  // Demand pipeline: anonymous search signals, a public request board, GSC imports, quality
  // gates and human-approved publishing. The AI draft step reuses the feature-radar builder.
  const demandOptions = {
    auth,
    cache,
    env,
    requireAdmin: auth.requireAdmin,
    searchLimit: burstLimit("demand-search", 60, 1),
    writeLimit: burstLimit("demand-write", 20, 0.05),
    adminWriteLimit: burstLimit("demand-admin", 60, 0.5),
    enqueueDraft: async (_opportunityId: string, term: string) => {
      const feature = await FeatureRequest.findOneAndUpdate(
        { term },
        {
          $set: { status: "building", lastSearchedAt: new Date() },
          $setOnInsert: { term, searchCount: 1, createdAt: new Date() },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      await buildJobs.add({ id: String(feature._id), term });
      return String(feature._id);
    },
  };
  app.use("/api/demand", demandPublicRoutes(demandOptions));
  app.use("/api/admin/demand", demandAdminRoutes(demandOptions));
  app.use("/api", () => {
    throw new HttpError(404, "not_found", "Unknown API route.");
  });

  // Installer package built from packages/cli (npm pack).
  const cliTgz = root("packages/cli/dist/kitbase.tgz");
  app.get("/cli/kitbase.tgz", (_req, res) => {
    if (!existsSync(cliTgz)) throw new HttpError(404, "not_found", "Installer not built.");
    usage.record(CLI_SLUG, "install");
    // Not versioned in the URL: let clients revalidate, but spare repeat downloads within minutes.
    res.set("Cache-Control", "public, max-age=300");
    res.type("application/gzip").sendFile(cliTgz);
  });

  // Crawler/agent files must be generated from the live catalogue, not the stale public/ copies.
  app.use("/", seoFileRoutes(auth, theme, env, cache));

  // Built frontends (production). Admin UI under /admin, catalogue at /.
  const serveSpa = (mount: string, dir: string, seo = false) => {
    if (!existsSync(dir)) return;
    // Vite emits content-hashed files under assets/: cache them for a year. HTML must revalidate.
    app.use(
      `${mount === "/" ? "" : mount}/assets`,
      express.static(`${dir}/assets`, { index: false, immutable: true, maxAge: "365d" }),
    );
    app.use(
      mount,
      express.static(dir, {
        index: false,
        maxAge: "1h",
        setHeaders: (res, file) => {
          if (file.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
        },
      }),
    );
    if (!seo) {
      // `root` keeps the dotfile check to "index.html" only, so a checkout under a dot folder works.
      app.get(`${mount === "/" ? "" : mount}/{*splat}`, (_req, res) =>
        res.sendFile("index.html", { root: dir }),
      );
      return;
    }
    // Public catalogue: render real HTML (head + body) for every route. Unknown URLs get a
    // real 404 instead of the old catch-all index.html soft-404.
    const indexHtml = readFileSync(`${dir}/index.html`, "utf8");
    const origin = canonicalOrigin(env);
    const handler = async (req: Request, res: Response) => {
      const pathname = req.path;
      // Missing hashed assets and other file-looking paths should not return an HTML shell.
      if (/\.[a-z0-9]+$/i.test(pathname) && !isAppRoute(pathname)) {
        res.status(404).set("Cache-Control", "no-store").type("text/plain").send("Not found");
        return;
      }
      const page = await renderSeoPage(pathname, {
        origin,
        cache,
        analyticsToken: env.CF_ANALYTICS_TOKEN,
      });
      const status = page?.status ?? 404;
      res
        .status(status)
        // Real pages must revalidate; error pages must never be cached.
        .set("Cache-Control", status >= 400 ? "no-store" : "no-cache")
        .type("html")
        .send(
          page
            ? renderDocument(indexHtml, page, { analyticsToken: env.CF_ANALYTICS_TOKEN })
            : "Not found",
        );
    };
    if (mount === "/") {
      app.get("/", handler);
      app.get("/{*splat}", handler);
    } else {
      app.get(`${mount}/{*splat}`, handler);
    }
  };
  serveSpa("/admin", root("apps/admin/dist"));
  serveSpa("/", root("apps/web/dist"), true);

  app.use(errorHandler);
  /** Graceful shutdown: let running jobs finish. The shared Redis connection is closed by the caller. */
  const shutdown = async () => {
    await Promise.all([
      usage.close(),
      bundleJobs.close(),
      buildJobs.close(),
      captureJobs.close(),
      screenJobs.close(),
    ]);
  };
  return Object.assign(app, { shutdown });
}
