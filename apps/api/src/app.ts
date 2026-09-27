import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Request } from "express";
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
import { createDraft, processBundleJob, updateDraft, type BundleJob } from "./services/drafts";
import { featureRadarRoutes, type BuildJob } from "@ti/feature-radar/server";

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

export interface AppOptions {
  /** Overrides for the AI draft builder (tests inject a fake fetch / key). */
  builder?: { apiKey?: string; fetchImpl?: typeof fetch };
  /** Catalogue cache (tests pass one they can clear). */
  cache?: Cache;
}

export function createApp(env: Env, theme: ThemeFiles, options: AppOptions = {}) {
  const app = express();
  const auth = makeAuth(env);

  // Infrastructure: Redis when REDIS_URL is set, in-memory fallbacks otherwise.
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
  const bundleJobs = createQueue<BundleJob>("bundle-save", (job) => processBundleJob(job, cache), {
    redis,
  });
  const deps = {
    cache,
    customerLoginLimit: loginLimit("customer-login"),
    adminLoginLimit: loginLimit("admin-login"),
    registryLimit: burstLimit("registry", 60, 2),
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
          scriptSrc: ["'self'", "'sha256-nJAN6+vI38DXNyARo5GBbRuzeCwTYcvGrGig2WALhKU='"],
          frameSrc: [env.PREVIEW_ORIGIN],
          imgSrc: ["'self'", "data:"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", sameOriginWrites(env));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api", publicRoutes(auth, theme, env, deps));
  app.use("/api", customerRoutes(auth, deps));
  app.use("/api/admin", adminRoutes(auth, theme, env, deps));
  // Plugin: search-driven feature requests (plugins/feature-radar). Own models and routes.
  // AI_PROVIDER=gemini uses GEMINI_API_KEY; anything else uses ANTHROPIC_API_KEY.
  const aiProvider = process.env.AI_PROVIDER === "gemini" ? "gemini" : "anthropic";
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
      provider: aiProvider,
      apiKey:
        options.builder && "apiKey" in options.builder
          ? options.builder.apiKey
          : (aiProvider === "gemini"
              ? process.env.GEMINI_API_KEY
              : process.env.ANTHROPIC_API_KEY) || undefined,
      model:
        process.env.FEATURE_BUILDER_MODEL ??
        (aiProvider === "gemini" ? "gemini-2.5-flash" : "claude-sonnet-5"),
      // Fallback chain: every OpenRouter key (comma separated), then Ollama Cloud.
      fallbacks: [
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
      styleExample: readStyleExample(),
      themeClasses: THEME_CLASSES,
      allowedDependencies: ALLOWED_DEPENDENCIES,
      fetchImpl: options.builder?.fetchImpl,
    },
  });
  app.use("/api", featureRadar.publicRouter);
  app.use("/api/admin/features", featureRadar.adminRouter);
  app.use("/api", () => {
    throw new HttpError(404, "not_found", "Unknown API route.");
  });

  // Installer package built from packages/cli (npm pack).
  const cliTgz = root("packages/cli/dist/kitbase.tgz");
  app.get("/cli/kitbase.tgz", (_req, res) => {
    if (!existsSync(cliTgz)) throw new HttpError(404, "not_found", "Installer not built.");
    res.type("application/gzip").sendFile(cliTgz);
  });

  // Built frontends (production). Admin UI under /admin, catalogue at /.
  const serveSpa = (mount: string, dir: string) => {
    if (!existsSync(dir)) return;
    app.use(mount, express.static(dir, { index: false, maxAge: "1h" }));
    app.get(`${mount === "/" ? "" : mount}/{*splat}`, (_req, res) =>
      res.sendFile(`${dir}/index.html`),
    );
  };
  serveSpa("/admin", root("apps/admin/dist"));
  serveSpa("/", root("apps/web/dist"));

  app.use(errorHandler);
  /** Graceful shutdown: let running jobs finish. The shared Redis connection is closed by the caller. */
  const shutdown = async () => {
    await Promise.all([bundleJobs.close(), buildJobs.close()]);
  };
  return Object.assign(app, { shutdown });
}
