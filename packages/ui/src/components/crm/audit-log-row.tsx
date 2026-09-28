import * as React from "react";
import { ArrowRight, Bot, ChevronDown, Globe, Plug, Undo2 } from "lucide-react";
import { Avatar } from "@/components/crm/avatar";
import { RelativeTime } from "@/components/crm/relative-time";
import { cn } from "@/lib/utils";

export type AuditValue = string | number | boolean | null | string[];
export type AuditFieldType =
  "text" | "currency" | "number" | "date" | "boolean" | "list" | "longtext";

export interface AuditChange {
  field: string;
  type?: AuditFieldType;
  from: AuditValue;
  to: AuditValue;
  /** ISO currency for type "currency". */
  currency?: string;
  /** Mask both values (e.g. SSN, bank details) while still recording that a change happened. */
  sensitive?: boolean;
}

export interface AuditEntry {
  id: string;
  at: Date | string | number;
  actor: { name: string; src?: string; kind?: "user" | "automation" | "integration" | "api" };
  action: "created" | "updated" | "deleted" | "restored" | "merged";
  changes: AuditChange[];
  /** Where the change came from, e.g. "Web app", "Zapier", "Workflow: Stage sync". */
  source?: string;
  ip?: string;
}

export interface AuditLogRowProps {
  entry: AuditEntry;
  locale?: string;
  /** Show a revert action for single-field updates. */
  onRevert?: (entry: AuditEntry, change: AuditChange) => void;
  /** Collapse more than this many field changes behind a toggle. */
  collapseAfter?: number;
  className?: string;
}

export function formatAuditValue(v: AuditValue, c: AuditChange, locale?: string): string {
  if (c.sensitive) return "••••••";
  if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) return "Empty";
  if (Array.isArray(v)) return v.join(", ");
  switch (c.type) {
    case "currency":
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: c.currency ?? "USD",
        maximumFractionDigits: 0,
      }).format(Number(v));
    case "number":
      return new Intl.NumberFormat(locale).format(Number(v));
    case "date": {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime())
        ? String(v)
        : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
    }
    case "boolean":
      return v ? "Yes" : "No";
    default:
      return String(v);
  }
}

/** Signed delta for numeric fields: "+$12,000 (+25%)". */
function delta(c: AuditChange, locale?: string): { text: string; up: boolean } | null {
  if ((c.type !== "currency" && c.type !== "number") || c.sensitive) return null;
  if (typeof c.from !== "number" || typeof c.to !== "number") return null;
  const d = c.to - c.from;
  if (d === 0) return null;
  const abs = formatAuditValue(Math.abs(d), c, locale);
  const pct =
    c.from !== 0 ? ` (${d > 0 ? "+" : "−"}${Math.abs(Math.round((d / c.from) * 100))}%)` : "";
  return { text: `${d > 0 ? "+" : "−"}${abs}${pct}`, up: d > 0 };
}

function ListDiff({ from, to }: { from: string[]; to: string[] }) {
  const added = to.filter((x) => !from.includes(x));
  const removed = from.filter((x) => !to.includes(x));
  return (
    <span className="flex flex-wrap gap-1">
      {removed.map((x) => (
        <del key={`-${x}`} className="rounded bg-crm-danger/10 px-1 text-crm-danger">
          {x}
        </del>
      ))}
      {added.map((x) => (
        <ins key={`+${x}`} className="rounded bg-crm-success/10 px-1 text-crm-success no-underline">
          {x}
        </ins>
      ))}
    </span>
  );
}

const actorIcon = { automation: Bot, integration: Plug, api: Globe } as const;
const verb: Record<AuditEntry["action"], string> = {
  created: "created this record",
  updated: "updated",
  deleted: "deleted this record",
  restored: "restored this record",
  merged: "merged a duplicate into this record",
};

/**
 * One audit-trail entry: who (user, automation or integration), when, from where, and a
 * field-level before → after diff with currency/number deltas, list add/remove, masked
 * sensitive fields, long-text collapse and optional revert.
 */
export function AuditLogRow({
  entry,
  locale,
  onRevert,
  collapseAfter = 3,
  className,
}: AuditLogRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const kind = entry.actor.kind ?? "user";
  const Icon = kind === "user" ? null : actorIcon[kind];
  const changes = expanded ? entry.changes : entry.changes.slice(0, collapseAfter);
  const hidden = entry.changes.length - changes.length;
  const summary =
    entry.action === "updated"
      ? entry.changes.length === 1
        ? `updated ${entry.changes[0]?.field}`
        : `updated ${entry.changes.length} fields`
      : verb[entry.action];

  return (
    <article
      aria-label={`${entry.actor.name} ${summary}`}
      className={cn(
        "flex gap-3 border-b border-crm-border px-4 py-3 font-crm last:border-b-0",
        className,
      )}
    >
      {Icon ? (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-crm-muted text-crm-soft">
          <Icon className="size-3.5" aria-hidden />
        </span>
      ) : (
        <Avatar name={entry.actor.name} src={entry.actor.src} size="md" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <span className="font-medium text-crm-fg">{entry.actor.name}</span>
          <span className="text-crm-soft">{summary}</span>
          <span className="crm-caption text-crm-subtle">
            · <RelativeTime date={entry.at} locale={locale} />
          </span>
        </p>
        {entry.source || entry.ip ? (
          <p className="crm-caption text-crm-subtle">
            {[entry.source, entry.ip].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {changes.length ? (
          <dl className="mt-2 flex flex-col gap-1.5 rounded-crm bg-crm-raised p-2.5">
            {changes.map((c) => {
              const d = delta(c, locale);
              const long = c.type === "longtext";
              return (
                <div
                  key={c.field}
                  className="group grid grid-cols-1 gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[140px_1fr_auto] sm:items-center"
                >
                  <dt className="truncate text-crm-soft">{c.field}</dt>
                  <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {c.type === "list" &&
                    Array.isArray(c.from) &&
                    Array.isArray(c.to) &&
                    !c.sensitive ? (
                      <ListDiff from={c.from} to={c.to} />
                    ) : (
                      <>
                        {entry.action !== "created" ? (
                          <>
                            <del
                              className={cn(
                                "min-w-0 text-crm-subtle",
                                long ? "line-clamp-2" : "truncate",
                                c.from === null && "no-underline italic",
                              )}
                            >
                              <span className="sr-only">from </span>
                              {formatAuditValue(c.from, c, locale)}
                            </del>
                            <ArrowRight className="size-3 shrink-0 text-crm-faint" aria-hidden />
                          </>
                        ) : null}
                        <ins
                          className={cn(
                            "min-w-0 text-crm-fg no-underline",
                            long ? "line-clamp-2" : "truncate",
                            c.to === null && "text-crm-subtle italic",
                          )}
                        >
                          <span className="sr-only">to </span>
                          {formatAuditValue(c.to, c, locale)}
                        </ins>
                        {d ? (
                          <span
                            className={cn(
                              "tabular-nums",
                              d.up ? "text-crm-trend" : "text-crm-danger",
                            )}
                          >
                            {d.text}
                          </span>
                        ) : null}
                      </>
                    )}
                  </dd>
                  {onRevert && entry.action === "updated" && !c.sensitive ? (
                    <button
                      type="button"
                      onClick={() => onRevert(entry, c)}
                      aria-label={`Revert ${c.field} to ${formatAuditValue(c.from, c, locale)}`}
                      className="inline-flex items-center gap-1 justify-self-start rounded-full px-1.5 py-0.5 text-crm-soft opacity-0 outline-none group-hover:opacity-100 hover:bg-crm-muted hover:text-crm-fg focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3"
                    >
                      <Undo2 aria-hidden /> Revert
                    </button>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                </div>
              );
            })}
            {entry.changes.length > collapseAfter ? (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((e) => !e)}
                className="inline-flex items-center gap-1 self-start text-xs text-crm-soft hover:text-crm-fg"
              >
                <ChevronDown
                  className={cn("size-3 transition-transform", expanded && "rotate-180")}
                  aria-hidden
                />
                {expanded ? "Show less" : `Show ${hidden} more`}
              </button>
            ) : null}
          </dl>
        ) : null}
      </div>
    </article>
  );
}
