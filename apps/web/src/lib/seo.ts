/**
 * Client-side head manager. The server already renders the correct tags for a cold load;
 * this keeps them correct when the SPA navigates without a document request.
 */
import type { ListItem } from "../context/session";

export const DEFAULT_TITLE =
  "Kitbase – CRM React Components You Can Copy, Install or Give to AI Agents";
export const DEFAULT_DESCRIPTION =
  "Open-source CRM-themed React components: pipelines, contact tables, activity feeds and more. Copy the code, install via CLI, or hand them to your AI agent.";

const categorySlug = (category: string) =>
  category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

export interface RouteMeta {
  title: string;
  description: string;
  robots: string;
  type: "website" | "article";
  canonicalPath: string;
  jsonLd: unknown[];
}

const webPage = (origin: string, path: string, name: string, description: string) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name,
  url: `${origin}${path}`,
  description,
});

const breadcrumbLd = (origin: string, items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((i, n) => ({
    "@type": "ListItem",
    position: n + 1,
    name: i.name,
    item: `${origin}${i.path}`,
  })),
});

/** Canonical origin from the server-rendered link, so dev and custom domains still work. */
export function canonicalOrigin(): string {
  if (typeof document === "undefined") return "";
  const href = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  try {
    return new URL(href || window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export function routeMeta(pathname: string, components: ListItem[]): RouteMeta {
  const origin = canonicalOrigin();
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const home: RouteMeta = {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    robots: "index, follow, max-image-preview:large",
    type: "website",
    canonicalPath: "/",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Kitbase",
        url: `${origin}/`,
        description: DEFAULT_DESCRIPTION,
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Kitbase",
        url: `${origin}/`,
        logo: `${origin}/icon-512.png`,
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Kitbase",
        url: `${origin}/`,
        description: DEFAULT_DESCRIPTION,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
      },
    ],
  };
  if (path === "/") return home;

  if (path === "/components") {
    const title = "CRM React Components – Pipelines, Tables & Feeds | Kitbase";
    const description =
      "Browse every CRM-themed React component in Kitbase: pipelines, contact tables, activity feeds, forms and app shells. Copy the code or install with the CLI.";
    return {
      title,
      description,
      robots: "index, follow, max-image-preview:large",
      type: "website",
      canonicalPath: path,
      jsonLd: [
        webPage(origin, path, "CRM React components", description),
        breadcrumbLd(origin, [
          { name: "Home", path: "/" },
          { name: "Components", path: "/components" },
        ]),
      ],
    };
  }

  const category = /^\/components\/category\/([^/]+)$/.exec(path)?.[1];
  if (category) {
    const display =
      components.find((c) => categorySlug(c.category) === category)?.category ?? category;
    const list = components.filter((c) => categorySlug(c.category) === category);
    const title = `${display} React Components – Copy or Install | Kitbase`;
    const description = `Browse ${list.length} ${display.toLowerCase()} React components from Kitbase. Live previews, TypeScript source, props and one-command CLI installation.`;
    return {
      title,
      description,
      robots: "index, follow, max-image-preview:large",
      type: "website",
      canonicalPath: path,
      jsonLd: [
        webPage(origin, path, `${display} React components`, description),
        breadcrumbLd(origin, [
          { name: "Home", path: "/" },
          { name: "Components", path: "/components" },
          { name: display, path },
        ]),
      ],
    };
  }

  const slug = /^\/components\/([^/]+)$/.exec(path)?.[1];
  if (slug) {
    const item = components.find((c) => c.slug === slug);
    if (!item) {
      return {
        title: "Component not found | Kitbase",
        description: "The component you are looking for does not exist or has moved.",
        robots: "noindex, nofollow",
        type: "article",
        canonicalPath: path,
        jsonLd: [],
      };
    }
    const title = `${item.name} – React ${item.category} Component | Kitbase`;
    const description = truncate(item.description, 160);
    return {
      title,
      description,
      robots: "index, follow, max-image-preview:large",
      type: "article",
      canonicalPath: path,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "SoftwareSourceCode",
          name: item.name,
          description: item.description,
          url: `${origin}${path}`,
          codeSampleType: "full",
          programmingLanguage: ["TypeScript", "React"],
          runtimePlatform: "React",
          keywords: [item.category, "React", "CRM", "Tailwind CSS", "component"],
        },
        breadcrumbLd(origin, [
          { name: "Home", path: "/" },
          { name: "Components", path: "/components" },
          { name: item.category, path: `/components/category/${categorySlug(item.category)}` },
          { name: item.name, path },
        ]),
      ],
    };
  }

  if (path === "/docs/get-started") {
    return {
      title: "Get Started – Install React Components with the CLI | Kitbase",
      description:
        "Set up Kitbase in a React + TypeScript project: Tailwind CSS v4, the @/ alias, CLI installation and agent prompts. Copy or install CRM React components.",
      robots: "index, follow, max-image-preview:large",
      type: "article",
      canonicalPath: path,
      jsonLd: [
        webPage(origin, path, "Get started with Kitbase", "Install CRM React components."),
        breadcrumbLd(origin, [
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs/get-started" },
        ]),
      ],
    };
  }

  if (path === "/screens") {
    return {
      title: "Prompt to Screen – Generate CRM Pages from React Components | Kitbase",
      description:
        "Describe a CRM screen and get a ready page built only from Kitbase React components, with a live preview, page tree and Page.tsx export.",
      robots: "index, follow, max-image-preview:large",
      type: "website",
      canonicalPath: path,
      jsonLd: [
        webPage(origin, path, "Prompt to screen", "Generate CRM pages from a prompt."),
        breadcrumbLd(origin, [
          { name: "Home", path: "/" },
          { name: "Prompt to screen", path },
        ]),
      ],
    };
  }

  if (path === "/theme" || path === "/builder") {
    const theme = path === "/theme";
    const title = theme
      ? "Theme Studio – Customize CRM Design Tokens | Kitbase"
      : "Page Builder – Compose React Pages Visually | Kitbase";
    const description = theme
      ? "Pick a preset or your own colours, edit light and dark palettes, check contrast and export CSS, Tailwind config, design tokens or a share link."
      : "Compose pages from Kitbase components in a visual builder, preview them with your theme and export ready React code.";
    return {
      title,
      description,
      robots: "index, follow, max-image-preview:large",
      type: "website",
      canonicalPath: path,
      jsonLd: [
        webPage(origin, path, theme ? "Theme studio" : "Page builder", description),
        breadcrumbLd(origin, [
          { name: "Home", path: "/" },
          { name: theme ? "Theme studio" : "Page builder", path },
        ]),
      ],
    };
  }

  if (path === "/requests") {
    return {
      title: "Request a React Component – Public Roadmap | Kitbase",
      description:
        "Request a CRM React component or vote on the public roadmap. See what is requested, building, in review and live. Existing components are linked first.",
      robots: "index, follow, max-image-preview:large",
      type: "website",
      canonicalPath: path,
      jsonLd: [
        webPage(origin, path, "Request a component", "Request a CRM React component."),
        breadcrumbLd(origin, [
          { name: "Home", path: "/" },
          { name: "Component requests", path },
        ]),
      ],
    };
  }

  if (path === "/changelog") {
    return {
      title: "Changelog – New CRM React Components | Kitbase",
      description:
        "See the latest CRM React components published by Kitbase, with live previews, props, source files and install commands.",
      robots: "index, follow, max-image-preview:large",
      type: "website",
      canonicalPath: path,
      jsonLd: [
        webPage(origin, path, "Kitbase changelog", "New CRM React components."),
        breadcrumbLd(origin, [
          { name: "Home", path: "/" },
          { name: "Changelog", path },
        ]),
      ],
    };
  }

  const privateTitles: Record<string, string> = {
    "/sign-in": "Sign in",
    "/sign-up": "Create account",
    "/account": "Account",
    "/join": "Join a team",
  };
  if (privateTitles[path] || path.startsWith("/teams/")) {
    const title = privateTitles[path] ?? "Team workspace";
    return {
      title: `${title} | Kitbase`,
      description: DEFAULT_DESCRIPTION,
      robots: "noindex, nofollow",
      type: "website",
      canonicalPath: path,
      jsonLd: [],
    };
  }

  return {
    title: "Page not found | Kitbase",
    description: "The page you are looking for does not exist or has moved.",
    robots: "noindex, nofollow",
    type: "website",
    canonicalPath: path,
    jsonLd: [],
  };
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Applies a RouteMeta to the live document (title, canonical, robots, OG/Twitter, JSON-LD). */
export function applyRouteMeta(meta: RouteMeta) {
  if (typeof document === "undefined") return;
  const origin = canonicalOrigin();
  const canonical = `${origin}${meta.canonicalPath}`;
  document.title = meta.title;
  upsertMeta("name", "description", meta.description);
  upsertMeta("name", "robots", meta.robots);
  upsertLink("canonical", canonical);

  upsertMeta("property", "og:type", meta.type);
  upsertMeta("property", "og:site_name", "Kitbase");
  upsertMeta("property", "og:title", meta.title);
  upsertMeta("property", "og:description", meta.description);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:image", `${origin}/og-image.png`);
  upsertMeta("property", "og:image:width", "1200");
  upsertMeta("property", "og:image:height", "630");
  upsertMeta("property", "og:image:alt", meta.title);

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", meta.title);
  upsertMeta("name", "twitter:description", meta.description);
  upsertMeta("name", "twitter:image", `${origin}/og-image.png`);
  upsertMeta("name", "twitter:image:alt", meta.title);

  const existing = document.getElementById("seo-jsonld");
  if (meta.jsonLd.length) {
    const script = existing ?? document.createElement("script");
    script.id = "seo-jsonld";
    script.setAttribute("type", "application/ld+json");
    script.textContent = JSON.stringify(
      meta.jsonLd.length === 1 ? meta.jsonLd[0] : meta.jsonLd,
    ).replace(/</g, "\\u003c");
    if (!existing) document.head.appendChild(script);
  } else {
    existing?.remove();
  }
}
