import * as React from "react";
import { GitCompare, History, RotateCcw, Tag as TagIcon } from "lucide-react";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { cn } from "@/lib/utils";

export interface RecordVersion {
  id: string;
  /** Monotonic version number, shown as v12. */
  number: number;
  at: Date | string | number;
  author: { name: string; src?: string };
  /** Optional named milestone, e.g. "Sent to legal". */
  label?: string;
  /** Snapshot of the record fields at this version. */
  snapshot: Record<string, string | number | boolean | null>;
}

export interface VersionHistoryProps {
  versions: RecordVersion[];
  /** Human labels for snapshot keys; unknown keys fall back to the key. */
  fieldLabels?: Record<string, string>;
  /** Restore the record to a version. Can be async; the button shows a spinner. */
  onRestore?: (version: RecordVersion) => Promise<void> | void;
  locale?: string;
  loading?: boolean;
  className?: string;
}

type Diff = { key: string; before: unknown; after: unknown };

export function diffSnapshots(a: RecordVersion["snapshot"], b: RecordVersion["snapshot"]): Diff[] {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys
    .filter((k) => (a[k] ?? null) !== (b[k] ?? null))
    .map((k) => ({ key: k, before: a[k] ?? null, after: b[k] ?? null }));
}

const show = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? "Empty"
    : typeof v === "boolean"
      ? v
        ? "Yes"
        : "No"
      : String(v);

function dayKey(d: Date, locale?: string): string {
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}

/**
 * Record revision browser. Versions are grouped by day; pick one to see what changed against
 * the previous version, or tick two to compare any pair. Restore creates a new version.
 */
export function VersionHistory({
  versions,
  fieldLabels = {},
  onRestore,
  locale,
  loading,
  className,
}: VersionHistoryProps) {
  const sorted = React.useMemo(() => [...versions].sort((a, b) => b.number - a.number), [versions]);
  const [selected, setSelected] = React.useState<string | null>(sorted[0]?.id ?? null);
  const [compare, setCompare] = React.useState<string[]>([]);
  const [restoring, setRestoring] = React.useState<string | null>(null);
  const [namedOnly, setNamedOnly] = React.useState(false);
  const latest = sorted[0];

  const list = namedOnly ? sorted.filter((v) => v.label) : sorted;

  let left: RecordVersion | undefined;
  let right: RecordVersion | undefined;
  if (compare.length === 2) {
    const [a, b] = compare.map((id) => sorted.find((v) => v.id === id));
    if (a && b) [left, right] = a.number < b.number ? [a, b] : [b, a];
  } else {
    right = sorted.find((v) => v.id === selected);
    left = right ? sorted.find((v) => v.number < right!.number) : undefined;
  }
  const diffs = right ? diffSnapshots(left?.snapshot ?? {}, right.snapshot) : [];

  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));

  const restore = async (v: RecordVersion) => {
    if (!onRestore) return;
    setRestoring(v.id);
    try {
      await onRestore(v);
    } finally {
      setRestoring(null);
    }
  };

  const time = (d: Date) =>
    new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
  let lastDay = "";

  return (
    <section
      aria-label="Version history"
      className={cn(
        "grid overflow-hidden rounded-xl border border-crm-border bg-crm-card font-crm md:grid-cols-[280px_1fr]",
        className,
      )}
    >
      <div className="flex max-h-[480px] flex-col border-b border-crm-border md:border-r md:border-b-0">
        <header className="flex items-center justify-between gap-2 border-b border-crm-border px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-sm font-medium text-crm-fg">
            <History className="size-3.5 text-crm-soft" aria-hidden /> {versions.length} versions
          </span>
          <label className="flex items-center gap-1.5 text-xs text-crm-soft">
            <input
              type="checkbox"
              checked={namedOnly}
              onChange={(e) => setNamedOnly(e.target.checked)}
              className="accent-[var(--color-crm-primary)]"
            />
            Named only
          </label>
        </header>
        <ol className="flex-1 overflow-y-auto p-1.5" aria-label="Versions">
          {loading ? (
            <li className="px-3 py-6 text-center crm-caption text-crm-soft">Loading history…</li>
          ) : list.length === 0 ? (
            <li className="px-3 py-6 text-center crm-caption text-crm-soft">
              {namedOnly ? "No named versions yet." : "No versions recorded."}
            </li>
          ) : (
            list.map((v) => {
              const d = new Date(v.at);
              const day = dayKey(d, locale);
              const header = day !== lastDay ? day : null;
              lastDay = day;
              const active = compare.length < 2 && selected === v.id;
              const inCompare = compare.includes(v.id);
              return (
                <React.Fragment key={v.id}>
                  {header ? (
                    <li className="px-2 pt-2 pb-1 crm-eyebrow text-crm-subtle">{header}</li>
                  ) : null}
                  <li
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5",
                      active || inCompare ? "bg-crm-muted" : "hover:bg-crm-raised",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={inCompare}
                      onChange={() => toggleCompare(v.id)}
                      aria-label={`Compare version ${v.number}`}
                      className="accent-[var(--color-crm-primary)]"
                    />
                    <button
                      type="button"
                      aria-current={active || undefined}
                      onClick={() => {
                        setCompare([]);
                        setSelected(v.id);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:underline"
                    >
                      <Avatar name={v.author.name} src={v.author.src} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm text-crm-fg">
                          <span className="tabular-nums">v{v.number}</span>
                          {v.id === latest?.id ? (
                            <span className="rounded-full bg-crm-status/15 px-1.5 text-[10px] text-crm-status">
                              Current
                            </span>
                          ) : null}
                          {v.label ? (
                            <span className="inline-flex min-w-0 items-center gap-0.5 truncate text-xs text-crm-warning">
                              <TagIcon className="size-3 shrink-0" aria-hidden />
                              {v.label}
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate crm-caption text-crm-soft">
                          {v.author.name} · <time dateTime={d.toISOString()}>{time(d)}</time>
                        </span>
                      </span>
                    </button>
                  </li>
                </React.Fragment>
              );
            })
          )}
        </ol>
      </div>

      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-sm text-crm-fg" aria-live="polite">
            {compare.length === 2 ? (
              <GitCompare className="size-3.5 text-crm-soft" aria-hidden />
            ) : null}
            {right
              ? left
                ? `v${left.number} → v${right.number}`
                : `v${right.number} · initial version`
              : compare.length === 1
                ? "Tick one more version to compare"
                : "Select a version"}
            {right ? (
              <span className="crm-caption text-crm-subtle">
                {diffs.length} {diffs.length === 1 ? "change" : "changes"}
              </span>
            ) : null}
          </p>
          {right && onRestore && right.id !== latest?.id && compare.length < 2 ? (
            <Button size="sm" loading={restoring === right.id} onClick={() => restore(right!)}>
              <RotateCcw aria-hidden /> Restore v{right.number}
            </Button>
          ) : null}
        </header>
        <div className="flex-1 overflow-y-auto p-3">
          {!right ? null : diffs.length === 0 ? (
            <p className="py-8 text-center crm-caption text-crm-soft">
              No field changes between these versions.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-crm-subtle">
                  <th scope="col" className="pb-2 font-normal">
                    Field
                  </th>
                  <th scope="col" className="pb-2 font-normal">
                    {left ? `v${left.number}` : "Before"}
                  </th>
                  <th scope="col" className="pb-2 font-normal">
                    v{right.number}
                  </th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <tr key={d.key} className="border-t border-crm-border align-top">
                    <th scope="row" className="py-2 pr-3 font-normal text-crm-soft">
                      {fieldLabels[d.key] ?? d.key}
                    </th>
                    <td className="py-2 pr-3">
                      <span className="rounded bg-crm-danger/10 px-1 break-words text-crm-danger line-through decoration-crm-danger/50">
                        {show(d.before)}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="rounded bg-crm-success/10 px-1 break-words text-crm-success">
                        {show(d.after)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
