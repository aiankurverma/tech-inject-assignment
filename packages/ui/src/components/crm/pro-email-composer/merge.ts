import type { JSONContent } from "@tiptap/react";
import type { MergeRecord } from "@/components/crm/pro-email-composer/types";

/** Name of the Tiptap node that holds a merge field. */
export const MERGE_NODE = "mergeField";

/** `{{ contact.firstName | there }}` with optional fallback after a pipe. */
const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g;

/** Read a dot path ("company.name") from a nested record. */
export function getPath(record: MergeRecord | undefined, key: string): unknown {
  let cur: unknown = record;
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export interface Resolved {
  text: string;
  /** "value" = record had it, "fallback" = fallback used, "missing" = nothing to show. */
  source: "value" | "fallback" | "missing";
}

export function resolveField(
  record: MergeRecord | undefined,
  key: string,
  fallback: string | null | undefined,
): Resolved {
  const v = getPath(record, key);
  if (v != null && String(v).trim() !== "") {
    return { text: v instanceof Date ? v.toLocaleDateString() : String(v), source: "value" };
  }
  if (fallback) return { text: fallback, source: "fallback" };
  return { text: "", source: "missing" };
}

/** Replace `{{key|fallback}}` tokens in plain text (used for the subject line). */
export function renderTokens(text: string, record: MergeRecord | undefined): string {
  return text.replace(
    TOKEN_RE,
    (_, key: string, fb?: string) => resolveField(record, key, fb).text,
  );
}

/** Keys referenced as tokens in plain text. */
export function tokensIn(text: string): { key: string; fallback: string | null }[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => ({ key: m[1]!, fallback: m[2] ?? null }));
}

/** Every merge field node in a document, in order. */
export function mergeFieldsIn(doc: JSONContent): { key: string; fallback: string | null }[] {
  const out: { key: string; fallback: string | null }[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === MERGE_NODE && n.attrs?.id) {
      out.push({ key: String(n.attrs.id), fallback: (n.attrs.fallback as string) || null });
    }
    n.content?.forEach(walk);
  };
  walk(doc);
  return out;
}

export function token(key: string, fallback: string | null | undefined): string {
  return fallback ? `{{${key}|${fallback}}}` : `{{${key}}}`;
}
