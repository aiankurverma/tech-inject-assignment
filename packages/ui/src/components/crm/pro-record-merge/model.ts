/** Data model and pure helpers for ProRecordMerge (dedupe, merge picks, bulk edits). */
import { z } from "zod";
import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";

/**
 * react-hook-form resolver backed by zod's safeParse. Kept in-house (a few
 * lines) because the preview sandbox exposes only the bare "@hookform/resolvers"
 * entry, not its "/zod" subpath. Forms here are flat, so paths join with ".".
 */
export function zodFormResolver<T extends FieldValues>(schema: z.ZodTypeAny): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data as T, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "root";
      if (!errors[key]) errors[key] = { type: String(issue.code), message: issue.message };
    }
    return { values: {}, errors: errors as unknown as FieldErrors<T> };
  };
}

export type MergeFieldType =
  "text" | "longtext" | "email" | "phone" | "url" | "number" | "date" | "tags";

export type FieldValue = string | number | string[] | null | undefined;

export interface MergeField {
  key: string;
  label: string;
  type?: MergeFieldType;
  required?: boolean;
  /** Allowed values; shown as a select in bulk edit. */
  options?: string[];
  /** Exclude from bulk edit (e.g. ids, computed fields). Default true. */
  bulkEditable?: boolean;
}

export interface MergeRecord {
  id: string;
  values: Record<string, FieldValue>;
  /** ISO date-time of the last update; drives the "most recent" strategy. */
  updatedAt: string;
  createdAt?: string;
  /** Where the record came from, e.g. "HubSpot import", "Web form". */
  source?: string;
}

/** Which record a merged field comes from, or "custom" when edited by hand. */
export type FieldPick = string | "custom";
export type MergeStrategy = "primary" | "recent" | "complete";

export interface MergeAuditField {
  key: string;
  label: string;
  value: FieldValue;
  pickedFrom: FieldPick;
  conflict: boolean;
  /** Each input record's value, by record id. */
  candidates: Record<string, FieldValue>;
}

export interface MergeAudit {
  survivorId: string;
  mergedIds: string[];
  mergedAt: string;
  fields: MergeAuditField[];
  conflictsResolved: number;
  customEdits: number;
}

export interface MergeResult {
  survivor: MergeRecord;
  removedIds: string[];
  audit: MergeAudit;
}

// ---------- value helpers ----------

export const isEmpty = (v: FieldValue) =>
  v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** Normalised form used for conflict detection (case, spacing, phone punctuation). */
export function normalize(v: FieldValue, type: MergeFieldType = "text"): string {
  if (isEmpty(v)) return "";
  if (Array.isArray(v))
    return [...v]
      .map((t) => t.trim().toLowerCase())
      .sort()
      .join("|");
  const s = String(v).trim();
  if (type === "phone") return s.replace(/[^\d+]/g, "").replace(/^\+?1(?=\d{10}$)/, "");
  if (type === "email" || type === "url") return s.toLowerCase();
  if (type === "number") return String(Number(s));
  return s.replace(/\s+/g, " ").toLowerCase();
}

export function display(v: FieldValue): string {
  if (isEmpty(v)) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

/** Convert a form string back into a typed value. */
export function parseValue(s: string, type: MergeFieldType = "text"): FieldValue {
  const t = s.trim();
  if (t === "") return null;
  if (type === "number") return Number(t);
  if (type === "tags")
    return [
      ...new Set(
        t
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ];
  return type === "longtext" ? s : t;
}

export function hasConflict(records: readonly MergeRecord[], field: MergeField) {
  const seen = new Set<string>();
  for (const r of records) {
    const n = normalize(r.values[field.key], field.type);
    if (n) seen.add(n);
    if (seen.size > 1) return true;
  }
  return false;
}

export function completeness(record: MergeRecord, fields: readonly MergeField[]) {
  if (!fields.length) return 0;
  return fields.filter((f) => !isEmpty(record.values[f.key])).length / fields.length;
}

/** Default winner per field for a strategy. Falls back to any non-empty value. */
export function autoPicks(
  records: readonly MergeRecord[],
  fields: readonly MergeField[],
  survivorId: string,
  strategy: MergeStrategy,
): Record<string, FieldPick> {
  const byRecent = [...records].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const byComplete = [...records].sort((a, b) => completeness(b, fields) - completeness(a, fields));
  const survivor = records.find((r) => r.id === survivorId) ?? records[0];
  const order =
    strategy === "recent"
      ? byRecent
      : strategy === "complete"
        ? byComplete
        : [survivor, ...byRecent.filter((r) => r !== survivor)];
  const picks: Record<string, FieldPick> = {};
  for (const f of fields) {
    const hit = order.find((r) => r && !isEmpty(r.values[f.key]));
    picks[f.key] = (hit ?? survivor)?.id ?? survivorId;
  }
  return picks;
}

/** Zod schema for the merged record form; every field is edited as a string. */
export function buildSchema(fields: readonly MergeField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    let s: z.ZodTypeAny;
    switch (f.type) {
      case "email":
        s = z.string().trim().email("Enter a valid email").or(z.literal(""));
        break;
      case "url":
        s = z.string().trim().url("Enter a full URL").or(z.literal(""));
        break;
      case "number":
        s = z
          .string()
          .trim()
          .regex(/^-?\d+(\.\d+)?$/, "Enter a number")
          .or(z.literal(""));
        break;
      case "date":
        s = z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}/, "Use YYYY-MM-DD")
          .or(z.literal(""));
        break;
      case "phone":
        s = z
          .string()
          .trim()
          .regex(/^[+\d][\d\s().-]{5,}$/, "Enter a valid phone")
          .or(z.literal(""));
        break;
      default:
        s = z.string();
    }
    if (f.required)
      s = s.refine((v: string) => v.trim() !== "", { message: `${f.label} is required` });
    shape[f.key] = s;
  }
  return z.object(shape);
}

// ---------- duplicate detection ----------

export interface DuplicateGroup {
  id: string;
  recordIds: string[];
  /** Human reason, e.g. "Same email". */
  reason: string;
}

/**
 * Union-find over match keys (normalised email, phone, name+company). O(n α(n)).
 * `keys` maps field keys to the match rule label.
 */
export function findDuplicateGroups(
  records: readonly MergeRecord[],
  rules: { label: string; key: (r: MergeRecord) => string }[],
): DuplicateGroup[] {
  const parent = new Map<string, string>();
  const reason = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    parent.set(x, p);
    return p;
  };
  for (const rule of rules) {
    const first = new Map<string, string>();
    for (const r of records) {
      const k = rule.key(r);
      if (!k) continue;
      const other = first.get(k);
      if (!other) {
        first.set(k, r.id);
        continue;
      }
      const a = find(r.id);
      const b = find(other);
      if (a !== b) {
        parent.set(a, b);
        if (!reason.has(b)) reason.set(b, reason.get(a) ?? rule.label);
      } else if (!reason.has(b)) reason.set(b, rule.label);
    }
  }
  const groups = new Map<string, string[]>();
  for (const r of records) {
    if (!parent.has(r.id)) continue;
    const root = find(r.id);
    const list = groups.get(root) ?? [];
    list.push(r.id);
    groups.set(root, list);
  }
  const out: DuplicateGroup[] = [];
  for (const [root, ids] of groups) {
    if (ids.length < 2) continue;
    out.push({ id: root, recordIds: ids, reason: reason.get(root) ?? "Matched" });
  }
  return out.sort((a, b) => b.recordIds.length - a.recordIds.length || a.id.localeCompare(b.id));
}

// ---------- bulk edit ----------

export type BulkOp =
  | { kind: "set"; field: string; value: string }
  | { kind: "clear"; field: string }
  | { kind: "addTag"; field: string; value: string }
  | { kind: "removeTag"; field: string; value: string }
  | { kind: "replace"; field: string; find: string; value: string };

export function applyBulkOp(v: FieldValue, op: BulkOp, type: MergeFieldType = "text"): FieldValue {
  switch (op.kind) {
    case "set":
      return parseValue(op.value, type);
    case "clear":
      return null;
    case "addTag": {
      const list = Array.isArray(v) ? v : isEmpty(v) ? [] : [String(v)];
      const t = op.value.trim();
      return !t || list.some((x) => x.toLowerCase() === t.toLowerCase()) ? v : [...list, t];
    }
    case "removeTag": {
      if (!Array.isArray(v)) return v;
      const next = v.filter((x) => x.toLowerCase() !== op.value.trim().toLowerCase());
      return next.length === v.length ? v : next;
    }
    case "replace": {
      if (isEmpty(v) || !op.find) return v;
      const s = display(v);
      const next = s.split(op.find).join(op.value);
      return next === s ? v : parseValue(next, type);
    }
  }
}

export function describeOp(op: BulkOp, label: string) {
  switch (op.kind) {
    case "set":
      return `Set ${label} to "${op.value}"`;
    case "clear":
      return `Clear ${label}`;
    case "addTag":
      return `Add "${op.value}" to ${label}`;
    case "removeTag":
      return `Remove "${op.value}" from ${label}`;
    case "replace":
      return `Replace "${op.find}" with "${op.value}" in ${label}`;
  }
}
