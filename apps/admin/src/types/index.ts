export type ComponentStatus = "draft" | "published" | "unpublished";
export type Access = "free" | "premium";

export interface Summary {
  slug: string;
  status: ComponentStatus;
  name: string;
  category: string;
  access: Access;
  draftVersion: string;
  publishedVersion: string | null;
  publishedAt?: string | null;
  updatedAt: string;
  hasUnpublishedChanges: boolean;
}

export type Detail = Summary & {
  draft: Record<string, unknown>;
  published: Record<string, unknown> | null;
};

export interface Customer {
  id: string;
  email: string;
  name: string;
  plan: Access;
  disabled: boolean;
}

export interface FeatureRow {
  id: string;
  term: string;
  searchCount: number;
  status: string;
}

export const errorMessage = (e: unknown, fallback = "Something went wrong") =>
  e instanceof Error ? e.message : fallback;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago", "yesterday", "just now". */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const diff = (t - Date.now()) / 1000;
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "just now";
}

export const absoluteTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString() : "";
