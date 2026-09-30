/**
 * Per-slug cache of component details (props metadata, example code) and preview payloads.
 * Both come from the public API, so premium access is still checked server-side per request.
 */
import { create } from "zustand";
import { api, ApiError, type PreviewPayload } from "@ti/client";
import { resolveComponentMeta } from "./codegen";
import type { ComponentDetail, ComponentMeta } from "./types";

type Entry<T> =
  { status: "loading" } | { status: "ok"; value: T } | { status: "error"; message: string };

interface CatalogCache {
  details: Record<string, Entry<ComponentDetail>>;
  previews: Record<string, Entry<PreviewPayload>>;
  ensureDetail: (slug: string) => void;
  ensurePreview: (slug: string) => void;
  /** Drops cached entries (after sign in/out, access may have changed). */
  clear: () => void;
}

const message = (e: unknown) =>
  e instanceof ApiError
    ? e.status === 401
      ? "Sign in required"
      : e.status === 403
        ? "Premium required"
        : e.message
    : e instanceof Error
      ? e.message
      : "Request failed";

export const useCatalogCache = create<CatalogCache>()((set, get) => ({
  details: {},
  previews: {},
  ensureDetail: (slug) => {
    if (get().details[slug]) return;
    set((s) => ({ details: { ...s.details, [slug]: { status: "loading" } } }));
    api<ComponentDetail>(`/api/components/${slug}`)
      .then((value) => set((s) => ({ details: { ...s.details, [slug]: { status: "ok", value } } })))
      .catch((e: unknown) =>
        set((s) => ({
          details: { ...s.details, [slug]: { status: "error", message: message(e) } },
        })),
      );
  },
  ensurePreview: (slug) => {
    if (get().previews[slug]) return;
    set((s) => ({ previews: { ...s.previews, [slug]: { status: "loading" } } }));
    api<PreviewPayload>(`/api/components/${slug}/preview`)
      .then((value) =>
        set((s) => ({ previews: { ...s.previews, [slug]: { status: "ok", value } } })),
      )
      .catch((e: unknown) =>
        set((s) => ({
          previews: { ...s.previews, [slug]: { status: "error", message: message(e) } },
        })),
      );
  },
  clear: () => set({ details: {}, previews: {} }),
}));

/** Metadata for codegen from loaded details (locked components stay undefined). */
export function metasFrom(details: Record<string, Entry<ComponentDetail>>, slugs: string[]) {
  const out: Record<string, ComponentMeta | undefined> = {};
  for (const slug of slugs) {
    const d = details[slug];
    if (d?.status === "ok" && !d.value.locked)
      out[slug] = resolveComponentMeta(d.value, window.location.origin);
  }
  return out;
}

/**
 * Merges several component previews into one payload the sandbox can render: shared theme,
 * files deduplicated by path, and the generated page as the only example.
 */
export function mergePreviews(
  previews: Record<string, Entry<PreviewPayload>>,
  slugs: string[],
  pageCode: string,
): {
  payload: PreviewPayload | null;
  pending: string[];
  failed: { slug: string; message: string }[];
} {
  const pending: string[] = [];
  const failed: { slug: string; message: string }[] = [];
  const files = new Map<string, string>();
  let themeCss: string | null = null;
  for (const slug of slugs) {
    const p = previews[slug];
    if (!p || p.status === "loading") pending.push(slug);
    else if (p.status === "error") failed.push({ slug, message: p.message });
    else {
      themeCss ??= p.value.themeCss;
      for (const f of p.value.files) if (!files.has(f.path)) files.set(f.path, f.content);
    }
  }
  if (pending.length || themeCss === null) return { payload: null, pending, failed };
  return {
    payload: {
      slug: "builder-page",
      version: "0.0.0",
      themeCss,
      files: [...files].map(([path, content]) => ({ path, content })),
      examples: [{ title: "Page", code: pageCode }],
    },
    pending,
    failed,
  };
}
