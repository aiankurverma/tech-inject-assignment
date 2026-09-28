import * as React from "react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/crm/search-input";
import { Tag, type TagColor } from "@/components/crm/tag";
import { Button } from "@/components/crm/button";

export type ChangeType = "new" | "improved" | "fixed" | "breaking" | "security";

export interface ChangeItem {
  type: ChangeType;
  text: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  /** ISO date. */
  date: string;
  title: string;
  summary?: string;
  changes: ChangeItem[];
  /** e.g. "Pro", "Enterprise" — plans that get this release. */
  plans?: string[];
}

export interface ChangelogProps {
  entries: ChangelogEntry[];
  /** ISO date of the viewer's last visit; newer entries get a "New" marker. */
  lastSeen?: string;
  /** Entries per page before "Load older". */
  pageSize?: number;
  onMarkAllRead?: () => void;
  locale?: string;
  className?: string;
}

const typeMeta: Record<ChangeType, { label: string; color: TagColor }> = {
  new: { label: "New", color: "green" },
  improved: { label: "Improved", color: "blue" },
  fixed: { label: "Fixed", color: "neutral" },
  breaking: { label: "Breaking", color: "red" },
  security: { label: "Security", color: "amber" },
};

/** Product changelog grouped by month with type filters, search, unread markers and paging. */
export function Changelog({
  entries,
  lastSeen,
  pageSize = 5,
  onMarkAllRead,
  locale = "en-US",
  className,
}: ChangelogProps) {
  const [types, setTypes] = React.useState<ChangeType[]>([]);
  const [query, setQuery] = React.useState("");
  const [limit, setLimit] = React.useState(pageSize);
  const seen = lastSeen ? new Date(lastSeen).getTime() : null;

  const sorted = React.useMemo(
    () => [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries],
  );
  const q = query.trim().toLowerCase();
  const filtered = sorted
    .map((e) => ({
      ...e,
      changes: e.changes.filter(
        (c) =>
          (types.length === 0 || types.includes(c.type)) &&
          (!q ||
            c.text.toLowerCase().includes(q) ||
            e.title.toLowerCase().includes(q) ||
            e.version.toLowerCase().includes(q)),
      ),
    }))
    .filter((e) => e.changes.length > 0);

  const unread = seen === null ? 0 : sorted.filter((e) => new Date(e.date).getTime() > seen).length;
  const page = filtered.slice(0, limit);
  const groups: { key: string; label: string; items: typeof page }[] = [];
  for (const e of page) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = {
        key,
        label: d.toLocaleDateString(locale, { month: "long", year: "numeric" }),
        items: [],
      };
      groups.push(g);
    }
    g.items.push(e);
  }

  const counts = (t: ChangeType) =>
    sorted.reduce((n, e) => n + e.changes.filter((c) => c.type === t).length, 0);

  return (
    <section aria-label="Changelog" className={cn("flex flex-col gap-5 font-crm", className)}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-crm-soft">
            {unread > 0 ? (
              <>
                <span className="font-medium text-crm-fg">{unread}</span> release
                {unread > 1 ? "s" : ""} since your last visit
              </>
            ) : (
              "You're up to date."
            )}
          </p>
          {unread > 0 && onMarkAllRead ? (
            <Button size="sm" variant="ghost" onClick={onMarkAllRead}>
              Mark all as read
            </Button>
          ) : null}
        </div>
        <SearchInput
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setLimit(pageSize);
          }}
          placeholder="Search releases, versions, fixes"
          aria-label="Search changelog"
        />
        <div role="group" aria-label="Filter by change type" className="flex flex-wrap gap-1">
          {(Object.keys(typeMeta) as ChangeType[]).map((t) => {
            const on = types.includes(t);
            const n = counts(t);
            if (n === 0) return null;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setTypes((cur) => (on ? cur.filter((x) => x !== t) : [...cur, t]));
                  setLimit(pageSize);
                }}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  on
                    ? "border-crm-ring bg-crm-raised text-crm-fg"
                    : "border-crm-border text-crm-muted-fg hover:text-crm-fg",
                )}
              >
                {typeMeta[t].label} <span className="text-crm-subtle tabular-nums">{n}</span>
              </button>
            );
          })}
          {types.length ? (
            <button
              type="button"
              onClick={() => setTypes([])}
              className="h-7 px-2 text-xs text-crm-subtle hover:text-crm-fg"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-crm border border-dashed border-crm-border p-8 text-center text-sm text-crm-subtle">
          No releases match these filters.
        </p>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-3">
            <h2 className="sticky top-0 z-10 bg-crm-bg/90 py-1 crm-eyebrow text-crm-soft backdrop-blur">
              {g.label}
            </h2>
            <ol className="flex flex-col gap-3 border-l border-crm-border pl-4">
              {g.items.map((e) => {
                const isNew = seen !== null && new Date(e.date).getTime() > seen;
                return (
                  <li key={e.id} className="relative">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-4 -left-[21px] size-2.5 rounded-full border-2 border-crm-bg",
                        isNew ? "bg-crm-primary" : "bg-crm-faint",
                      )}
                    />
                    <article
                      aria-labelledby={`cl-${e.id}`}
                      className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-4"
                    >
                      <header className="flex flex-wrap items-center gap-2">
                        <span className="rounded-[6px] bg-crm-muted px-1.5 py-0.5 font-mono text-xs text-crm-fg">
                          v{e.version}
                        </span>
                        <time dateTime={e.date} className="crm-caption text-crm-subtle">
                          {new Date(e.date).toLocaleDateString(locale, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </time>
                        {isNew ? (
                          <Tag size="sm" color="purple">
                            New
                          </Tag>
                        ) : null}
                        {e.plans?.map((p) => (
                          <Tag key={p} size="sm" color="neutral">
                            {p}
                          </Tag>
                        ))}
                      </header>
                      <h3 id={`cl-${e.id}`} className="text-sm font-semibold text-crm-fg">
                        {e.title}
                      </h3>
                      {e.summary ? <p className="text-sm text-crm-soft">{e.summary}</p> : null}
                      <ul className="flex flex-col gap-1.5">
                        {e.changes.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-crm-soft">
                            <Tag
                              size="sm"
                              color={typeMeta[c.type].color}
                              className="mt-0.5 w-[68px]"
                            >
                              {typeMeta[c.type].label}
                            </Tag>
                            <span>{c.text}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>
        ))
      )}

      {filtered.length > limit ? (
        <Button className="self-center" onClick={() => setLimit((l) => l + pageSize)}>
          Load older releases ({filtered.length - limit} more)
        </Button>
      ) : null}
    </section>
  );
}
