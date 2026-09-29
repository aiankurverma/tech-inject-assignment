import * as React from "react";
import { AlertTriangle, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoard } from "@/components/crm/pro-pipeline-board/context";
import { formatMoney, type PipelineStage } from "@/components/crm/pro-pipeline-board/model";

/** Stage title with count, total, weighted forecast, WIP meter and rotting count. */
export const StageHeader = React.memo(function StageHeader({
  stage,
  maxWeighted,
}: {
  stage: PipelineStage;
  maxWeighted: number;
}) {
  const board = useBoard();
  const stats = board.index.stageStats.get(stage.id) ?? {
    count: 0,
    total: 0,
    weighted: 0,
    rotting: 0,
  };
  const overWip = stage.wipLimit != null && stats.count > stage.wipLimit;
  const atWip = stage.wipLimit != null && stats.count === stage.wipLimit;
  const share = maxWeighted > 0 ? stats.weighted / maxWeighted : 0;
  const money = (v: number) => formatMoney(v, board.currency, board.locale, true);

  return (
    <div className="flex flex-col gap-1.5 rounded-crm border border-crm-border bg-crm-raised px-3 py-2.5 font-crm shadow-crm-raised">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-[13px] font-semibold text-crm-fg">{stage.title}</h3>
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[11px] tabular-nums",
            overWip
              ? "bg-crm-danger/15 text-crm-danger"
              : atWip
                ? "bg-crm-warning/15 text-crm-warning"
                : "bg-crm-muted text-crm-chip",
          )}
          title={stage.wipLimit != null ? `WIP limit ${stage.wipLimit}` : undefined}
        >
          {overWip && <AlertTriangle className="size-3" aria-hidden />}
          {stats.count}
          {stage.wipLimit != null && <span className="opacity-70">/ {stage.wipLimit}</span>}
          <span className="sr-only">
            deals{stage.wipLimit != null ? `, WIP limit ${stage.wipLimit}` : ""}
            {overWip ? ", over limit" : ""}
          </span>
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-2 text-[11px] text-crm-muted-fg">
        <div>
          <dt className="sr-only">Total</dt>
          <dd className="text-sm font-semibold text-crm-fg tabular-nums">{money(stats.total)}</dd>
        </div>
        <div className="text-right">
          <dt className="inline">Weighted </dt>
          <dd className="inline text-crm-soft tabular-nums">{money(stats.weighted)}</dd>
        </div>
      </dl>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-crm-track" aria-hidden>
          <div
            className="h-full rounded-full bg-crm-primary transition-[width] duration-300"
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>
        <span className="text-[11px] text-crm-muted-fg tabular-nums">
          {Math.round(stage.probability * 100)}%
        </span>
        {stats.rotting > 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-[11px] text-crm-warning tabular-nums"
            title={`${stats.rotting} deals past ${stage.rotDays} days`}
          >
            <Hourglass className="size-3" aria-hidden />
            {stats.rotting}
            <span className="sr-only">rotting deals</span>
          </span>
        )}
      </div>
    </div>
  );
});
