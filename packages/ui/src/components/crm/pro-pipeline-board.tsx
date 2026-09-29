import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  type QueryClient as QueryClientType,
} from "@tanstack/react-query";
import { motion } from "motion/react";
import { ChevronRight, Hourglass, RotateCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { SearchInput } from "@/components/crm/search-input";
import { useControllableState } from "@/hooks/use-controllable-state";
import { usePipelineDnd } from "@/hooks/use-pipeline-dnd";
import {
  createPipelineStore,
  PipelineStoreContext,
  usePipelineStore,
} from "@/hooks/use-pipeline-store";
import {
  BoardContext,
  COLUMN_WIDTH,
  type BoardContextValue,
} from "@/components/crm/pro-pipeline-board/context";
import {
  ALL_LANE,
  cellKey,
  formatMoney,
  indexBoard,
  isRotting,
  rankBetween,
  type BoardIndex,
  type CellTarget,
  type DealMove,
  type PipelineDeal,
  type PipelineOwner,
  type PipelineStage,
} from "@/components/crm/pro-pipeline-board/model";
import { StageCell } from "@/components/crm/pro-pipeline-board/stage-cell";
import { StageHeader } from "@/components/crm/pro-pipeline-board/stage-header";
import {
  DragGhost,
  ErrorToast,
  LiveAnnouncer,
} from "@/components/crm/pro-pipeline-board/board-overlays";

export type {
  DealMove,
  PipelineDeal,
  PipelineOwner,
  PipelineStage,
} from "@/components/crm/pro-pipeline-board/model";

export interface ProPipelineBoardProps {
  stages: PipelineStage[];
  owners: PipelineOwner[];
  /** Controlled deals. Pair with onDealsChange. */
  deals?: PipelineDeal[];
  /** Uncontrolled initial deals. */
  defaultDeals?: PipelineDeal[];
  onDealsChange?: (deals: PipelineDeal[]) => void;
  /**
   * Persist a move. The board applies it optimistically; reject the promise to roll back.
   * Runs through a TanStack Query mutation (retries, pending state, devtools).
   */
  onMoveDeal?: (move: DealMove) => Promise<unknown>;
  onOpenDeal?: (deal: PipelineDeal) => void;
  /** Group cards into one swimlane per owner. Controlled or uncontrolled. */
  groupByOwner?: boolean;
  defaultGroupByOwner?: boolean;
  onGroupByOwnerChange?: (value: boolean) => void;
  /** Block drops that would push a stage over its WIP limit. Default: warn only. */
  enforceWipLimits?: boolean;
  currency?: string;
  locale?: string;
  /** Override "now" for rotting calculations (tests, demos). */
  now?: Date;
  /** Height of the board area in px (single lane) or per swimlane. */
  height?: number;
  laneHeight?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  readOnly?: boolean;
  /** Supply your app's QueryClient; otherwise the board creates a private one. */
  queryClient?: QueryClientType;
  /** Extra node rendered at the right of each card footer (e.g. a priority icon). */
  renderCardExtra?: (deal: PipelineDeal) => React.ReactNode;
  title?: string;
  className?: string;
}

/**
 * Deal pipeline / kanban with virtualised columns, weighted forecast, WIP limits,
 * rotting-deal flags, owner swimlanes, accessible pointer + keyboard DnD and optimistic
 * moves with rollback.
 */
export function ProPipelineBoard({ queryClient, ...props }: ProPipelineBoardProps) {
  const [fallback] = React.useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: 0 } } }),
  );
  return (
    <QueryClientProvider client={queryClient ?? fallback}>
      <PipelineBoardInner {...props} />
    </QueryClientProvider>
  );
}

function PipelineBoardInner({
  stages,
  owners,
  deals: dealsProp,
  defaultDeals,
  onDealsChange,
  onMoveDeal,
  onOpenDeal,
  groupByOwner,
  defaultGroupByOwner = false,
  onGroupByOwnerChange,
  enforceWipLimits = false,
  currency = "USD",
  locale = "en-US",
  now: nowProp,
  height = 560,
  laneHeight = 300,
  loading = false,
  error = null,
  onRetry,
  readOnly = false,
  renderCardExtra,
  title = "Pipeline",
  className,
}: Omit<ProPipelineBoardProps, "queryClient">) {
  const [store] = React.useState(createPipelineStore);
  const [deals, setDeals] = useControllableState<PipelineDeal[]>({
    value: dealsProp,
    defaultValue: defaultDeals ?? [],
    onChange: onDealsChange,
  });
  const [byOwner, setByOwner] = useControllableState<boolean>({
    value: groupByOwner,
    defaultValue: defaultGroupByOwner,
    onChange: onGroupByOwnerChange,
  });
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [rottingOnly, setRottingOnly] = React.useState(false);
  const [mountedAt] = React.useState(() => Date.now());
  const now = nowProp ? nowProp.getTime() : mountedAt;
  const instructionsId = React.useId();
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const focusHandled = React.useRef(0);

  const stageById = React.useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const ownerById = React.useMemo(() => new Map(owners.map((o) => [o.id, o])), [owners]);
  const dealById = React.useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const laneIds = React.useMemo(
    () => (byOwner ? owners.map((o) => o.id) : [ALL_LANE]),
    [byOwner, owners],
  );

  const visible = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q && !rottingOnly) return deals;
    return deals.filter(
      (d) =>
        (!q || d.title.toLowerCase().includes(q) || d.company.toLowerCase().includes(q)) &&
        (!rottingOnly || isRotting(d, stageById.get(d.stageId), now)),
    );
  }, [deals, deferredQuery, rottingOnly, stageById, now]);

  const index = React.useMemo(
    () => indexBoard(visible, stages, laneIds, byOwner, now),
    [visible, stages, laneIds, byOwner, now],
  );
  const indexRef = React.useRef<BoardIndex>(index);
  const dealsRef = React.useRef(dealById);
  React.useLayoutEffect(() => {
    indexRef.current = index;
    dealsRef.current = dealById;
  });

  // Give the board a tab stop once data arrives.
  React.useEffect(() => {
    const s = store.getState();
    if (s.focusedId && index.position.has(s.focusedId)) return;
    for (const stage of stages)
      for (const lane of laneIds) {
        const first = index.cells.get(cellKey(stage.id, lane))?.[0];
        if (first) return s.focus(first.id, false);
      }
    s.focus(null, false);
  }, [index, stages, laneIds, store]);

  const mutation = useMutation({
    mutationFn: async (move: DealMove) => {
      if (onMoveDeal) await onMoveDeal(move);
      return move;
    },
    onMutate: (move) => store.getState().setPending(move.dealId, true),
    onError: (err, move) => {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === move.dealId && d.stageId === move.next.stageId && d.rank === move.next.rank
            ? move.previous
            : d,
        ),
      );
      const from = stageById.get(move.fromStageId)?.title ?? move.fromStageId;
      const reason = err instanceof Error && err.message ? ` ${err.message}` : "";
      const text = `Couldn't move "${move.previous.title}". Restored to ${from}.${reason}`;
      store.getState().fail(text);
      store.getState().announce(text);
    },
    onSettled: (_d, _e, move) => store.getState().setPending(move.dealId, false),
  });
  const mutate = mutation.mutate;

  const commit = React.useCallback(
    (dealId: string, target: CellTarget) => {
      const s = store.getState();
      const deal = dealsRef.current.get(dealId);
      const idx = indexRef.current;
      if (!deal) return;
      const stage = stageById.get(target.stageId);
      const list = (idx.cells.get(cellKey(target.stageId, target.laneId)) ?? []).filter(
        (d) => d.id !== dealId,
      );
      const toOwner = byOwner ? target.laneId : deal.ownerId;
      const origin = idx.position.get(dealId);
      const sameCell = origin?.key === cellKey(target.stageId, target.laneId);
      if (sameCell && origin?.index === target.index) {
        s.announce(`${deal.title} dropped in its original position.`);
        s.focus(dealId);
        return;
      }
      const stageChanged = deal.stageId !== target.stageId;
      if (stageChanged && stage?.wipLimit != null) {
        const count = idx.stageStats.get(stage.id)?.count ?? 0;
        if (count >= stage.wipLimit) {
          if (enforceWipLimits) {
            const text = `${stage.title} is at its WIP limit of ${stage.wipLimit}. ${deal.title} was not moved.`;
            s.fail(text);
            s.announce(text);
            s.focus(dealId);
            return;
          }
        }
      }
      const rank = rankBetween(list[target.index - 1]?.rank, list[target.index]?.rank);
      const next: PipelineDeal = {
        ...deal,
        stageId: target.stageId,
        ownerId: toOwner,
        rank,
        stageEnteredAt: stageChanged ? new Date(now).toISOString() : deal.stageEnteredAt,
      };
      setDeals((prev) => prev.map((d) => (d.id === dealId ? next : d)));
      const owner = byOwner ? ownerById.get(toOwner)?.name : undefined;
      const overLimit =
        stageChanged &&
        stage?.wipLimit != null &&
        (idx.stageStats.get(stage.id)?.count ?? 0) + 1 > stage.wipLimit;
      s.announce(
        `Dropped ${deal.title} in ${stage?.title ?? target.stageId}${owner ? `, ${owner}` : ""}, position ${
          target.index + 1
        } of ${list.length + 1}.${overLimit ? ` ${stage?.title} is over its WIP limit.` : ""}`,
      );
      s.focus(dealId);
      mutate({
        dealId,
        fromStageId: deal.stageId,
        toStageId: target.stageId,
        fromOwnerId: deal.ownerId,
        toOwnerId: toOwner,
        rank,
        previous: deal,
        next,
      });
    },
    [store, stageById, ownerById, byOwner, enforceWipLimits, now, setDeals, mutate],
  );

  const findDeal = React.useCallback((id: string) => dealsRef.current.get(id), []);
  const laneName = React.useCallback(
    (laneId: string) => (laneId === ALL_LANE ? undefined : ownerById.get(laneId)?.name),
    [ownerById],
  );
  const { onCardPointerDown, onKeyDown } = usePipelineDnd({
    store,
    indexRef,
    stages,
    laneIds,
    laneName,
    readOnly,
    scrollerRef,
    commit,
    onOpenDeal,
    findDeal,
  });

  const ctx = React.useMemo<BoardContextValue>(
    () => ({
      stages,
      stageById,
      ownerById,
      index,
      byOwner,
      currency,
      locale,
      now,
      readOnly,
      instructionsId,
      focusHandled,
      onCardPointerDown,
      renderCardExtra,
    }),
    [
      stages,
      stageById,
      ownerById,
      index,
      byOwner,
      currency,
      locale,
      now,
      readOnly,
      instructionsId,
      onCardPointerDown,
      renderCardExtra,
    ],
  );

  const maxWeighted = React.useMemo(() => {
    let m = 0;
    for (const s of index.stageStats.values()) m = Math.max(m, s.weighted);
    return m;
  }, [index]);
  const money = (v: number) => formatMoney(v, currency, locale, true);
  const gridWidth = stages.length * COLUMN_WIDTH + (stages.length - 1) * 12;
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${stages.length}, ${COLUMN_WIDTH}px)`,
    gap: 12,
    width: gridWidth,
  };

  return (
    <PipelineStoreContext.Provider value={store}>
      <BoardContext.Provider value={ctx}>
        <section
          aria-label={title}
          className={cn(
            "relative flex min-w-0 flex-col gap-3 rounded-crm border border-crm-border bg-crm-bg p-3 font-crm text-crm-fg",
            className,
          )}
        >
          <header className="flex flex-wrap items-center gap-2">
            <div className="mr-auto flex min-w-0 flex-col">
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="text-xs text-crm-muted-fg tabular-nums">
                {index.totals.count.toLocaleString(locale)} deals ·{" "}
                <span className="text-crm-fg">{money(index.totals.total)}</span> pipeline ·{" "}
                <span className="text-crm-trend">{money(index.totals.weighted)}</span> weighted
                forecast
                {index.totals.rotting > 0 && (
                  <>
                    {" "}
                    · <span className="text-crm-warning">{index.totals.rotting} rotting</span>
                  </>
                )}
              </p>
            </div>
            <SearchInput
              size="sm"
              value={query}
              onValueChange={setQuery}
              placeholder="Search deals or companies"
              className="w-56"
              aria-label="Filter deals"
            />
            <Button
              size="sm"
              variant={rottingOnly ? "muted" : "ghost"}
              aria-pressed={rottingOnly}
              onClick={() => setRottingOnly((v) => !v)}
            >
              <Hourglass className="size-3.5" aria-hidden /> Rotting only
            </Button>
            <Button
              size="sm"
              variant={byOwner ? "muted" : "ghost"}
              aria-pressed={byOwner}
              onClick={() => setByOwner((v) => !v)}
            >
              <Users className="size-3.5" aria-hidden /> Swimlanes by owner
            </Button>
          </header>

          <p id={instructionsId} className="sr-only">
            Press Space to pick up a deal. While dragging, use Left and Right arrows to change
            stage, Up and Down to change position, Shift with Up or Down to change owner lane, Space
            to drop and Escape to cancel. Press Enter to open a deal.
          </p>

          {error ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-crm border border-crm-danger/40 bg-crm-danger/10 px-3 py-2 text-xs"
            >
              <span>{error}</span>
              {onRetry && (
                <Button size="sm" onClick={onRetry}>
                  <RotateCw className="size-3.5" aria-hidden /> Retry
                </Button>
              )}
            </div>
          ) : null}

          <div
            ref={scrollerRef}
            className="overflow-auto [scrollbar-width:thin]"
            onKeyDown={onKeyDown}
            aria-busy={loading || undefined}
            style={{ maxHeight: byOwner ? height + 120 : undefined }}
          >
            <div style={gridStyle} className="sticky top-0 z-10 bg-crm-bg pb-2">
              {stages.map((s) => (
                <StageHeader key={s.id} stage={s} maxWeighted={maxWeighted} />
              ))}
            </div>

            {loading ? (
              <div style={gridStyle} aria-hidden>
                {stages.map((s) => (
                  <div key={s.id} className="flex flex-col gap-2" style={{ height }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <div
                        key={i}
                        className="h-[92px] animate-pulse rounded-crm bg-crm-raised"
                        style={{ opacity: 1 - i * 0.16 }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : byOwner ? (
              <div className="flex flex-col gap-3" style={{ width: gridWidth }}>
                {owners.map((o) => (
                  <OwnerLane
                    key={o.id}
                    owner={o}
                    stages={stages}
                    height={laneHeight}
                    gridStyle={gridStyle}
                    money={money}
                  />
                ))}
              </div>
            ) : (
              <div style={gridStyle}>
                {stages.map((s) => (
                  <StageCell key={s.id} stageId={s.id} laneId={ALL_LANE} height={height} />
                ))}
              </div>
            )}
            {!loading && deals.length > 0 && index.totals.count === 0 && (
              <p className="py-6 text-center text-xs text-crm-muted-fg">
                No deals match the current filters.
              </p>
            )}
          </div>

          <LiveAnnouncer />
          <DragGhost findDeal={findDeal} />
          <ErrorToast />
        </section>
      </BoardContext.Provider>
    </PipelineStoreContext.Provider>
  );
}

const OwnerLane = React.memo(function OwnerLane({
  owner,
  stages,
  height,
  gridStyle,
  money,
}: {
  owner: PipelineOwner;
  stages: readonly PipelineStage[];
  height: number;
  gridStyle: React.CSSProperties;
  money: (v: number) => string;
}) {
  const collapsed = usePipelineStore((s) => s.collapsedLanes[owner.id] === true);
  const toggle = usePipelineStore((s) => s.toggleLane);
  const stats = React.useContext(BoardContext)?.index.laneStats.get(owner.id);
  const regionId = React.useId();
  return (
    <div role="group" aria-label={`${owner.name} lane`} className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={regionId}
        onClick={() => toggle(owner.id)}
        className="sticky left-0 flex w-fit items-center gap-2 rounded-crm px-1.5 py-1 text-left text-xs hover:bg-crm-raised focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
      >
        <motion.span animate={{ rotate: collapsed ? 0 : 90 }} className="inline-flex">
          <ChevronRight className="size-3.5 text-crm-muted-fg" aria-hidden />
        </motion.span>
        <Avatar name={owner.name} src={owner.avatarUrl} size="sm" />
        <span className="font-medium text-crm-fg">{owner.name}</span>
        <span className="text-crm-muted-fg tabular-nums">
          {stats?.count ?? 0} deals · {money(stats?.total ?? 0)} ·{" "}
          <span className="text-crm-trend">{money(stats?.weighted ?? 0)}</span> weighted
        </span>
      </button>
      {!collapsed && (
        <div id={regionId} style={gridStyle}>
          {stages.map((s) => (
            <StageCell
              key={s.id}
              stageId={s.id}
              laneId={owner.id}
              laneName={owner.name}
              height={height}
            />
          ))}
        </div>
      )}
    </div>
  );
});
