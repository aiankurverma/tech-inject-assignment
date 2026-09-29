import { format, formatDistanceToNowStrict } from "date-fns";
import * as PapaNs from "papaparse";
import type {
  AuditEvent,
  AuditFacetBucket,
  AuditTimeMode,
} from "@/components/crm/pro-audit-log/types";

/** Unwraps a default export across ESM, CJS and namespace-wrapping interop layers. */
function interopDefault<T>(m: unknown): T {
  let x = m as { default?: unknown } | null;
  for (let i = 0; i < 3 && x && typeof x === "object" && !("$$typeof" in x) && "default" in x; i++)
    x = x.default as { default?: unknown } | null;
  return x as T;
}
const Papa = interopDefault<typeof PapaNs>(PapaNs);

export function toDate(v: string | number): Date {
  return typeof v === "number" ? new Date(v) : new Date(v);
}

export function formatEventTime(v: string | number, mode: AuditTimeMode): string {
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return mode === "relative"
    ? `${formatDistanceToNowStrict(d)} ago`
    : format(d, "yyyy-MM-dd HH:mm:ss");
}

export function formatFullTime(v: string | number): string {
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return `${format(d, "PPpp")} (${d.toISOString()})`;
}

export type ActionTone = "create" | "update" | "delete" | "auth" | "security" | "other";

/** Classifies a dotted verb ("deal.updated") into a colour tone. */
export function actionTone(action: string): ActionTone {
  const verb = action.slice(action.lastIndexOf(".") + 1);
  if (/^(created|added|invited|restored|enabled)$/.test(verb)) return "create";
  if (/^(deleted|removed|revoked|disabled|archived)$/.test(verb)) return "delete";
  if (/^(login|logout|login_failed|mfa_\w+|sso_\w+)$/.test(verb)) return "auth";
  if (/(role|permission|key|secret|export)/.test(action)) return "security";
  if (/^(updated|changed|role_changed|renamed|moved|merged)$/.test(verb)) return "update";
  return "other";
}

export const toneClass: Record<ActionTone, string> = {
  create: "bg-crm-success/12 text-crm-success",
  update: "bg-crm-primary/20 text-crm-fg",
  delete: "bg-crm-danger/12 text-crm-danger",
  auth: "bg-crm-muted text-crm-soft",
  security: "bg-crm-warning/12 text-crm-warning",
  other: "bg-crm-muted text-crm-soft",
};

/** Facet counts over loaded rows: used only when the server does not send facets. O(n). */
export function localFacets(events: AuditEvent[]) {
  const actors = new Map<string, AuditFacetBucket>();
  const actions = new Map<string, AuditFacetBucket>();
  const resources = new Map<string, AuditFacetBucket>();
  const bump = (m: Map<string, AuditFacetBucket>, value: string, label?: string) => {
    const b = m.get(value);
    if (b) b.count++;
    else m.set(value, { value, label, count: 1 });
  };
  for (const e of events) {
    bump(actors, e.actor.id, e.actor.name);
    bump(actions, e.action);
    bump(resources, e.resource.type);
  }
  const sort = (m: Map<string, AuditFacetBucket>) =>
    [...m.values()].sort((a, b) => b.count - a.count);
  return { actors: sort(actors), actions: sort(actions), resources: sort(resources) };
}

/** RFC 4180 CSV (via papaparse) with formula-injection guarding for spreadsheet safety. */
export function eventsToCsv(events: AuditEvent[]): string {
  const safe = (v: unknown) => {
    const s = v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  };
  return Papa.unparse({
    fields: [
      "id",
      "occurred_at",
      "actor_id",
      "actor_name",
      "actor_email",
      "action",
      "resource_type",
      "resource_id",
      "resource_name",
      "outcome",
      "ip",
      "location",
      "request_id",
      "before",
      "after",
    ],
    data: events.map((e) =>
      [
        e.id,
        toDate(e.occurredAt).toISOString(),
        e.actor.id,
        e.actor.name,
        e.actor.email,
        e.action,
        e.resource.type,
        e.resource.id,
        e.resource.name,
        e.outcome,
        e.ip,
        e.location,
        e.requestId,
        e.before,
        e.after,
      ].map(safe),
    ),
  });
}

export function downloadText(content: string, fileName: string, mime = "text/csv;charset=utf-8") {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob(["﻿", content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
