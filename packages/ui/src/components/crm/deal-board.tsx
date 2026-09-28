import * as React from "react";
import { AlertTriangle, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KanbanColumn } from "@/components/crm/kanban-column";
import type { Deal } from "@/components/crm/deal-card";
import { SearchInput } from "@/components/crm/search-input";
import { EmptyState, Skeleton } from "@/components/crm/feedback";

export interface BoardStage {
  id: string;
  label: string;
  /** Default win probability (0–100) used for the weighted forecast. */
  probability: number;
  color?: string;
  /** Soft WIP limit passed to the column. */
  limit?: number;
}

export interface BoardDeal extends Deal {
  stageId: string;
}

export interface DealBoardProps {
  stages: BoardStage[];
  /** Controlled deals. */
  deals?: BoardDeal[];
  /** Uncontrolled initial deals. */
  defaultDeals?: BoardDeal[];
  /** Fires after a deal moves (drag & drop or keyboard). */
  onDealMove?: (dealId: string, toStageId: string, next: BoardDeal[]) => void;
  onOpenDeal?: (deal: BoardDeal) => void;
  onAddDeal?: (stageId: string) => void;
  /** ISO currency code for totals. */
  currency?: string;
  loading?: boolean;
  error?: string;
  className?: string;
}

function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: n >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: n >= 1_000_000 ? 1 : 0,
  }).format(n);
}

/**
 * Full pipeline board: search + owner filter, per-stage totals and weighted forecast,
 * drag & drop between stages, and a keyboard "move to stage" path for the selected deal.
 */
export function DealBoard({
  stages,
  deals,
  defaultDeals = [],
  onDealMove,
  onOpenDeal,
  onAddDeal,
  currency = "USD",
  loading,
  error,
  className,
}: DealBoardProps) {
  const [inner, setInner] = React.useState(defaultDeals);
  const all = deals ?? inner;
  const [query, setQuery] = React.useState("");
  const [owner, setOwner] = React.useState("all");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const uid = React.useId();
  const dealWeight = (d: BoardDeal) =>
    (d.amount * (d.probability ?? stageProb[d.stageId] ?? 0)) / 100;

  const owners = React.useMemo(
    () => Array.from(new Set(all.map((d) => d.owner?.name).filter(Boolean) as string[])).sort(),
    [all],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (d) =>
        (owner === "all" || d.owner?.name === owner) &&
        (!q || d.title.toLowerCase().includes(q) || d.company.toLowerCase().includes(q)),
    );
  }, [all, owner, query]);

  const stageProb = React.useMemo(
    () => Object.fromEntries(stages.map((s) => [s.id, s.probability])),
    [stages],
  );
  const total = visible.reduce((s, d) => s + d.amount, 0);
  const weighted = visible.reduce((s, d) => s + dealWeight(d), 0);

  const move = (dealId: string, toStageId: string) => {
    const deal = all.find((d) => d.id === dealId);
    if (!deal || deal.stageId === toStageId) return;
    const stage = stages.find((s) => s.id === toStageId);
    const next = all.map((d) =>
      d.id === dealId ? { ...d, stageId: toStageId, probability: stage?.probability } : d,
    );
    if (!deals) setInner(next);
    onDealMove?.(dealId, toStageId, next);
    setAnnounce(`${deal.title} moved to ${stage?.label ?? toStageId}`);
  };

  const active = all.find((d) => d.id === activeId) ?? null;

  if (error) {
    return (
      <EmptyState
        tone="error"
        icon={<AlertTriangle />}
        title="Pipeline failed to load"
        description={error}
        className={className}
      />
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-3 font-crm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search deals or companies"
          size="sm"
          className="w-full sm:w-64"
          aria-label="Search deals"
        />
        <label className="sr-only" htmlFor={`${uid}-owner`}>
          Owner
        </label>
        <select
          id={`${uid}-owner`}
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="h-7 rounded-crm border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <option value="all">All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <dl className="ml-auto flex gap-4 pr-2 text-xs">
          <div>
            <dt className="crm-caption text-crm-subtle">Pipeline</dt>
            <dd className="text-crm-fg tabular-nums">{money(total, currency)}</dd>
          </div>
          <div>
            <dt className="crm-caption text-crm-subtle">Weighted</dt>
            <dd className="text-crm-fg tabular-nums">{money(weighted, currency)}</dd>
          </div>
          <div>
            <dt className="crm-caption text-crm-subtle">Deals</dt>
            <dd className="text-crm-fg tabular-nums">{visible.length}</dd>
          </div>
        </dl>
      </div>

      {active ? (
        <div
          role="region"
          aria-label="Selected deal"
          className="flex flex-wrap items-center gap-2 rounded-crm border border-crm-border bg-crm-raised px-3 py-2 text-xs text-crm-soft shadow-crm-raised"
        >
          <span className="font-medium text-crm-fg">{active.title}</span>
          <span>· {active.company}</span>
          <label htmlFor={`${uid}-move`} className="ml-auto">
            Move to
          </label>
          <select
            id={`${uid}-move`}
            value={active.stageId}
            onChange={(e) => move(active.id, e.target.value)}
            className="h-7 rounded-crm border border-crm-border bg-crm-card px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => setActiveId(null)}
            className="grid size-6 cursor-pointer place-items-center rounded-full hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex gap-3 overflow-hidden" aria-busy="true">
          {stages.map((s) => (
            <Skeleton key={s.id} className="h-72 w-[280px] shrink-0 rounded-xl" />
          ))}
        </div>
      ) : !all.length ? (
        <EmptyState
          icon={<Trophy />}
          title="No deals in this pipeline"
          description="Create your first deal to start forecasting."
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pr-1 pb-2">
          {stages.map((s) => {
            const col = visible.filter((d) => d.stageId === s.id);
            const colTotal = col.reduce((t, d) => t + d.amount, 0);
            const colWeighted = col.reduce((t, d) => t + dealWeight(d), 0);
            return (
              <KanbanColumn
                key={s.id}
                className="w-auto min-w-[220px] flex-1 basis-0"
                title={s.label}
                color={s.color}
                limit={s.limit}
                deals={col}
                subtitle={`${money(colTotal, currency)} · ${money(colWeighted, currency)} weighted (${s.probability}%)`}
                onAdd={onAddDeal ? () => onAddDeal(s.id) : undefined}
                onDropDeal={(id) => move(id, s.id)}
                onOpenDeal={(d) => {
                  setActiveId(d.id);
                  const full = all.find((x) => x.id === d.id);
                  if (full) onOpenDeal?.(full);
                }}
              />
            );
          })}
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
