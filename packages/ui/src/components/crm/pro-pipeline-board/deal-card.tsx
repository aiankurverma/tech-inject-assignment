import * as React from "react";
import { CalendarClock, Hourglass, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { usePipelineStore } from "@/hooks/use-pipeline-store";
import { useBoard } from "@/components/crm/pro-pipeline-board/context";
import {
  daysInStage,
  dealProbability,
  formatMoney,
  isRotting,
  type PipelineDeal,
} from "@/components/crm/pro-pipeline-board/model";

export interface DealCardProps {
  deal: PipelineDeal;
  posinset: number;
  setsize: number;
}

const dateFmt = new Map<string, Intl.DateTimeFormat>();
function shortDate(iso: string, locale: string) {
  let f = dateFmt.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    dateFmt.set(locale, f);
  }
  return f.format(new Date(iso));
}

/** One deal. Memoised; subscribes only to its own drag/focus/pending slice of the store. */
export const DealCard = React.memo(function DealCard({ deal, posinset, setsize }: DealCardProps) {
  const board = useBoard();
  const stage = board.stageById.get(deal.stageId);
  const owner = board.ownerById.get(deal.ownerId);
  const isActive = usePipelineStore((s) => s.active?.dealId === deal.id);
  const isFocused = usePipelineStore((s) => s.focusedId === deal.id);
  const nonce = usePipelineStore((s) => (s.focusedId === deal.id ? s.focusNonce : -1));
  const pending = usePipelineStore((s) => s.pending[deal.id] === true);
  const focus = usePipelineStore((s) => s.focus);
  const ref = React.useRef<HTMLDivElement>(null);
  const { focusHandled } = board;

  React.useEffect(() => {
    if (nonce > 0 && nonce !== focusHandled.current) {
      focusHandled.current = nonce;
      ref.current?.focus({ preventScroll: true });
    }
  }, [nonce, focusHandled]);

  const rotting = isRotting(deal, stage, board.now);
  const days = daysInStage(deal, board.now);
  const prob = dealProbability(deal, stage);
  const amount = formatMoney(deal.amount, board.currency, board.locale);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={isFocused ? 0 : -1}
      data-deal-id={deal.id}
      aria-roledescription={board.readOnly ? "deal" : "draggable deal"}
      aria-describedby={board.readOnly ? undefined : board.instructionsId}
      aria-posinset={posinset}
      aria-setsize={setsize}
      aria-label={`${deal.title}, ${deal.company}, ${amount}, ${Math.round(prob * 100)}% probability${
        rotting ? `, rotting ${days} days in stage` : ""
      }${pending ? ", saving" : ""}`}
      onFocus={() => {
        if (!isFocused) focus(deal.id, false);
      }}
      onPointerDown={(e) => board.onCardPointerDown(e, deal)}
      className={cn(
        "group flex h-[92px] cursor-grab touch-none flex-col justify-between rounded-crm border bg-crm-raised p-2.5 font-crm text-crm-fg shadow-crm-raised outline-none select-none",
        "transition-[opacity,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-crm-ring",
        rotting ? "border-crm-warning/40" : "border-crm-border hover:border-crm-input",
        isActive && "opacity-40",
        board.readOnly && "cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-[13px] leading-4 font-medium">{deal.title}</span>
        <span className="shrink-0 text-[13px] leading-4 font-semibold tabular-nums">{amount}</span>
      </div>
      <div className="flex items-center gap-1.5 truncate text-xs text-crm-muted-fg">
        <span className="truncate">{deal.company}</span>
        {deal.closeDate && (
          <span className="inline-flex shrink-0 items-center gap-0.5">
            <CalendarClock className="size-3" aria-hidden />
            {shortDate(deal.closeDate, board.locale)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-crm-soft">
        <span className="flex min-w-0 items-center gap-1.5">
          {!board.byOwner && owner && <Avatar name={owner.name} src={owner.avatarUrl} size="xs" />}
          {!board.byOwner && owner && <span className="truncate">{owner.name}</span>}
          {rotting && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-crm-warning/15 px-1.5 py-px text-crm-warning">
              <Hourglass className="size-3" aria-hidden />
              {days}d
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 tabular-nums">
          {pending && <Loader2 className="size-3 animate-spin text-crm-muted-fg" aria-hidden />}
          {board.renderCardExtra?.(deal)}
          {Math.round(prob * 100)}%
        </span>
      </div>
    </div>
  );
});
