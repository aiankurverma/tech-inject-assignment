/** Generates Page.tsx (and the install list) from a builder tree. Pure: no DOM, no fetch. */
import { guardLines, installCommand, PREVIEW_GUARD_PRELUDE } from "@ti/core";
import { usedSlugs } from "./tree";
import type { ComponentDetail, ComponentMeta, PageNode } from "./types";

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*["'](@\/components\/[^"']+)["']/g;

export const pascalCase = (slug: string) =>
  slug
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((s) => s[0]!.toUpperCase() + s.slice(1))
    .join("");

/**
 * Finds the component's export name and import path. The first example is the source of truth
 * (it shows how the author uses the component); the first bundle file is the fallback.
 */
export function resolveComponentMeta(detail: ComponentDetail, apiOrigin = ""): ComponentMeta {
  const fallbackPath = (
    detail.files?.find((f) => f.path.startsWith("components/"))?.path ?? ""
  ).replace(/\.tsx?$/, "");
  let exportName = pascalCase(detail.slug);
  let importPath = fallbackPath ? `@/${fallbackPath}` : `@/components/crm/${detail.slug}`;

  const code = detail.examples?.[0]?.code ?? "";
  const candidates: { name: string; path: string }[] = [];
  for (const m of code.matchAll(IMPORT_RE)) {
    for (const spec of (m[1] ?? "").split(",")) {
      // `Foo`, `type Foo` and `Foo as Bar` -> exported name; skip type-only imports.
      const s = spec.trim();
      if (!s || s.startsWith("type ")) continue;
      const name = s.split(/\s+as\s+/)[0]!.trim();
      if (/^[A-Z]/.test(name)) candidates.push({ name, path: m[2]! });
    }
  }
  if (candidates.length) {
    // Prefer an import whose name matches the slug, then the first one from the component's own file.
    const byName = candidates.find((c) => c.name.toLowerCase() === exportName.toLowerCase());
    const byFile = candidates.find((c) => `@/${fallbackPath}` === c.path);
    const pick = byName ?? byFile ?? candidates[0]!;
    exportName = pick.name;
    importPath = pick.path;
  }
  return {
    slug: detail.slug,
    name: detail.name,
    exportName,
    importPath,
    installCommand: detail.installCommand ?? installCommand(apiOrigin, detail.slug),
    dependencies: detail.dependencies ?? [],
  };
}

const escapeText = (s: string) => s.replace(/[{}<>]/g, (c) => `{${JSON.stringify(c)}}`);

/** `name="x"`, `flag`, `count={3}`, `items={[...]}`; null for values that should be omitted. */
export function formatProp(name: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value === true) return name;
  if (typeof value === "string") {
    return /["\n\\]/.test(value) ? `${name}={${JSON.stringify(value)}}` : `${name}="${value}"`;
  }
  return `${name}={${JSON.stringify(value)}}`;
}

const str = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);

/** Tailwind classes for a layout node from its props. */
export function layoutClass(node: PageNode): string {
  const gap = `gap-${str(node.props.gap, "4")}`;
  switch (node.type) {
    case "page":
      return "flex min-h-screen w-full flex-col gap-6 bg-crm-bg p-6 font-crm text-crm-fg";
    case "section":
      return `flex flex-col ${gap}`;
    case "row":
      return `flex flex-wrap items-${str(node.props.align, "start")} ${gap}`;
    case "column": {
      const basis = str(node.props.basis, "auto");
      return `flex min-w-0 flex-col ${gap} ${basis === "auto" ? "flex-1" : `basis-${basis}`}`;
    }
    default:
      return "";
  }
}

export interface GeneratedPage {
  code: string;
  /** Slugs in document order. */
  slugs: string[];
  /** Slugs with no metadata (locked or still loading); rendered as comments. */
  missing: string[];
  /** One CLI command per component. */
  install: string[];
  /** npm packages the components need. */
  dependencies: string[];
}

function emit(
  node: PageNode,
  metas: Record<string, ComponentMeta | undefined>,
  indent: number,
  missing: string[],
  guard = false,
): string[] {
  const pad = "  ".repeat(indent);
  if (node.type === "component" && guard && node.slug && metas[node.slug]) {
    return guardLines(node.slug, emit(node, metas, indent, missing), pad);
  }
  if (node.type === "component") {
    const meta = node.slug ? metas[node.slug] : undefined;
    if (!meta) {
      if (node.slug && !missing.includes(node.slug)) missing.push(node.slug);
      return [`${pad}{/* ${node.slug ?? "component"}: not available */}`];
    }
    const { children, ...rest } = node.props;
    const attrs = Object.entries(rest)
      .map(([k, v]) => formatProp(k, v))
      .filter((a): a is string => a !== null);
    const open = [meta.exportName, ...attrs].join(" ");
    if (typeof children === "string" && children !== "") {
      return [`${pad}<${open}>${escapeText(children)}</${meta.exportName}>`];
    }
    return [`${pad}<${open} />`];
  }
  const tag = node.type === "page" ? "main" : node.type === "section" ? "section" : "div";
  const lines = [`${pad}<${tag} className="${layoutClass(node)}">`];
  if (node.type === "section" && typeof node.props.title === "string" && node.props.title) {
    lines.push(
      `${pad}  <h2 className="text-sm font-medium text-crm-muted-fg">${escapeText(node.props.title)}</h2>`,
    );
  }
  if (!node.children.length && node.type === "page")
    lines.push(`${pad}  {/* Drop components here */}`);
  for (const child of node.children) lines.push(...emit(child, metas, indent + 1, missing, guard));
  lines.push(`${pad}</${tag}>`);
  return lines;
}

/**
 * Page.tsx source for a tree. Components without metadata become placeholder comments.
 * `guard` wraps each component in the preview error boundary (live preview only, never export).
 */
export function generatePage(
  tree: PageNode,
  metas: Record<string, ComponentMeta | undefined>,
  componentName = "Page",
  { guard = false }: { guard?: boolean } = {},
): GeneratedPage {
  const slugs = usedSlugs(tree);
  const missing: string[] = [];
  const body = emit(tree, metas, 2, missing, guard);

  const byPath = new Map<string, Set<string>>();
  const deps = new Set<string>();
  const install: string[] = [];
  for (const slug of slugs) {
    const m = metas[slug];
    if (!m) continue;
    let names = byPath.get(m.importPath);
    if (!names) byPath.set(m.importPath, (names = new Set()));
    names.add(m.exportName);
    for (const d of m.dependencies) if (d !== "react") deps.add(d);
    install.push(m.installCommand);
  }
  const imports = [...byPath.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, names]) => `import { ${[...names].sort().join(", ")} } from "${path}";`);

  const code = [
    "// Generated by the Kitbase page builder. Components are installed with the kitbase CLI.",
    ...imports,
    imports.length ? "" : null,
    guard ? PREVIEW_GUARD_PRELUDE : null,
    guard ? "" : null,
    `export default function ${componentName}() {`,
    "  return (",
    ...body,
    "  );",
    "}",
    "",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return { code, slugs, missing, install, dependencies: [...deps].sort() };
}

/** Shell script that installs every component plus their npm dependencies. */
export function installScript(page: GeneratedPage): string {
  const lines = [
    "# Run from your project root (React + TypeScript + Tailwind v4)",
    ...page.install,
  ];
  if (page.dependencies.length) lines.push(`npm install ${page.dependencies.join(" ")}`);
  return lines.join("\n");
}
