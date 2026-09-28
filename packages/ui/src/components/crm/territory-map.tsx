import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface Territory {
  /** Short code shown on the tile, e.g. "CA". */
  code: string;
  name: string;
  /** Tile-grid position (0-based column / row). */
  col: number;
  row: number;
  owner?: { name: string; avatar?: string };
  revenue: number;
  quota: number;
  pipeline: number;
  accounts: number;
  /** Win rate 0..1. */
  winRate?: number;
}

export type TerritoryMetric = "attainment" | "revenue" | "pipeline" | "accounts";

export interface TerritoryMapProps {
  territories: Territory[];
  metric?: TerritoryMetric;
  defaultMetric?: TerritoryMetric;
  onMetricChange?: (m: TerritoryMetric) => void;
  selected?: string | null;
  defaultSelected?: string | null;
  onSelectedChange?: (code: string | null) => void;
  currency?: string;
  className?: string;
}

const metricLabel: Record<TerritoryMetric, string> = {
  attainment: "Attainment",
  revenue: "Revenue",
  pipeline: "Pipeline",
  accounts: "Accounts",
};

/**
 * Territory performance as a tile-grid map (no geo library needed): each region is a tile
 * shaded by the chosen metric, with keyboard navigation, a ranked list and a detail panel.
 */
export function TerritoryMap({
  territories,
  metric,
  defaultMetric = "attainment",
  onMetricChange,
  selected,
  defaultSelected = null,
  onSelectedChange,
  currency = "USD",
  className,
}: TerritoryMapProps) {
  const [innerMetric, setInnerMetric] = React.useState(defaultMetric);
  const mt = metric ?? innerMetric;
  const [innerSel, setInnerSel] = React.useState<string | null>(defaultSelected);
  const sel = selected !== undefined ? selected : innerSel;
  const tileRefs = React.useRef(new Map<string, HTMLButtonElement>());

  const select = (code: string | null) => {
    if (selected === undefined) setInnerSel(code);
    onSelectedChange?.(code);
  };

  const value = (t: Territory) =>
    mt === "attainment"
      ? t.quota
        ? t.revenue / t.quota
        : 0
      : mt === "revenue"
        ? t.revenue
        : mt === "pipeline"
          ? t.pipeline
          : t.accounts;
  const money = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);
  const fmt = (t: Territory) =>
    mt === "attainment"
      ? `${Math.round(value(t) * 100)}%`
      : mt === "accounts"
        ? String(t.accounts)
        : money(value(t));

  const vals = territories.map(value);
  const max = Math.max(...vals, mt === "attainment" ? 1.2 : 1);
  const min = mt === "attainment" ? 0 : Math.min(...vals, 0);
  const cols = Math.max(1, ...territories.map((t) => t.col + 1));
  const rows = Math.max(1, ...territories.map((t) => t.row + 1));
  const byPos = new Map(territories.map((t) => [`${t.col}:${t.row}`, t]));

  const shade = (t: Territory) => {
    const v = value(t);
    if (mt === "attainment") {
      const tone =
        v >= 1 ? "--color-crm-success" : v >= 0.75 ? "--color-crm-warning" : "--color-crm-danger";
      return {
        background: `color-mix(in oklab, var(${tone}) ${Math.round(30 + Math.min(1, Math.abs(1 - v) + 0.2) * 50)}%, transparent)`,
      };
    }
    const r = max === min ? 1 : (v - min) / (max - min);
    return {
      background: `color-mix(in oklab, var(--color-crm-primary) ${Math.round(10 + r * 75)}%, transparent)`,
    };
  };

  const ranked = [...territories].sort((a, b) => value(b) - value(a));
  const current = territories.find((t) => t.code === sel);
  const total = territories.reduce(
    (a, t) => ({
      revenue: a.revenue + t.revenue,
      quota: a.quota + t.quota,
      pipeline: a.pipeline + t.pipeline,
    }),
    { revenue: 0, quota: 0, pipeline: 0 },
  );

  const onKey = (e: React.KeyboardEvent, t: Territory) => {
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = d[e.key];
    if (e.key === "Escape") select(null);
    if (!step) return;
    e.preventDefault();
    // Walk in the direction until the next occupied tile.
    for (let i = 1; i < Math.max(cols, rows); i++) {
      const n = byPos.get(`${t.col + step[0] * i}:${t.row + step[1] * i}`);
      if (n) {
        tileRefs.current.get(n.code)?.focus();
        return;
      }
    }
  };

  return (
    <section
      aria-label="Territory performance"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Territories</p>
          <h2 className="text-lg font-semibold tracking-tight">
            {money(total.revenue)} of {money(total.quota)} ·{" "}
            {total.quota ? Math.round((total.revenue / total.quota) * 100) : 0}%
          </h2>
        </div>
        <SegmentedControl
          label="Metric"
          size="sm"
          value={mt}
          onValueChange={(v) => {
            const n = v as TerritoryMetric;
            if (metric === undefined) setInnerMetric(n);
            onMetricChange?.(n);
          }}
          options={(Object.keys(metricLabel) as TerritoryMetric[]).map((k) => ({
            value: k,
            label: metricLabel[k],
          }))}
        />
      </header>

      {territories.length === 0 ? (
        <p className="rounded-crm border border-dashed border-crm-border p-10 text-center text-sm text-crm-subtle">
          No territories defined. Create territories to assign accounts and quota.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <div className="rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
            <div
              role="group"
              aria-label={`Territory map shaded by ${metricLabel[mt]}`}
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: rows * cols }, (_, i) => {
                const t = byPos.get(`${i % cols}:${Math.floor(i / cols)}`);
                if (!t) return <span key={i} aria-hidden className="aspect-square" />;
                const isSel = t.code === sel;
                return (
                  <button
                    key={t.code}
                    ref={(el) => {
                      if (el) tileRefs.current.set(t.code, el);
                      else tileRefs.current.delete(t.code);
                    }}
                    type="button"
                    aria-pressed={isSel}
                    aria-label={`${t.name}: ${metricLabel[mt]} ${fmt(t)}`}
                    title={`${t.name} · ${fmt(t)}`}
                    onClick={() => select(isSel ? null : t.code)}
                    onKeyDown={(e) => onKey(e, t)}
                    style={shade(t)}
                    className={cn(
                      "flex aspect-square min-w-0 flex-col items-center justify-center rounded-sm text-[10px] leading-tight outline-none focus-visible:ring-2 focus-visible:ring-crm-ring sm:text-xs",
                      isSel && "ring-2 ring-crm-fg",
                    )}
                  >
                    <span className="font-semibold">{t.code}</span>
                    <span className="hidden tabular-nums opacity-80 sm:block">{fmt(t)}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-crm-faint">
              Arrow keys move between regions · Enter selects · Esc clears
            </p>
          </div>

          <aside className="flex flex-col gap-3">
            {current ? (
              <div
                className="rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised"
                aria-live="polite"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{current.name}</h3>
                  {current.owner ? (
                    <span className="flex items-center gap-1.5 text-xs text-crm-soft">
                      <Avatar name={current.owner.name} src={current.owner.avatar} />
                      {current.owner.name}
                    </span>
                  ) : (
                    <span className="text-xs text-crm-danger">Unassigned</span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Revenue", money(current.revenue)],
                    ["Quota", money(current.quota)],
                    [
                      "Attainment",
                      `${current.quota ? Math.round((current.revenue / current.quota) * 100) : 0}%`,
                    ],
                    ["Pipeline", money(current.pipeline)],
                    [
                      "Coverage",
                      `${current.quota > current.revenue ? (current.pipeline / (current.quota - current.revenue)).toFixed(1) : "—"}x`,
                    ],
                    ["Accounts", String(current.accounts)],
                    [
                      "Win rate",
                      current.winRate !== undefined ? `${Math.round(current.winRate * 100)}%` : "—",
                    ],
                    [
                      "Rev / account",
                      money(current.accounts ? current.revenue / current.accounts : 0),
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-crm-subtle">{k}</dt>
                      <dd className="font-medium tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            <ol
              className="rounded-crm border border-crm-border bg-crm-card p-2 shadow-crm-raised"
              aria-label={`Ranked by ${metricLabel[mt]}`}
            >
              {ranked.map((t, i) => (
                <li key={t.code}>
                  <button
                    type="button"
                    onClick={() => select(t.code === sel ? null : t.code)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-crm-muted/50 focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none",
                      t.code === sel && "bg-crm-muted",
                    )}
                  >
                    <span className="w-4 text-crm-faint tabular-nums">{i + 1}</span>
                    <span className="size-2.5 rounded-sm" style={shade(t)} aria-hidden />
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="font-medium tabular-nums">{fmt(t)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </section>
  );
}
