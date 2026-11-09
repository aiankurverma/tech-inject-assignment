/**
 * Server-rendered public HTML.
 *
 * The catalogue is a Vite SPA, so a plain request used to return an empty #root. This module
 * turns the published Mongo snapshots into real HTML for every public route (headings, copy,
 * component links, props, install commands, breadcrumbs and JSON-LD). The SPA still boots on top
 * and replaces the static body, so behaviour is unchanged for people with JavaScript.
 */
import type { Cache } from "@ti/cache";
import type { Bundle } from "@ti/core";
import type { ComponentRecord } from "../models";
import { findPublishedDocs } from "../services/catalog";

export const SITE_NAME = "Kitbase";
export const DEFAULT_TITLE =
  "Kitbase – CRM React Components You Can Copy, Install or Give to AI Agents";
export const DEFAULT_DESCRIPTION =
  "Open-source CRM-themed React components: pipelines, contact tables, activity feeds and more. Copy the code, install via CLI, or hand them to your AI agent.";

export interface SeoContext {
  origin: string;
  cache: Cache;
  /** Public Cloudflare Web Analytics token; injected as a meta tag for the client beacon. */
  analyticsToken?: string;
}

export interface SeoPage {
  status: number;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  type: "website" | "article";
  image: string;
  jsonLd: unknown[];
  body: string;
}

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const abs = (origin: string, path: string) => `${origin}${path === "/" ? "/" : path}`;
const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

interface Doc {
  slug: string;
  published: Bundle;
  publishedAt?: Date | null;
}

/** Cache stores JSON, so a date can come back as an ISO string. Normalise at the boundary. */
const asDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const toDocs = (records: ComponentRecord[]): Doc[] =>
  records
    .filter((d): d is ComponentRecord & { published: Bundle } => !!d.published)
    .map((d) => ({ slug: d.slug, published: d.published, publishedAt: asDate(d.publishedAt) }))
    .sort((a, b) => a.published.name.localeCompare(b.published.name));

const byCategory = (docs: Doc[]) => {
  const map = new Map<string, Doc[]>();
  for (const d of docs) {
    const list = map.get(d.published.category) ?? [];
    list.push(d);
    map.set(d.published.category, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
};

const CRITICAL_CSS = `<style id="seo-critical">
:root{color-scheme:light dark;--fg:#171717;--muted:#5f5f5f;--bg:#fafafa;--card:#fff;--line:#e5e5e5;--accent:#2563eb}
@media (prefers-color-scheme:dark){:root{--fg:#f5f5f5;--muted:#a3a3a3;--bg:#0a0a0a;--card:#141414;--line:#262626;--accent:#60a5fa}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.seo-shell a{color:var(--accent);text-decoration:none}.seo-shell a:hover{text-decoration:underline}
.seo-wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.seo-header{border-bottom:1px solid var(--line);background:var(--card)}
.seo-header .seo-wrap{display:flex;flex-wrap:wrap;align-items:center;gap:16px;min-height:60px}
.seo-brand{font-weight:700;font-size:17px;color:var(--fg)!important}.seo-nav{display:flex;flex-wrap:wrap;gap:14px;font-size:14px}
.seo-main{padding:36px 0 64px}.seo-main h1{font-size:clamp(28px,5vw,44px);line-height:1.1;letter-spacing:-.02em;margin:0 0 14px}
.seo-main h2{font-size:22px;margin:38px 0 12px}.seo-main h3{font-size:16px;margin:0 0 6px}
.seo-lead{font-size:18px;color:var(--muted);max-width:780px;margin:0 0 22px}
.seo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.seo-card{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:16px}
.seo-card p{margin:6px 0 0;color:var(--muted);font-size:14px}
.seo-meta{color:var(--muted);font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.04em}
.seo-breadcrumb{font-size:13px;color:var(--muted);margin:0 0 18px}.seo-breadcrumb a{color:inherit}
.seo-pre{overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px;font-size:13px;line-height:1.5}
.seo-table{width:100%;border-collapse:collapse;font-size:14px}.seo-table th,.seo-table td{border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;vertical-align:top}
.seo-footer{border-top:1px solid var(--line);padding:22px 0;color:var(--muted);font-size:13px}
.seo-tag{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:1px 8px;font-size:12px;margin-right:6px}
.seo-cols{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px 22px}.seo-cols ul{margin:6px 0 0;padding-left:18px}
</style>`;

const nav = `<header class="seo-header"><div class="seo-wrap">
<a class="seo-brand" href="/">Kitbase</a>
<nav class="seo-nav" aria-label="Main">
<a href="/components">Components</a><a href="/docs/get-started">Docs</a><a href="/screens">Prompt to screen</a><a href="/builder">Builder</a><a href="/theme">Theme studio</a><a href="/requests">Requests</a><a href="/changelog">Changelog</a><a href="/sign-in">Sign in</a>
</nav></div></header>`;

const footer = `<footer class="seo-footer"><div class="seo-wrap">
<p>Kitbase — copy-and-own CRM React components. <a href="/components">Components</a> · <a href="/requests">Requests</a> · <a href="/changelog">Changelog</a> · <a href="/llms.txt">llms.txt</a> · <a href="/registry.json">registry.json</a> · <a href="/sitemap.xml">sitemap</a></p>
</div></footer>`;

const shell = (body: string) =>
  `${CRITICAL_CSS}<div class="seo-shell">${nav}<main class="seo-main"><div class="seo-wrap">${body}</div></main>${footer}</div>`;

const breadcrumbFrom = (origin: string, items: { name: string; path: string }[]) => {
  const links = items
    .map((i, n) =>
      n === items.length - 1
        ? `<span aria-current="page">${esc(i.name)}</span>`
        : `<a href="${i.path}">${esc(i.name)}</a>`,
    )
    .join(" › ");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((i, n) => ({
      "@type": "ListItem",
      position: n + 1,
      name: i.name,
      item: abs(origin, i.path),
    })),
  };
  return { html: `<nav class="seo-breadcrumb" aria-label="Breadcrumb">${links}</nav>`, jsonLd };
};

const breadcrumb = (origin: string, slug?: string, name?: string) => {
  const items: { name: string; path: string }[] = [{ name: "Home", path: "/" }];
  if (slug) {
    items.push({ name: "Components", path: "/components" });
    items.push({ name: name ?? slug, path: `/components/${slug}` });
  }
  return breadcrumbFrom(origin, items);
};

const categorySlug = (category: string) =>
  category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const card = (d: Doc) =>
  `<article class="seo-card"><p class="seo-meta">${esc(d.published.category)}</p><h3><a href="/components/${esc(d.slug)}">${esc(d.published.name)}</a></h3><p>${esc(truncate(d.published.description, 150))}</p></article>`;

const collectionJsonLd = (origin: string, docs: Doc[], path: string, name: string) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name,
  url: abs(origin, path),
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: docs.length,
    itemListElement: docs.slice(0, 100).map((d, n) => ({
      "@type": "ListItem",
      position: n + 1,
      url: abs(origin, `/components/${d.slug}`),
      name: d.published.name,
    })),
  },
});

const installFor = (origin: string, slug: string) =>
  `npx --yes ${origin}/cli/kitbase.tgz add ${slug}`;

function homePage(origin: string, docs: Doc[]): SeoPage {
  const categories = byCategory(docs);
  const featured = categories.slice(0, 8);
  const body = `
<h1>CRM React components you can copy, install, or hand to an AI agent</h1>
<p class="seo-lead">${esc(DEFAULT_DESCRIPTION)}</p>
<p><a href="/components">Browse all ${docs.length} components</a> · <a href="/docs/get-started">Read the setup guide</a> · <a href="/screens">Generate a screen from a prompt</a></p>
${featured
  .map(
    ([category, list]) => `<h2>${esc(category)}</h2>
<div class="seo-grid">${list.slice(0, 4).map(card).join("")}</div>
<p><a href="/components/category/${esc(categorySlug(category))}">All ${esc(category)} components (${list.length})</a></p>`,
  )
  .join("")}
<h2>Why Kitbase</h2>
<ul>
<li>Plain React + TypeScript files styled with Tailwind CSS v4 — you own the code.</li>
<li>CRM patterns: pipelines, contact tables, activity feeds, KPI cards, forms and app shells.</li>
<li>Install one component with the CLI, copy it, or hand the install prompt to an AI agent.</li>
</ul>`;
  return {
    status: 200,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonical: abs(origin, "/"),
    robots: "index, follow, max-image-preview:large",
    type: "website",
    image: abs(origin, "/og-image.png"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: abs(origin, "/"),
        description: DEFAULT_DESCRIPTION,
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url: abs(origin, "/"),
        logo: abs(origin, "/icon-512.png"),
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        url: abs(origin, "/"),
        description: DEFAULT_DESCRIPTION,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
    body: shell(body),
  };
}

function componentsPage(origin: string, docs: Doc[]): SeoPage {
  const categories = byCategory(docs);
  const body = `
${breadcrumb(origin).html}
<h1>CRM React components</h1>
<p class="seo-lead">Every published Kitbase component, grouped by category. Open a component for its live preview, props, code, dependencies and install command.</p>
<p class="seo-meta">${docs.length} components · ${categories.length} categories</p>
<p>${categories
    .map(
      ([category, list]) =>
        `<a href="/components/category/${esc(categorySlug(category))}">${esc(category)} (${list.length})</a>`,
    )
    .join(" · ")}</p>
${categories
  .map(
    ([
      category,
      list,
    ]) => `<h2 id="${esc(category.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">${esc(category)}</h2>
<div class="seo-grid">${list.map(card).join("")}</div>`,
  )
  .join("")}`;
  return {
    status: 200,
    title: "CRM React Components – Pipelines, Tables & Feeds | Kitbase",
    description:
      "Browse every CRM-themed React component in Kitbase: pipelines, contact tables, activity feeds, forms and app shells. Copy the code or install with the CLI.",
    canonical: abs(origin, "/components"),
    robots: "index, follow, max-image-preview:large",
    type: "website",
    image: abs(origin, "/og-image.png"),
    jsonLd: [
      collectionJsonLd(origin, docs, "/components", "CRM React components"),
      breadcrumb(origin).jsonLd,
    ],
    body: shell(body),
  };
}

function categoryPage(origin: string, docs: Doc[], slug: string): SeoPage {
  const categories = byCategory(docs);
  const entry = categories.find(([category]) => categorySlug(category) === slug);
  if (!entry) return notFoundPage(origin, `/components/category/${slug}`);
  const [category, list] = entry;
  const path = `/components/category/${slug}`;
  const bc = breadcrumbFrom(origin, [
    { name: "Home", path: "/" },
    { name: "Components", path: "/components" },
    { name: category, path },
  ]);
  const body = `
${bc.html}
<h1>${esc(category)} React components</h1>
<p class="seo-lead">${list.length} ${esc(category.toLowerCase())} components for CRM and internal tools. Each page has a live preview, props, source files and an install command.</p>
<div class="seo-grid">${list.map(card).join("")}</div>
<h2>Other categories</h2>
<div class="seo-cols"><ul>${categories
    .filter(([c]) => c !== category)
    .map(
      ([c]) =>
        `<li><a href="/components/category/${esc(categorySlug(c))}">${esc(c)} (${docs.filter((d) => d.published.category === c).length})</a></li>`,
    )
    .join("")}</ul></div>
<p><a href="/components">Browse all components</a> · <a href="/docs/get-started">Installation guide</a> · <a href="/llms.txt">llms.txt for AI agents</a></p>`;
  return {
    status: 200,
    title: `${category} React Components – Copy or Install | Kitbase`,
    description: `Browse ${list.length} ${category.toLowerCase()} React components from Kitbase. Live previews, TypeScript source, props and one-command CLI installation.`,
    canonical: abs(origin, path),
    robots: "index, follow, max-image-preview:large",
    type: "website",
    image: abs(origin, "/og-image.png"),
    jsonLd: [collectionJsonLd(origin, list, path, `${category} React components`), bc.jsonLd],
    body: shell(body),
  };
}

function componentPage(origin: string, docs: Doc[], doc: Doc): SeoPage {
  const b = doc.published;
  // Stored bundles can predate optional fields; never assume the arrays exist.
  const propDocs = b.props ?? [];
  const dependencies = b.dependencies ?? [];
  const examples = b.examples ?? [];
  const files = b.files ?? [];
  const related = docs
    .filter((d) => d.slug !== doc.slug && d.published.category === b.category)
    .slice(0, 6);
  const props = propDocs.length
    ? `<table class="seo-table"><thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead><tbody>${propDocs
        .map(
          (p) =>
            `<tr><td><code>${esc(p.name)}</code>${p.required ? " *" : ""}</td><td>${esc(p.type)}</td><td>${p.default ? `<code>${esc(p.default)}</code>` : "—"}</td><td>${esc(p.description || "—")}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "<p>This component has no documented props.</p>";
  const bc = breadcrumb(origin, doc.slug, b.name);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: b.name,
      description: b.description,
      url: abs(origin, `/components/${doc.slug}`),
      codeSampleType: "full",
      programmingLanguage: ["TypeScript", "React"],
      runtimePlatform: "React",
      applicationCategory: "DeveloperApplication",
      keywords: [b.category, "React", "CRM", "Tailwind CSS", "component"],
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: abs(origin, "/") },
      author: { "@type": "Organization", name: SITE_NAME, url: abs(origin, "/") },
      ...(doc.publishedAt ? { datePublished: doc.publishedAt.toISOString() } : {}),
    },
    bc.jsonLd,
  ];
  const body = `
${bc.html}
<h1>${esc(b.name)}</h1>
<p class="seo-lead">${esc(b.description)}</p>
<p><span class="seo-tag">${esc(b.category)}</span><span class="seo-tag">v${esc(b.version)}</span><span class="seo-tag">${b.access === "premium" ? "Premium" : "Free"}</span></p>
<p>The live preview, copy buttons and agent prompt load on this page. You can also install it from a terminal:</p>
<pre class="seo-pre"><code>${esc(installFor(origin, doc.slug))}</code></pre>
<h2>Dependencies</h2>
<p>${dependencies.length ? dependencies.map((d) => `<code>${esc(d)}</code>`).join(", ") : "No extra dependencies beyond React and Tailwind CSS."}</p>
<h2>Props</h2>
${props}
${b.usage ? `<h2>Usage</h2><pre class="seo-pre"><code>${esc(b.usage)}</code></pre>` : ""}
${
  examples[0]?.code
    ? `<h2>Example</h2><pre class="seo-pre"><code>${esc(truncate(examples[0].code, 6000))}</code></pre>`
    : ""
}
<h2>Files</h2>
<ul>${files.map((f) => `<li><code>src/${esc(f.path)}</code></li>`).join("")}</ul>
${
  related.length
    ? `<h2>Related components</h2><div class="seo-grid">${related.map(card).join("")}</div>`
    : ""
}
<p><a href="/components">Browse all components</a> · <a href="/docs/get-started">Installation guide</a> · <a href="/llms.txt">llms.txt for AI agents</a></p>`;
  return {
    status: 200,
    title: `${b.name} – React ${b.category} Component | Kitbase`,
    description: truncate(b.description, 160),
    canonical: abs(origin, `/components/${doc.slug}`),
    robots: "index, follow, max-image-preview:large",
    type: "article",
    image: abs(origin, "/og-image.png"),
    jsonLd,
    body: shell(body),
  };
}

function docsPage(origin: string): SeoPage {
  const body = `
${breadcrumb(origin).html}
<h1>Get started with Kitbase</h1>
<p class="seo-lead">Components are plain React + TypeScript files styled with Tailwind CSS v4 and the CRM theme. They are copied into your project, so you own and can change the code.</p>
<h2>Requirements</h2>
<ul><li>Node.js 18.17 or newer</li><li>React 18 or 19 with TypeScript</li><li>Tailwind CSS v4</li><li>An <code>@/</code> import alias that points to your <code>src</code> folder</li></ul>
<h2>Project setup (Vite)</h2>
<pre class="seo-pre"><code>npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm install tailwindcss @tailwindcss/vite
npm install -D @types/node</code></pre>
<p>Add Tailwind and the alias to <code>vite.config.ts</code>, then add the matching <code>paths</code> entry to <code>tsconfig.app.json</code>. The first installed component writes the CRM theme CSS; start your main CSS with <code>@import "tailwindcss";</code>.</p>
<h2>Add a component</h2>
<pre class="seo-pre"><code>${esc(installFor(origin, "button"))}</code></pre>
<p>The installer writes only inside <code>src/</code> and never overwrites a changed file. Options: <code>--src app</code>, <code>--dry-run</code>, <code>--overwrite</code>.</p>
<h2>Using an AI agent</h2>
<p>Open any component page and copy its agent prompt into Claude Code, Cursor or another coding agent. The prompt explains the install, the theme and how to verify the result. Agents can also read <a href="/llms.txt">llms.txt</a> and <a href="/registry.json">registry.json</a>.</p>
<p><a href="/components">Browse components</a> · <a href="/screens">Prompt to screen</a></p>`;
  return {
    status: 200,
    title: "Get Started – Install React Components with the CLI | Kitbase",
    description:
      "Set up Kitbase in a React + TypeScript project: Tailwind CSS v4, the @/ alias, CLI installation and agent prompts. Copy or install CRM React components.",
    canonical: abs(origin, "/docs/get-started"),
    robots: "index, follow, max-image-preview:large",
    type: "article",
    image: abs(origin, "/og-image.png"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: "Get started with Kitbase",
        url: abs(origin, "/docs/get-started"),
        description:
          "Install CRM-themed React components with the Kitbase CLI, Tailwind CSS v4 and TypeScript.",
        author: { "@type": "Organization", name: SITE_NAME },
      },
      breadcrumb(origin).jsonLd,
    ],
    body: shell(body),
  };
}

function screensPage(origin: string): SeoPage {
  const body = `
${breadcrumb(origin).html}
<h1>Prompt to screen</h1>
<p class="seo-lead">Describe a CRM screen and Kitbase composes it only from catalogue components, with a live preview, the page tree, a ready <code>Page.tsx</code> and the install commands.</p>
<p>Generation runs as a background job: progress survives a reload or sign-out, and you can pause, resume or cancel it live.</p>
<h2>Example prompts</h2>
<ul><li>Sales pipeline overview with KPI cards, a deals table and an activity timeline</li><li>Support inbox: ticket list on the left, ticket detail with comments on the right</li><li>Settings page for team members with an invite form and a roles table</li></ul>
<p><a href="/screens">Open prompt to screen</a> · <a href="/components">Browse components</a> · <a href="/docs/get-started">Setup guide</a></p>`;
  return {
    status: 200,
    title: "Prompt to Screen – Generate CRM Pages from React Components | Kitbase",
    description:
      "Describe a CRM screen and get a ready page built only from Kitbase React components, with a live preview, page tree and Page.tsx export.",
    canonical: abs(origin, "/screens"),
    robots: "index, follow, max-image-preview:large",
    type: "website",
    image: abs(origin, "/og-image.png"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Prompt to screen",
        url: abs(origin, "/screens"),
        description: "Generate CRM pages from a prompt using Kitbase React components.",
      },
      breadcrumb(origin).jsonLd,
    ],
    body: shell(body),
  };
}

function requestsPage(origin: string): SeoPage {
  const body = `
${
  breadcrumbFrom(origin, [
    { name: "Home", path: "/" },
    { name: "Component requests", path: "/requests" },
  ]).html
}
<h1>Request a component</h1>
<p class="seo-lead">Tell us what you are building and vote on what ships next. Requests move through Requested, Building, In review and Live. A component is only published after it passes quality checks and a human review.</p>
<h2>How it works</h2>
<ol>
<li>Search first: if the component already exists, open it instead of creating a duplicate.</li>
<li>Submit a request or upvote an existing one. Sign in to vote, or submit within the rate limit as a guest.</li>
<li>When a component ships, opted-in requesters can be notified. Public credit is opt-in only.</li>
</ol>
<h2>Statuses</h2>
<ul>
<li><strong>Requested</strong> — collected, waiting for enough demand.</li>
<li><strong>Building</strong> — a draft is being written.</li>
<li><strong>In review</strong> — quality checks and human approval.</li>
<li><strong>Live</strong> — published with a live preview, props, source and install command.</li>
</ul>
<p><a href="/requests">Open the request board</a> · <a href="/components">Browse existing components</a> · <a href="/changelog">See what shipped recently</a></p>`;
  return {
    status: 200,
    title: "Request a React Component – Public Roadmap | Kitbase",
    description:
      "Request a CRM React component or vote on the public roadmap. See what is requested, building, in review and live. No duplicate pages: existing components are linked first.",
    canonical: abs(origin, "/requests"),
    robots: "index, follow, max-image-preview:large",
    type: "website",
    image: abs(origin, "/og-image.png"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Request a component",
        url: abs(origin, "/requests"),
        description: "Request a CRM React component or vote on the public roadmap for Kitbase.",
      },
      breadcrumbFrom(origin, [
        { name: "Home", path: "/" },
        { name: "Component requests", path: "/requests" },
      ]).jsonLd,
    ],
    body: shell(body),
  };
}

function changelogPage(origin: string, docs: Doc[]): SeoPage {
  const dated = docs
    .filter((d) => d.publishedAt)
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  const groups = new Map<string, Doc[]>();
  for (const d of dated) {
    const key = d.publishedAt!.toISOString().slice(0, 10);
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }
  const body = `
${
  breadcrumbFrom(origin, [
    { name: "Home", path: "/" },
    { name: "Changelog", path: "/changelog" },
  ]).html
}
<h1>Changelog</h1>
<p class="seo-lead">New and updated CRM React components. Every entry links to a page with a live preview, props, source and an install command.</p>
${
  [...groups.entries()]
    .map(
      ([date, list]) =>
        `<h2>${esc(date)} <span class="seo-meta">${list.length} component${list.length === 1 ? "" : "s"}</span></h2><div class="seo-grid">${list.map(card).join("")}</div>`,
    )
    .join("") || "<p>No components published yet.</p>"
}
<p><a href="/components">Browse all components</a> · <a href="/requests">Request a component</a> · <a href="/llms.txt">llms.txt</a></p>`;
  return {
    status: 200,
    title: "Changelog – New CRM React Components | Kitbase",
    description:
      "See the latest CRM React components published by Kitbase, with live previews, props, source files and install commands. Updated when a component ships.",
    canonical: abs(origin, "/changelog"),
    robots: "index, follow, max-image-preview:large",
    type: "website",
    image: abs(origin, "/og-image.png"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Kitbase changelog",
        url: abs(origin, "/changelog"),
      },
      breadcrumbFrom(origin, [
        { name: "Home", path: "/" },
        { name: "Changelog", path: "/changelog" },
      ]).jsonLd,
    ],
    body: shell(body),
  };
}

function toolPage(origin: string, path: "/theme" | "/builder"): SeoPage {
  const theme = path === "/theme";
  const title = theme
    ? "Theme Studio – Customize CRM Design Tokens | Kitbase"
    : "Page Builder – Compose React Pages Visually | Kitbase";
  const description = theme
    ? "Pick a preset or your own colours, edit light and dark palettes, check contrast and export CSS, Tailwind config, design tokens or a share link."
    : "Compose pages from Kitbase components in a visual builder, preview them with your theme and export ready React code.";
  const body = `
${breadcrumb(origin).html}
<h1>${theme ? "Theme studio" : "Page builder"}</h1>
<p class="seo-lead">${esc(description)}</p>
<p><a href="${path}">Open ${theme ? "theme studio" : "page builder"}</a> · <a href="/components">Browse components</a> · <a href="/docs/get-started">Setup guide</a></p>`;
  return {
    status: 200,
    title,
    description,
    canonical: abs(origin, path),
    robots: "index, follow, max-image-preview:large",
    type: "website",
    image: abs(origin, "/og-image.png"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: title,
        url: abs(origin, path),
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
      },
    ],
    body: shell(body),
  };
}

function privatePage(origin: string, path: string, title: string): SeoPage {
  return {
    status: 200,
    title: `${title} | Kitbase`,
    description: DEFAULT_DESCRIPTION,
    canonical: abs(origin, path),
    robots: "noindex, nofollow",
    type: "website",
    image: abs(origin, "/og-image.png"),
    jsonLd: [],
    body: "",
  };
}

function notFoundPage(origin: string, path: string): SeoPage {
  return {
    status: 404,
    title: "Page not found | Kitbase",
    description: "The page you are looking for does not exist or has moved.",
    canonical: abs(origin, path),
    robots: "noindex, nofollow",
    type: "website",
    image: abs(origin, "/og-image.png"),
    jsonLd: [],
    body: shell(
      `<h1>Page not found</h1><p class="seo-lead">The page you are looking for does not exist or has moved.</p><p><a href="/">Home</a> · <a href="/components">Browse components</a></p>`,
    ),
  };
}

/** True for real client-side routes that may receive the SPA shell (after the SEO body). */
export function isAppRoute(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (
    p === "/" ||
    p === "/components" ||
    /^\/components\/[^/]+$/.test(p) ||
    /^\/components\/category\/[^/]+$/.test(p) ||
    p === "/docs/get-started" ||
    p === "/screens" ||
    p === "/theme" ||
    p === "/builder" ||
    p === "/requests" ||
    p === "/changelog" ||
    p === "/join" ||
    p === "/sign-in" ||
    p === "/sign-up" ||
    p === "/account" ||
    /^\/teams\/[^/]+$/.test(p) ||
    /^\/teams\/[^/]+\/components\/[^/]+$/.test(p)
  );
}

/** Builds the complete page (head values + static body) for a public or private app route. */
export async function renderSeoPage(pathname: string, ctx: SeoContext): Promise<SeoPage | null> {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const { origin, cache } = ctx;

  if (path === "/") return homePage(origin, toDocs(await findPublishedDocs(cache)));
  if (path === "/components") return componentsPage(origin, toDocs(await findPublishedDocs(cache)));
  const category = /^\/components\/category\/([^/]+)$/.exec(path)?.[1];
  if (category)
    return categoryPage(
      origin,
      toDocs(await findPublishedDocs(cache)),
      decodeURIComponent(category),
    );
  const slug = /^\/components\/([^/]+)$/.exec(path)?.[1];
  if (slug) {
    const docs = toDocs(await findPublishedDocs(cache));
    const doc = docs.find((d) => d.slug === decodeURIComponent(slug));
    return doc ? componentPage(origin, docs, doc) : notFoundPage(origin, path);
  }
  if (path === "/docs/get-started") return docsPage(origin);
  if (path === "/screens") return screensPage(origin);
  if (path === "/requests") return requestsPage(origin);
  if (path === "/changelog") return changelogPage(origin, toDocs(await findPublishedDocs(cache)));
  if (path === "/theme") return toolPage(origin, "/theme");
  if (path === "/builder") return toolPage(origin, "/builder");
  if (path === "/sign-in") return privatePage(origin, path, "Sign in");
  if (path === "/sign-up") return privatePage(origin, path, "Create account");
  if (path === "/account") return privatePage(origin, path, "Account");
  if (path === "/join") return privatePage(origin, path, "Join a team");
  if (/^\/teams\/[^/]+(?:\/components\/[^/]+)?$/.test(path))
    return privatePage(origin, path, "Team workspace");
  if (path.startsWith("/data:")) return notFoundPage(origin, path);
  return notFoundPage(origin, path);
}

const meta = (attr: "name" | "property", key: string, content: string) =>
  `<meta ${attr}="${esc(key)}" content="${esc(content)}" />`;

/** Replaces the marked SEO block and the empty root in the built index.html. */
export function renderDocument(
  indexHtml: string,
  page: SeoPage,
  opts: { analyticsToken?: string } = {},
): string {
  const ld = page.jsonLd.length
    ? `<script id="seo-jsonld" type="application/ld+json">${JSON.stringify(
        page.jsonLd.length === 1 ? page.jsonLd[0] : page.jsonLd,
      ).replace(/</g, "\\u003c")}</script>`
    : "";
  const head = `<!--seo:start-->
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}" />
<meta name="robots" content="${esc(page.robots)}" />
<link rel="canonical" href="${esc(page.canonical)}" />
${meta("property", "og:type", page.type)}
${meta("property", "og:site_name", SITE_NAME)}
${meta("property", "og:title", page.title)}
${meta("property", "og:description", page.description)}
${meta("property", "og:url", page.canonical)}
${meta("property", "og:image", page.image)}
${meta("property", "og:image:width", "1200")}
${meta("property", "og:image:height", "630")}
${meta("property", "og:image:alt", page.title)}
${meta("name", "twitter:card", "summary_large_image")}
${meta("name", "twitter:title", page.title)}
${meta("name", "twitter:description", page.description)}
${meta("name", "twitter:image", page.image)}
${opts.analyticsToken ? meta("name", "cf-analytics-token", opts.analyticsToken) : ""}
${ld}
<!--seo:end-->`;
  return indexHtml
    .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, head)
    .replace('<div id="root"></div>', `<div id="root">${page.body}</div>`);
}
