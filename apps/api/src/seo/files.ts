/**
 * Public, crawler- and agent-facing files generated from the live catalogue.
 *
 * These are routes rather than files in `apps/web/public` so the sitemap, llms.txt and the
 * registry always match what is actually published. They are mounted before the static SPA,
 * so the copies in `public/` never win.
 */
import { Router } from "express";
import { slugSchema, type ThemeFiles } from "@ti/core";
import type { Cache } from "@ti/cache";
import type { Env } from "../config/env";
import { makeCatalog, findPublishedDocs } from "../services/catalog";
import { log } from "../utils/logger";
import type { Auth } from "../middleware/auth";
import type { ComponentRecord } from "../models";
import type { Bundle } from "@ti/core";

const trimOrigin = (origin: string) => origin.replace(/\/+$/, "");

export const canonicalOrigin = (env: Env) => trimOrigin(env.CANONICAL_ORIGIN ?? env.PUBLIC_ORIGIN);

const categorySlug = (category: string) =>
  category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const xmlEscape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Cache stores JSON, so a date can come back as an ISO string. Normalise at the boundary. */
const asDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const day = (value: unknown) => (asDate(value) ?? new Date()).toISOString().slice(0, 10);

const published = (docs: ComponentRecord[]): (ComponentRecord & { published: Bundle })[] =>
  docs.filter((d): d is ComponentRecord & { published: Bundle } => !!d.published);

const latest = (docs: (ComponentRecord & { published: Bundle })[]) =>
  docs.reduce<Date | undefined>((max, d) => {
    const at = asDate(d.publishedAt);
    return at && (!max || at > max) ? at : max;
  }, undefined);

export function buildRobots(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /admin",
    "Disallow: /account",
    "Disallow: /sign-in",
    "Disallow: /sign-up",
    "Disallow: /join",
    "Disallow: /teams/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

export function buildSitemap(origin: string, docs: ComponentRecord[]): string {
  const live = published(docs);
  const last = latest(live);
  const categories = [...new Set(live.map((d) => d.published.category))].sort();
  const urls: { loc: string; lastmod: string }[] = [
    { loc: "/", lastmod: day(last) },
    { loc: "/components", lastmod: day(last) },
    { loc: "/docs/get-started", lastmod: day(last) },
    { loc: "/screens", lastmod: day(last) },
    { loc: "/theme", lastmod: day(last) },
    { loc: "/builder", lastmod: day(last) },
    { loc: "/requests", lastmod: day(last) },
    { loc: "/changelog", lastmod: day(last) },
    ...categories.map((c) => ({
      loc: `/components/category/${categorySlug(c)}`,
      lastmod: day(latest(live.filter((d) => d.published.category === c)) ?? last),
    })),
    ...live.map((d) => ({
      loc: `/components/${d.slug}`,
      lastmod: day(d.publishedAt),
    })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${xmlEscape(`${origin}${u.loc}`)}</loc><lastmod>${u.lastmod}</lastmod></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildLlmsTxt(origin: string, docs: ComponentRecord[]): string {
  const live = published(docs).sort(
    (a, b) =>
      a.published.category.localeCompare(b.published.category) ||
      a.published.name.localeCompare(b.published.name),
  );
  const byCategory = new Map<string, typeof live>();
  for (const d of live) {
    const list = byCategory.get(d.published.category) ?? [];
    list.push(d);
    byCategory.set(d.published.category, list);
  }
  const components = [...byCategory.entries()]
    .map(
      ([category, list]) =>
        `### ${category}\n${list
          .map(
            (d) =>
              `- [${d.published.name}](${origin}/components/${d.slug}): ${d.published.description.replace(/\s+/g, " ")}`,
          )
          .join("\n")}`,
    )
    .join("\n\n");
  return `# Kitbase

> Open-source CRM-themed React components. Copy the code, install with the CLI, or hand a component to an AI agent.

Kitbase publishes plain React + TypeScript components styled with Tailwind CSS v4. Every component
page includes a live preview, source files, a props table, dependencies and an install command.
Everything here is generated from the live catalogue.

## Docs

- [Get started](${origin}/docs/get-started): requirements, Tailwind setup, CLI installation and agent prompts.
- [All components](${origin}/components): browse every published component by category.
- [Prompt to screen](${origin}/screens): describe a CRM screen and compose it from catalogue components.
- [Theme studio](${origin}/theme): edit light/dark CRM design tokens and export CSS.
- [Page builder](${origin}/builder): compose pages visually and export React code.
- [Component requests](${origin}/requests): request a component and vote on what ships next.
- [Changelog](${origin}/changelog): components published recently.

## Agent files

- [registry.json](${origin}/registry.json): index of installable components.
- [sitemap.xml](${origin}/sitemap.xml): every canonical public URL.
- Individual registry items: \`${origin}/r/<slug>.json\` (for example \`${origin}/r/data-table.json\`).

## Components

${components}
`;
}

interface RegistryIndexItem {
  name: string;
  type: "registry:component";
  title: string;
  description: string;
  dependencies: string[];
  registryDependencies: string[];
  files: { path: string; type: string }[];
  meta: {
    category: string;
    access: "free" | "premium";
    version: string;
    url: string;
  };
}

export function buildRegistryIndex(origin: string, docs: ComponentRecord[]) {
  const live = published(docs).sort((a, b) => a.slug.localeCompare(b.slug));
  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "kitbase",
    homepage: origin,
    items: live.map((d): RegistryIndexItem => ({
      name: d.slug,
      type: "registry:component",
      title: d.published.name,
      description: d.published.description,
      dependencies: d.published.dependencies,
      registryDependencies: [],
      // The source is fetched from the per-item endpoint, which enforces access.
      files: d.published.files.map((f) => ({
        path: f.path,
        type: f.path.endsWith(".css") ? "registry:style" : "registry:component",
      })),
      meta: {
        category: d.published.category,
        access: d.published.access,
        version: d.published.version,
        url: `${origin}/r/${d.slug}.json`,
      },
    })),
  };
}

/** Full shadcn-compatible item, including file contents. Access is checked per viewer. */
export function buildRegistryItem(origin: string, slug: string, item: unknown) {
  const i = item as {
    name: string;
    description: string;
    dependencies: string[];
    files: { path: string; content: string }[];
    example?: string;
  };
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: slug,
    type: "registry:component",
    title: i.name,
    description: i.description,
    dependencies: i.dependencies,
    registryDependencies: [],
    files: i.files.map((f) => ({
      path: f.path,
      type: f.path.endsWith(".css") ? "registry:style" : "registry:component",
      content: f.content,
    })),
    docs: `${origin}/components/${slug}`,
    ...(i.example ? { meta: { example: i.example } } : {}),
  };
}

/**
 * Mounted at `/` before the static SPA. The handlers share the same cache and auth as `/api`,
 * so publishing a component updates the sitemap/llms/registry within one cache TTL (60 s).
 */
export function seoFileRoutes(auth: Auth, theme: ThemeFiles, env: Env, cache: Cache) {
  const r = Router();
  const origin = canonicalOrigin(env);
  const catalog = makeCatalog(theme, env.PUBLIC_ORIGIN, cache);

  r.get("/robots.txt", (_req, res) => {
    // Static file: no database work, so it stays fast under crawler load.
    res
      .type("text/plain; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(buildRobots(origin));
  });

  r.get("/sitemap.xml", async (_req, res, next) => {
    try {
      const docs = await findPublishedDocs(cache);
      res
        .type("application/xml; charset=utf-8")
        .set("Cache-Control", "public, max-age=3600")
        .send(buildSitemap(origin, docs));
    } catch (e) {
      next(e);
    }
  });

  r.get("/llms.txt", async (_req, res, next) => {
    try {
      const docs = await findPublishedDocs(cache);
      res
        .type("text/plain; charset=utf-8")
        .set("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
        .send(buildLlmsTxt(origin, docs));
    } catch (e) {
      next(e);
    }
  });

  r.get("/registry.json", async (_req, res, next) => {
    try {
      const docs = await findPublishedDocs(cache);
      res
        .type("application/json; charset=utf-8")
        .set("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
        .json(buildRegistryIndex(origin, docs));
    } catch (e) {
      next(e);
    }
  });

  r.get("/r/:slug.json", async (req, res, next) => {
    const parsed = slugSchema.safeParse(req.params.slug);
    if (!parsed.success) {
      res.status(404).json({ error: "not_found", message: "Component not found." });
      return;
    }
    try {
      const item = await catalog.registryItem(parsed.data, await auth.viewer(req));
      log.info("registry item downloaded", { slug: parsed.data });
      res
        .type("application/json; charset=utf-8")
        // Authorised responses can contain premium source: never put them in a shared cache.
        .set("Cache-Control", "private, max-age=60")
        .json(buildRegistryItem(origin, parsed.data, item));
    } catch (e) {
      next(e);
    }
  });

  return r;
}
