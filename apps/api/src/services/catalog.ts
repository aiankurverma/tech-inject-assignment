import {
  agentPromptText,
  buildRegistryItem,
  copyCodeText,
  decideAccess,
  installCommand,
  type Bundle,
  type ThemeFiles,
  type Viewer,
} from "@ti/core";
import type { Cache } from "@ti/cache";
import { ComponentModel, type ComponentRecord } from "../models";
import { denyError } from "../utils/http";

/** Published documents are cached briefly; admin writes call `forgetPublished` so changes show at once. */
const CACHE_TTL_S = 60;

/** Drop the cached published documents for `slug` (and the list) after any admin change. */
export async function forgetPublished(cache: Cache, slug: string) {
  await Promise.all([cache.del("list"), cache.del(`slug:${slug}`)]);
}

/**
 * Public (non-admin) read side. Only ever touches the `published` snapshot.
 * Only the DB documents are cached (same for every viewer); access is decided on every request.
 */
export function makeCatalog(theme: ThemeFiles, apiOrigin: string, cache: Cache) {
  async function findPublished(
    slug: string,
  ): Promise<(ComponentRecord & { published: Bundle }) | null> {
    const doc = await cache.wrap(`slug:${slug}`, CACHE_TTL_S, () =>
      ComponentModel.findOne({ slug, status: "published" }).lean<ComponentRecord>(),
    );
    return doc?.published ? (doc as ComponentRecord & { published: Bundle }) : null;
  }

  /** Throws 404/401/403 unless the viewer may use this component right now. */
  async function authorize(slug: string, viewer: Viewer) {
    const doc = await findPublished(slug);
    if (!doc) throw denyError("not_found");
    const decision = decideAccess({ status: doc.status, access: doc.published.access }, viewer);
    if (!decision.allowed) throw denyError(decision.reason);
    return doc.published;
  }

  return {
    async list(viewer: Viewer) {
      // Summary fields only: no source files, examples, props or thumbnails leave Mongo.
      const docs = await cache.wrap("list", CACHE_TTL_S, () =>
        ComponentModel.find({ status: "published" }, LIST_PROJECTION)
          .sort({ "published.category": 1, "published.name": 1 })
          .lean<ComponentRecord[]>(),
      );
      return docs.filter((d) => d.published).map((d) => listItem(d, viewer));
    },

    /** True when `slug` is published (cached lookup; used to reject junk analytics beacons). */
    async isPublished(slug: string) {
      return !!(await findPublished(slug));
    },

    /** Current published version, for immutable cache headers on versioned URLs. */
    async publishedVersion(slug: string) {
      return (await findPublished(slug))?.published.version ?? null;
    },

    /** Detail page data. Locked items return metadata only - no source, examples or props. */
    async detail(slug: string, viewer: Viewer) {
      const doc = await findPublished(slug);
      if (!doc) throw denyError("not_found");
      const b = doc.published;
      const decision = decideAccess({ status: doc.status, access: b.access }, viewer);
      const base = {
        slug: b.slug,
        name: b.name,
        description: b.description,
        category: b.category,
        access: b.access,
        version: b.version,
        publishedAt: doc.publishedAt,
      };
      if (!decision.allowed) return { ...base, locked: decision.reason };
      const item = buildRegistryItem(b, theme);
      return {
        ...base,
        locked: null,
        props: b.props,
        usage: b.usage,
        dependencies: item.dependencies,
        examples: b.examples,
        files: item.files,
        installCommand: installCommand(apiOrigin, b.slug),
      };
    },

    async thumbnail(slug: string) {
      const doc = await findPublished(slug);
      if (!doc) throw denyError("not_found");
      return doc.published.thumbnail ?? placeholderThumbnail(doc.published.name);
    },

    async preview(slug: string, viewer: Viewer) {
      return previewPayload(await authorize(slug, viewer), theme);
    },
    async registryItem(slug: string, viewer: Viewer) {
      return buildRegistryItem(await authorize(slug, viewer), theme);
    },
    async copyCode(slug: string, viewer: Viewer) {
      return copyCodeText(buildRegistryItem(await authorize(slug, viewer), theme));
    },
    async prompt(slug: string, viewer: Viewer) {
      const b = await authorize(slug, viewer);
      return agentPromptText(buildRegistryItem(b, theme), {
        apiOrigin,
        premium: b.access === "premium",
      });
    },
  };
}

/** Mongo projection for the catalogue list: exactly the fields `listItem` reads. */
export const LIST_PROJECTION = {
  _id: 0,
  slug: 1,
  status: 1,
  createdAt: 1,
  publishedAt: 1,
  "published.slug": 1,
  "published.name": 1,
  "published.description": 1,
  "published.category": 1,
  "published.access": 1,
  "published.version": 1,
} as const;

/** Catalogue card for one published document (access decided per viewer, never cached). */
export function listItem(d: Pick<ComponentRecord, "status" | "createdAt" | "publishedAt"> & {
  published?: Pick<Bundle, "slug" | "name" | "description" | "category" | "access" | "version">;
}, viewer: Viewer) {
  const b = d.published!;
  const decision = decideAccess({ status: d.status, access: b.access }, viewer);
  return {
    slug: b.slug,
    name: b.name,
    description: b.description,
    category: b.category,
    access: b.access,
    version: b.version,
    locked: decision.allowed ? null : decision.reason,
    // ISO dates for "newest" sorting; cached docs may hold strings, so normalise.
    createdAt: isoDate(d.createdAt),
    publishedAt: isoDate(d.publishedAt),
  };
}

/** ISO string for a Date or cached date string; null when missing or invalid. */
export function isoDate(v: Date | string | undefined | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** What the sandboxed preview iframe needs to render a bundle. */
export function previewPayload(b: Bundle, theme: ThemeFiles) {
  return {
    slug: b.slug,
    version: b.version,
    themeCss: theme.themeCss,
    files: [{ path: "lib/utils.ts", content: theme.utilsTs }, ...b.files],
    examples: b.examples,
  };
}

export function placeholderThumbnail(name: string) {
  const safe = name.replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#161616"/><rect x="220" y="150" width="200" height="60" rx="30" fill="#1e1e1e" stroke="#2a2a2a"/><text x="320" y="187" fill="#f9fbff" font-family="sans-serif" font-size="18" text-anchor="middle">${safe}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
