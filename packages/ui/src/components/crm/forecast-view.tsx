import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface ForecastRep {
  id: string;
  name: string;
  avatar?: string;
  team?: string;
  quota: number;
  /** Already booked in the period. */
  closedWon: number;
  /** Open deals the rep has committed. */
  commit: number;
  /** Upside deals, excluding commit. */
  bestCase: number;
  /** Remaining open pipeline, excluding commit and best case. */
  pipeline: number;
}

export type ForecastCategory = "commit" | "bestCase" | "pipeline";

export interface ForecastViewProps {
  reps: ForecastRep[];
  /** Period label, e.g. "Q3 FY26". */
  period: string;
  currency?: string;
  locale?: string;
  /** Manager overrides of each rep's call (rep id -> amount). Controlled. */
  overrides?: Record<string, number>;
  defaultOverrides?: Record<string, number>;
  onOverridesChange?: (overrides: Record<string, number>) => void;
  /** Which category counts as the rep's call when no override exists. */
  callBasis?: ForecastCategory;
  loading?: boolean;
  className?: string;
}

const basisLabel: Record<ForecastCategory, string> = {
  commit: "Commit",
  bestCase: "Best case",
  pipeline: "Pipeline",
};

/** Rep call = closed + every category up to and including the basis. */
export function repCall(rep: ForecastRep, basis: ForecastCategory = "commit") {
  let v = rep.closedWon + rep.commit;
  if (basis !== "commit") v += rep.bestCase;
  if (basis === "pipeline") v += rep.pipeline;
  return v;
}

function money(v: number, currency: string, locale: string, compact = true) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(v);
}

/**
 * Sales forecast roll-up: per-rep stacked bars (closed / commit / best case / pipeline)
 * against quota, editable manager overrides, and team totals with coverage and gap.
 */
export function ForecastView({
  reps,
  period,
  currency = "USD",
  locale = "en-US",
  overrides,
  defaultOverrides,
  onOverridesChange,
  callBasis,
  loading,
  className,
}: ForecastViewProps) {
  const [innerOverrides, setInnerOverrides] = React.useState<Record<string, number>>(
    defaultOverrides ?? {},
  );
  const ov = overrides ?? innerOverrides;
  const [basis, setBasis] = React.useState<ForecastCategory>(callBasis ?? "commit");
  const [sort, setSort] = React.useState<"gap" | "attainment" | "name">("gap");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");

  const setOv = (next: Record<string, number>) => {
    if (overrides === undefined) setInnerOverrides(next);
    onOverridesChange?.(next);
  };

  const rows = React.useMemo(() => {
    const r = reps.map((rep) => {
      const call = ov[rep.id] ?? repCall(rep, basis);
      return { rep, call, gap: rep.quota - call, att: rep.quota ? call / rep.quota : 0 };
    });
    return r.sort((a, b) =>
      sort === "name"
        ? a.rep.name.localeCompare(b.rep.name)
        : sort === "attainment"
          ? b.att - a.att
          : b.gap - a.gap,
    );
  }, [reps, ov, basis, sort]);

  const totals = React.useMemo(() => {
    const t = { quota: 0, closed: 0, commit: 0, best: 0, pipe: 0, call: 0 };
    for (const r of rows) {
      t.quota += r.rep.quota;
      t.closed += r.rep.closedWon;
      t.commit += r.rep.commit;
      t.best += r.rep.bestCase;
      t.pipe += r.rep.pipeline;
      t.call += r.call;
    }
    return t;
  }, [rows]);

  const scaleMax = Math.max(
    1,
    ...reps.map((r) => Math.max(r.quota, r.closedWon + r.commit + r.bestCase + r.pipeline)),
  );
  const remaining = Math.max(0, totals.quota - totals.closed);
  const coverage = remaining ? (totals.commit + totals.best + totals.pipe) / remaining : 0;
  const m = (v: number) => money(v, currency, locale);

  const commitEdit = (id: string) => {
    const n = Number(draft.replace(/[^0-9.]/g, ""));
    if (draft.trim() && Number.isFinite(n)) setOv({ ...ov, [id]: n });
    setEditing(null);
  };

  const segs: { key: string; cls: string; label: string }[] = [
    { key: "closed", cls: "bg-crm-success", label: "Closed won" },
    { key: "commit", cls: "bg-crm-primary", label: "Commit" },
    { key: "best", cls: "bg-crm-primary/45", label: "Best case" },
    { key: "pipe", cls: "bg-crm-faint/40", label: "Pipeline" },
  ];

  return (
    <section
      aria-label={`Forecast ${period}`}
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Forecast</p>
          <h2 className="text-lg font-semibold tracking-tight">{period}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Forecast call basis"
            size="sm"
            value={basis}
            onValueChange={(v) => setBasis(v as ForecastCategory)}
            options={(Object.keys(basisLabel) as ForecastCategory[]).map((k) => ({
              value: k,
              label: basisLabel[k],
            }))}
          />
          {Object.keys(ov).length ? (
            <button
              type="button"
              onClick={() => setOv({})}
              className="inline-flex h-7 items-center gap-1 rounded-crm border border-crm-border px-2 text-xs text-crm-soft hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
            >
              <RotateCcw className="size-3" aria-hidden /> Clear {Object.keys(ov).length} override
              {Object.keys(ov).length > 1 ? "s" : ""}
            </button>
          ) : null}
        </div>
      </header>

      <KpiGrid
        items={[
          { label: "Quota", value: m(totals.quota), caption: `${reps.length} reps` },
          {
            label: "Forecast call",
            value: m(totals.call),
            caption: `${totals.quota ? Math.round((totals.call / totals.quota) * 100) : 0}% of quota`,
          },
          {
            label: "Gap to quota",
            value: m(Math.max(0, totals.quota - totals.call)),
            caption: totals.call >= totals.quota ? "Covered" : "Still to find",
          },
          {
            label: "Pipeline coverage",
            value: `${coverage.toFixed(1)}x`,
            caption: coverage < 3 ? "Below 3x target" : "Healthy",
          },
        ]}
      />

      <div className="rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border px-4 py-2.5">
          <ul className="flex flex-wrap gap-3 text-xs text-crm-soft" aria-label="Legend">
            {segs.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-sm", s.cls)} aria-hidden />
                {s.label}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-px bg-crm-fg" aria-hidden /> Quota
            </li>
          </ul>
          <label className="flex items-center gap-1.5 text-xs text-crm-subtle">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-7 rounded-crm border border-crm-border bg-crm-input px-1.5 text-xs text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
            >
              <option value="gap">Largest gap</option>
              <option value="attainment">Attainment</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 p-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-crm bg-crm-muted" />
            ))}
          </div>
        ) : reps.length === 0 ? (
          <p className="p-8 text-center text-sm text-crm-subtle">
            No reps in this forecast. Assign quota to see a roll-up.
          </p>
        ) : (
          <ul className="divide-y divide-crm-border">
            {rows.map(({ rep, call, att, gap }) => {
              const parts = [rep.closedWon, rep.commit, rep.bestCase, rep.pipeline];
              const overridden = ov[rep.id] !== undefined;
              const risk = att < 0.8;
              return (
                <li
                  key={rep.id}
                  className="grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[180px_1fr_200px]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={rep.name} src={rep.avatar} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{rep.name}</p>
                      <p className="truncate text-xs text-crm-subtle">
                        {rep.team ?? "Quota"} · {m(rep.quota)}
                      </p>
                    </div>
                  </div>
                  <div
                    className="relative h-5 w-full rounded-sm bg-crm-muted"
                    role="img"
                    aria-label={`${rep.name}: closed ${m(rep.closedWon)}, commit ${m(rep.commit)}, best case ${m(rep.bestCase)}, pipeline ${m(rep.pipeline)}, quota ${m(rep.quota)}`}
                  >
                    <div className="absolute inset-y-0 left-0 flex w-full overflow-hidden rounded-sm">
                      {parts.map((p, i) => (
                        <span
                          key={i}
                          className={cn("h-full", segs[i]?.cls)}
                          style={{ width: `${(p / scaleMax) * 100}%` }}
                        />
                      ))}
                    </div>
                    <span
                      className="absolute -inset-y-1 w-px bg-crm-fg"
                      style={{ left: `${Math.min(100, (rep.quota / scaleMax) * 100)}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    {editing === rep.id ? (
                      <input
                        autoFocus
                        aria-label={`Override call for ${rep.name}`}
                        inputMode="decimal"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commitEdit(rep.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(rep.id);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="h-7 w-28 rounded-crm border border-crm-border bg-crm-input px-2 text-right text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        title="Click to override the call"
                        onClick={() => {
                          setDraft(String(Math.round(call)));
                          setEditing(rep.id);
                        }}
                        className={cn(
                          "h-7 rounded-crm px-2 text-sm font-semibold tabular-nums hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none",
                          overridden && "text-crm-primary",
                        )}
                      >
                        {m(call)}
                        {overridden ? <span className="sr-only"> (manager override)</span> : null}
                      </button>
                    )}
                    <span
                      className={cn(
                        "inline-flex w-20 items-center justify-end gap-1 text-xs tabular-nums",
                        risk ? "text-crm-danger" : gap <= 0 ? "text-crm-success" : "text-crm-soft",
                      )}
                    >
                      {risk ? <AlertTriangle className="size-3" aria-hidden /> : null}
                      {Math.round(att * 100)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <footer className="flex flex-wrap justify-between gap-2 border-t border-crm-border px-4 py-2.5 text-xs text-crm-subtle tabular-nums">
          <span>
            Closed {m(totals.closed)} · Commit {m(totals.commit)} · Best {m(totals.best)} · Pipe{" "}
            {m(totals.pipe)}
          </span>
          <span>
            Call basis: {basisLabel[basis]} · click a call to override (Enter to save, Esc to
            cancel)
          </span>
        </footer>
      </div>
    </section>
  );
}
