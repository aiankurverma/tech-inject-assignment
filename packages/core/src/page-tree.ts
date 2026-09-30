/**
 * Page tree: a JSON description of a screen composed only from catalogue components.
 * Shared by the AI "prompt to screen" generator (API), the preview and the exporter (web/admin).
 *
 * Node `type` is a registry slug ("stat-card"), or "<slug>/<Export>" for a secondary export of
 * that component ("card/CardHeader"). The reserved type "text" renders `props.text` as a string.
 */
import { z } from "zod";
import type { Bundle } from "./bundle";
import { installCommand } from "./registry";

export const TEXT_NODE = "text";

export const PAGE_TREE_LIMITS = {
  maxDepth: 8,
  maxNodes: 80,
  maxBytes: 60_000,
  maxPropBytes: 4_000,
} as const;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface PageNode {
  id: string;
  type: string;
  props?: Record<string, JsonValue>;
  children?: PageNode[];
}

/**
 * Visual builder variant of the page tree (apps/web/src/builder): explicit layout nodes
 * (`section|row|column`) wrap component nodes that carry the registry `slug`.
 * Kept next to `PageNode` so both page-tree formats live in one place.
 */
export type BuilderLayoutType = "section" | "row" | "column";
export type BuilderNodeType = "page" | BuilderLayoutType | "component";

export interface BuilderNode {
  id: string;
  type: BuilderNodeType;
  /** Registry slug; only for `type === "component"`. */
  slug?: string;
  props: Record<string, unknown>;
  children: BuilderNode[];
}

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);

const nodeType = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*(\/[A-Z][A-Za-z0-9]*)?$/, "use a registry slug, or slug/Export");

export const pageNodeSchema: z.ZodType<PageNode> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1).max(40),
      type: nodeType,
      props: z.record(jsonValue).optional(),
      children: z.array(pageNodeSchema).optional(),
    })
    .strict(),
);

/** One catalogue component as the tree validator and code generator see it. */
export interface PageComponent {
  slug: string;
  name: string;
  description: string;
  /** Exported identifiers of the main file; the first one is the default for a bare slug. */
  exports: string[];
  props: { name: string; type: string; required?: boolean }[];
  dependencies: string[];
  files: { path: string; content: string }[];
}

const pascal = (slug: string) =>
  slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

/** PascalCase exports of the component's main file, main component first. */
export function componentExports(bundle: Pick<Bundle, "slug" | "files">): string[] {
  const main =
    bundle.files.find((f) => f.path === `components/crm/${bundle.slug}.tsx`) ?? bundle.files[0];
  if (!main) return [];
  const names = new Set<string>();
  const decl = /export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Z][A-Za-z0-9]*)/g;
  for (const m of main.content.matchAll(decl)) if (m[1]) names.add(m[1]);
  const list = /export\s*\{([^}]+)\}/g;
  for (const m of main.content.matchAll(list)) {
    for (const part of (m[1] ?? "").split(",")) {
      const name =
        part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim() ?? "";
      if (/^[A-Z][A-Za-z0-9]*$/.test(name)) names.add(name);
    }
  }
  const all = [...names];
  const preferred = pascal(bundle.slug);
  return all.includes(preferred) ? [preferred, ...all.filter((n) => n !== preferred)] : all;
}

export function toPageComponent(bundle: Bundle): PageComponent {
  return {
    slug: bundle.slug,
    name: bundle.name,
    description: bundle.description,
    exports: componentExports(bundle),
    props: bundle.props.map((p) => ({ name: p.name, type: p.type, required: p.required })),
    dependencies: bundle.dependencies,
    files: bundle.files,
  };
}

/** Compact catalogue text for the AI prompt: one line per component. */
export function catalogueSummary(components: PageComponent[]): string {
  return components
    .map((c) => {
      const props = c.props
        .slice(0, 8)
        .map((p) => `${p.name}${p.required ? "*" : ""}: ${p.type.slice(0, 40)}`)
        .join(", ");
      const exports = c.exports.length > 1 ? ` exports: ${c.exports.join(", ")}.` : "";
      return `- ${c.slug}: ${c.description.slice(0, 110)}${exports}${props ? ` props: ${props}` : ""}`;
    })
    .join("\n");
}

export type PageTreeResult = { ok: true; tree: PageNode } | { ok: false; errors: string[] };

/** Splits "card/CardHeader" into slug and export; a bare slug means the main export. */
export function splitType(type: string): { slug: string; exportName?: string } {
  const [slug = "", exportName] = type.split("/");
  return exportName ? { slug, exportName } : { slug };
}

/** Schema check plus the rules zod cannot express: known slugs and exports, ids, depth and size. */
export function validatePageTree(input: unknown, components: PageComponent[]): PageTreeResult {
  const raw = JSON.stringify(input) ?? "";
  if (raw.length > PAGE_TREE_LIMITS.maxBytes)
    return { ok: false, errors: [`page tree larger than ${PAGE_TREE_LIMITS.maxBytes} bytes`] };
  const parsed = pageNodeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues
        .slice(0, 20)
        .map((i) => `${i.path.join(".") || "tree"}: ${i.message}`),
    };
  }
  const bySlug = new Map(components.map((c) => [c.slug, c]));
  const errors: string[] = [];
  const ids = new Set<string>();
  let count = 0;
  const walk = (node: PageNode, depth: number) => {
    count += 1;
    if (count > PAGE_TREE_LIMITS.maxNodes) return;
    if (depth > PAGE_TREE_LIMITS.maxDepth) {
      errors.push(`${node.id}: nested deeper than ${PAGE_TREE_LIMITS.maxDepth} levels`);
      return;
    }
    if (ids.has(node.id)) errors.push(`${node.id}: duplicate id`);
    ids.add(node.id);
    if (node.props && JSON.stringify(node.props).length > PAGE_TREE_LIMITS.maxPropBytes)
      errors.push(`${node.id}: props larger than ${PAGE_TREE_LIMITS.maxPropBytes} bytes`);
    if (node.type === TEXT_NODE) {
      if (typeof node.props?.text !== "string")
        errors.push(`${node.id}: text node needs props.text`);
      if (node.children?.length) errors.push(`${node.id}: text node cannot have children`);
    } else {
      const { slug, exportName } = splitType(node.type);
      const c = bySlug.get(slug);
      if (!c) errors.push(`${node.id}: unknown component "${slug}"`);
      else if (exportName && !c.exports.includes(exportName))
        errors.push(`${node.id}: "${slug}" has no export "${exportName}"`);
      else if (!exportName && c.exports.length === 0)
        errors.push(`${node.id}: "${slug}" exports no component`);
    }
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(parsed.data, 1);
  if (count > PAGE_TREE_LIMITS.maxNodes)
    errors.push(`page tree has more than ${PAGE_TREE_LIMITS.maxNodes} nodes`);
  const unique = [...new Set(errors)];
  return unique.length ? { ok: false, errors: unique } : { ok: true, tree: parsed.data };
}

/** Registry slugs used anywhere in the tree, in first-seen order. */
export function treeSlugs(tree: PageNode): string[] {
  const out: string[] = [];
  const walk = (n: PageNode) => {
    if (n.type !== TEXT_NODE) {
      const { slug } = splitType(n.type);
      if (!out.includes(slug)) out.push(slug);
    }
    n.children?.forEach(walk);
  };
  walk(tree);
  return out;
}

const jsxText = (s: string) =>
  s.replace(/[{}<>]/g, (c) => `{${JSON.stringify(c)}}`).replace(/\n/g, " ");

function jsxProps(props: Record<string, JsonValue> | undefined): string {
  if (!props) return "";
  return Object.entries(props)
    .filter(([k]) => /^[a-zA-Z_$][\w$]*$/.test(k) && k !== "children")
    .map(([k, v]) => {
      if (v === true) return ` ${k}`;
      if (typeof v === "string" && !/["\\\n]/.test(v)) return ` ${k}="${v}"`;
      return ` ${k}={${JSON.stringify(v)}}`;
    })
    .join("");
}

/**
 * Per-node error boundary for generated page previews (builder and prompt-to-screen).
 * The preview sandbox registers `globalThis.KitbasePreviewGuard`; this prelude falls back to a
 * pass-through so preview code still runs on an older sandbox. Never part of exported code.
 */
export const PREVIEW_GUARD_PRELUDE =
  "const KitbasePreviewGuard = ((globalThis as any).KitbasePreviewGuard ?? ((p: { children?: unknown }) => p.children)) as any;";

/** Wraps one element's JSX lines in the preview guard, labelled with the component slug. */
export function guardLines(label: string, lines: string[], indent: string): string[] {
  return [
    `${indent}<KitbasePreviewGuard label=${JSON.stringify(label)}>`,
    ...lines.map((l) => `  ${l}`),
    `${indent}</KitbasePreviewGuard>`,
  ];
}

export interface PageCodeOptions {
  /** Wrap each primary component (not `slug/Export` parts) in the preview error boundary. */
  guard?: boolean;
}

/**
 * Page.tsx source for a validated tree: one import per component, then the JSX.
 * Component names are imported as-is; a "text" node becomes a string child.
 */
export function pageCode(
  tree: PageNode,
  components: PageComponent[],
  options: PageCodeOptions = {},
): string {
  const bySlug = new Map(components.map((c) => [c.slug, c]));
  const imports = new Map<string, Set<string>>();
  const name = (type: string): string => {
    const { slug, exportName } = splitType(type);
    const c = bySlug.get(slug);
    const n = exportName ?? c?.exports[0] ?? pascal(slug);
    const set = imports.get(slug) ?? new Set<string>();
    set.add(n);
    imports.set(slug, set);
    return n;
  };
  const render = (node: PageNode, indent: string): string => {
    if (node.type === TEXT_NODE) return `${indent}${jsxText(String(node.props?.text ?? ""))}`;
    const tag = name(node.type);
    const props = jsxProps(node.props);
    const kids = (node.children ?? []).map((c) => render(c, `${indent}  `));
    const el = !kids.length
      ? `${indent}<${tag}${props} />`
      : `${indent}<${tag}${props}>\n${kids.join("\n")}\n${indent}</${tag}>`;
    // Secondary exports (card/CardHeader) stay unwrapped: parents may inspect their children.
    const { slug, exportName } = splitType(node.type);
    if (!options.guard || exportName) return el;
    return guardLines(slug, el.split("\n"), indent).join("\n");
  };
  const body = render(tree, "      ");
  const importLines = [...imports.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([slug, names]) =>
        `import { ${[...names].sort().join(", ")} } from "@/components/crm/${slug}";`,
    );
  return [
    ...importLines,
    "",
    ...(options.guard ? [PREVIEW_GUARD_PRELUDE, ""] : []),
    "export default function Page() {",
    "  return (",
    '    <div className="min-h-screen bg-crm-bg p-6 font-crm text-crm-fg">',
    body,
    "    </div>",
    "  );",
    "}",
    "",
  ].join("\n");
}

export interface PageExport {
  slugs: string[];
  code: string;
  /** `code` with per-component error boundaries, for the sandboxed preview only. */
  previewCode: string;
  dependencies: string[];
  /** Files from every used component, deduplicated by path (shared helpers appear once). */
  files: { path: string; content: string }[];
  installCommand: string;
}

/** Everything a consumer needs to drop the page into their project. */
export function exportPage(
  tree: PageNode,
  components: PageComponent[],
  apiOrigin: string,
): PageExport {
  const bySlug = new Map(components.map((c) => [c.slug, c]));
  const slugs = treeSlugs(tree);
  const used = slugs.map((s) => bySlug.get(s)).filter((c): c is PageComponent => c != null);
  const files = new Map<string, string>();
  for (const c of used)
    for (const f of c.files) if (!files.has(f.path)) files.set(f.path, f.content);
  const deps = new Set<string>(["clsx", "tailwind-merge"]);
  for (const c of used) for (const d of c.dependencies) if (d !== "react") deps.add(d);
  return {
    slugs,
    code: pageCode(tree, components),
    previewCode: pageCode(tree, components, { guard: true }),
    dependencies: [...deps].sort(),
    files: [...files].map(([path, content]) => ({ path, content })),
    installCommand: slugs.map((s) => installCommand(apiOrigin, s)).join("\n"),
  };
}
