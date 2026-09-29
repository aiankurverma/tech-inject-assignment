import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { format, parseISO, subDays } from "date-fns";
import { CalendarDays, ChevronDown, Search, X } from "lucide-react";
import type { AuditFacetBucket, AuditFilters } from "@/components/crm/pro-audit-log/types";
import { cn } from "@/lib/utils";

const MAX_FACET_ROWS = 200;

const triggerCls =
  "inline-flex h-8 items-center gap-1.5 rounded-crm border border-crm-border bg-crm-card px-2.5 text-sm text-crm-soft hover:text-crm-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-crm-ring data-[active=true]:border-crm-primary/60 data-[active=true]:text-crm-fg disabled:opacity-50";
const panelCls =
  "z-50 rounded-crm border border-crm-border bg-crm-popover text-crm-fg shadow-crm-overlay animate-crm-in";

interface FacetProps {
  label: string;
  buckets: AuditFacetBucket[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/** Multi-select facet with in-list search and counts. Renders at most 200 rows; search narrows the rest. */
export function FacetFilter({ label, buckets, selected, onChange, disabled }: FacetProps) {
  const [query, setQuery] = React.useState("");
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const visible = React.useMemo<AuditFacetBucket[]>(() => {
    const q = query.trim().toLowerCase();
    const all = q ? buckets.filter((b) => (b.label ?? b.value).toLowerCase().includes(q)) : buckets;
    // Keep selected values visible even when the server no longer returns them.
    const missing = selected
      .filter((v) => !all.some((b) => b.value === v))
      .map((v) => ({ value: v, count: 0 }));
    return [...missing, ...all];
  }, [buckets, query, selected]);
  const id = React.useId();

  const toggle = (value: string) =>
    onChange(selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <Popover.Root onOpenChange={(o) => !o && setQuery("")}>
      <Popover.Trigger className={triggerCls} data-active={selected.length > 0} disabled={disabled}>
        {label}
        {selected.length > 0 && (
          <span className="rounded bg-crm-primary px-1 text-[11px] text-crm-primary-fg">
            {selected.length}
          </span>
        )}
        <ChevronDown className="size-3.5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className={cn(panelCls, "w-72 p-2")}>
          <label htmlFor={id} className="sr-only">
            Search {label.toLowerCase()}
          </label>
          <input
            id={id}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="mb-2 h-8 w-full rounded-crm border border-crm-input bg-crm-bg px-2 text-sm outline-none placeholder:text-crm-muted-fg focus:border-crm-ring"
          />
          <div role="group" aria-label={label} className="max-h-64 overflow-y-auto">
            {visible.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-crm-muted-fg">No matches</p>
            )}
            {visible.slice(0, MAX_FACET_ROWS).map((b) => (
              <label
                key={b.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-crm-muted"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(b.value)}
                  onChange={() => toggle(b.value)}
                  className="size-3.5 accent-[var(--color-crm-primary)]"
                />
                <span className="min-w-0 flex-1 truncate">{b.label ?? b.value}</span>
                <span className="text-xs tabular-nums text-crm-muted-fg">
                  {b.count.toLocaleString()}
                </span>
              </label>
            ))}
            {visible.length > MAX_FACET_ROWS && (
              <p className="px-2 py-1 text-xs text-crm-muted-fg">
                {visible.length - MAX_FACET_ROWS} more, refine the search
              </p>
            )}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-2 w-full rounded-crm px-2 py-1 text-sm text-crm-soft hover:bg-crm-muted"
            >
              Clear selection
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const PRESETS = [
  { label: "Last 24 hours", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

interface DateRangeProps {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  disabled?: boolean;
}

/** Date range popover built on react-day-picker, with quick presets. */
export function DateRangeFilter({ from, to, onChange, disabled }: DateRangeProps) {
  const selected: DateRange | undefined = from
    ? { from: parseISO(from), to: to ? parseISO(to) : undefined }
    : undefined;
  const label = from
    ? `${format(parseISO(from), "MMM d")} – ${to ? format(parseISO(to), "MMM d") : "…"}`
    : "Date range";
  return (
    <Popover.Root>
      <Popover.Trigger className={triggerCls} data-active={!!from} disabled={disabled}>
        <CalendarDays className="size-3.5" aria-hidden />
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className={cn(panelCls, "flex gap-2 p-2")}>
          <div className="flex w-32 flex-col gap-0.5 border-r border-crm-border pr-2">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => onChange(ymd(subDays(new Date(), p.days)), ymd(new Date()))}
                className="rounded px-2 py-1.5 text-left text-sm text-crm-soft hover:bg-crm-muted hover:text-crm-fg"
              >
                {p.label}
              </button>
            ))}
            {from && (
              <button
                type="button"
                onClick={() => onChange(null, null)}
                className="mt-auto rounded px-2 py-1.5 text-left text-sm text-crm-danger hover:bg-crm-muted"
              >
                Clear
              </button>
            )}
          </div>
          <DayPicker
            mode="range"
            selected={selected}
            onSelect={(r) => onChange(r?.from ? ymd(r.from) : null, r?.to ? ymd(r.to) : null)}
            disabled={{ after: new Date() }}
            defaultMonth={selected?.from ?? new Date()}
            className="text-sm"
            style={
              {
                "--rdp-accent-color": "var(--color-crm-primary)",
                "--rdp-accent-background-color":
                  "color-mix(in srgb, var(--color-crm-primary) 25%, transparent)",
                "--rdp-day-height": "34px",
                "--rdp-day-width": "34px",
                "--rdp-day_button-height": "32px",
                "--rdp-day_button-width": "32px",
              } as React.CSSProperties
            }
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export interface AuditFilterBarProps {
  filters: AuditFilters;
  onChange: (next: AuditFilters) => void;
  facets: {
    actors: AuditFacetBucket[];
    actions: AuditFacetBucket[];
    resources: AuditFacetBucket[];
  };
  disabled?: boolean;
  /** Right-aligned slot (time toggle, columns, export). */
  children?: React.ReactNode;
}

export function AuditFilterBar({
  filters,
  onChange,
  facets,
  disabled,
  children,
}: AuditFilterBarProps) {
  // Local draft keeps typing responsive; the query only refetches after a short pause.
  const [q, setQ] = React.useState(filters.q);
  const [syncedQ, setSyncedQ] = React.useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setQ(filters.q);
  }
  const latest = React.useRef({ filters, onChange });
  React.useEffect(() => {
    latest.current = { filters, onChange };
  });
  React.useEffect(() => {
    if (q === latest.current.filters.q) return;
    const t = setTimeout(() => latest.current.onChange({ ...latest.current.filters, q }), 300);
    return () => clearTimeout(t);
  }, [q]);

  const labelOf = (list: AuditFacetBucket[], v: string) =>
    list.find((b) => b.value === v)?.label ?? v;
  const chips = [
    ...filters.actors.map((v) => ({
      key: `actor:${v}`,
      text: `Actor: ${labelOf(facets.actors, v)}`,
      clear: () => onChange({ ...filters, actors: filters.actors.filter((x) => x !== v) }),
    })),
    ...filters.actions.map((v) => ({
      key: `action:${v}`,
      text: `Action: ${v}`,
      clear: () => onChange({ ...filters, actions: filters.actions.filter((x) => x !== v) }),
    })),
    ...filters.resources.map((v) => ({
      key: `res:${v}`,
      text: `Resource: ${v}`,
      clear: () => onChange({ ...filters, resources: filters.resources.filter((x) => x !== v) }),
    })),
  ];
  const active = chips.length > 0 || !!filters.from || !!filters.q;

  return (
    <div className="flex flex-col gap-2 border-b border-crm-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2 top-2 size-4 text-crm-muted-fg"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            disabled={disabled}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events, IDs, IPs…"
            aria-label="Search audit events"
            className="h-8 w-full rounded-crm border border-crm-input bg-crm-bg pl-8 pr-2 text-sm text-crm-fg outline-none placeholder:text-crm-muted-fg focus:border-crm-ring"
          />
        </div>
        <FacetFilter
          label="Actor"
          buckets={facets.actors}
          selected={filters.actors}
          disabled={disabled}
          onChange={(actors) => onChange({ ...filters, actors })}
        />
        <FacetFilter
          label="Action"
          buckets={facets.actions}
          selected={filters.actions}
          disabled={disabled}
          onChange={(actions) => onChange({ ...filters, actions })}
        />
        <FacetFilter
          label="Resource"
          buckets={facets.resources}
          selected={filters.resources}
          disabled={disabled}
          onChange={(resources) => onChange({ ...filters, resources })}
        />
        <DateRangeFilter
          from={filters.from}
          to={filters.to}
          disabled={disabled}
          onChange={(from, to) => onChange({ ...filters, from, to })}
        />
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
      {active && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1 rounded bg-crm-muted py-0.5 pl-2 pr-1 text-xs text-crm-chip"
            >
              {c.text}
              <button
                type="button"
                aria-label={`Remove ${c.text}`}
                onClick={c.clear}
                className="rounded p-0.5 hover:bg-crm-raised hover:text-crm-fg"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              setQ("");
              onChange({ q: "", actors: [], actions: [], resources: [], from: null, to: null });
            }}
            className="px-1 text-xs text-crm-muted-fg underline-offset-2 hover:text-crm-fg hover:underline"
          >
            Reset all
          </button>
        </div>
      )}
    </div>
  );
}
