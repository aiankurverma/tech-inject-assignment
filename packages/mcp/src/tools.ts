// Tool handlers. Pure apart from the injected API client and file-system helpers, so they unit test cleanly.
import path from "node:path";
import { checkRegistryItem, planWrites } from "../../cli/lib.js";
import type { Api } from "./api.js";

export interface ListItem {
  slug: string;
  name: string;
  description: string;
  category: string;
  access: "free" | "premium";
  locked: string | null;
}

export interface FsLike {
  exists(abs: string): boolean;
  read(abs: string): string;
  write(abs: string, content: string): void;
}

export interface ToolDeps {
  api: Api;
  fs: FsLike;
  /** Default project root when a call gives no `dir`. */
  cwd: string;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_RESULTS = 25;

function assertSlug(slug: string) {
  if (!SLUG.test(slug)) throw new Error(`Invalid component slug: ${JSON.stringify(slug)}`);
}

const listAll = (api: Api) => api.get<ListItem[]>("/components");

export async function searchComponents(
  deps: ToolDeps,
  input: { query: string; category?: string },
) {
  const terms = input.query.toLowerCase().split(/\s+/).filter(Boolean);
  const category = input.category?.toLowerCase();
  const scored = (await listAll(deps.api))
    .filter((c) => !category || c.category.toLowerCase() === category)
    .map((c) => {
      const name = `${c.slug} ${c.name}`.toLowerCase();
      const text = `${name} ${c.description} ${c.category}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (!text.includes(t)) return { c, score: -1 };
        score += name.includes(t) ? 2 : 1;
      }
      if (c.slug === input.query.toLowerCase()) score += 10;
      return { c, score };
    })
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score || a.c.slug.localeCompare(b.c.slug));
  return {
    total: scored.length,
    results: scored.slice(0, MAX_RESULTS).map(({ c }) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      category: c.category,
      access: c.access,
      locked: c.locked,
    })),
  };
}

export async function listCategories(deps: ToolDeps) {
  const counts = new Map<string, number>();
  for (const c of await listAll(deps.api))
    counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, count]) => ({ category, count }));
}

interface Detail {
  slug: string;
  name: string;
  description: string;
  category: string;
  access: string;
  version: string;
  locked: string | null;
  props?: unknown;
  usage?: unknown;
  examples?: unknown;
  dependencies?: string[];
  installCommand?: string;
}

export async function getComponent(deps: ToolDeps, input: { slug: string }) {
  assertSlug(input.slug);
  const d = await deps.api.get<Detail>(`/components/${input.slug}`);
  const base = {
    slug: d.slug,
    name: d.name,
    description: d.description,
    category: d.category,
    access: d.access,
    version: d.version,
  };
  if (d.locked) {
    return {
      ...base,
      locked: d.locked,
      hint: deps.api.hasToken
        ? "Your KITBASE_TOKEN does not grant access to this premium component."
        : "Premium component: set KITBASE_TOKEN to a token from your Kitbase Account page.",
    };
  }
  return {
    ...base,
    locked: null,
    props: d.props,
    usage: d.usage,
    examples: d.examples,
    dependencies: d.dependencies ?? [],
    installCommand: d.installCommand,
  };
}

export async function installComponent(
  deps: ToolDeps,
  input: { slug: string; dir?: string; src?: string; overwrite?: boolean; dryRun?: boolean },
) {
  assertSlug(input.slug);
  const root = path.resolve(deps.cwd, input.dir ?? ".");
  if (!deps.fs.exists(path.join(root, "package.json"))) {
    throw new Error(`No package.json in ${root}. Pass "dir" pointing at your project root.`);
  }
  const srcDir = input.src ?? "src";
  const item = checkRegistryItem(await deps.api.get(`/registry/${input.slug}`));
  const plan = planWrites(item.files, {
    root,
    srcDir,
    overwrite: input.overwrite ?? false,
    readExisting: (abs) => (deps.fs.exists(abs) ? deps.fs.read(abs) : null),
  });

  const conflicts = plan.filter((p) => p.action === "conflict").map((p) => `${srcDir}/${p.path}`);
  if (conflicts.length) {
    return {
      installed: false,
      conflicts,
      message:
        "Files already exist with different content. Nothing was written. Retry with overwrite: true to replace them.",
    };
  }
  if (!input.dryRun) {
    for (const p of plan) if (p.action !== "unchanged") deps.fs.write(p.abs, p.content);
  }
  return {
    installed: !input.dryRun,
    dryRun: Boolean(input.dryRun),
    root,
    files: plan.map((p) => ({ path: `${srcDir}/${p.path}`, action: p.action })),
    dependencies: item.dependencies,
    nextSteps: [
      item.dependencies.length ? `npm install ${item.dependencies.join(" ")}` : null,
      `Import "./styles/crm-theme.css" after "tailwindcss" in your main CSS (Geist font import first).`,
      `Make sure "@/..." resolves to ${srcDir}/ (tsconfig paths + bundler alias).`,
    ].filter(Boolean),
  };
}
