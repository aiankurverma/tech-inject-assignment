import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, X } from "lucide-react";
import { usePipelineStore } from "@/hooks/use-pipeline-store";
import { useBoard } from "@/components/crm/pro-pipeline-board/context";
import { formatMoney, type PipelineDeal } from "@/components/crm/pro-pipeline-board/model";

/** Polite live region; re-keyed per message so identical texts are still announced. */
export function LiveAnnouncer() {
  const a = usePipelineStore((s) => s.announcement);
  return (
    <div className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
      <span key={a.id}>{a.text}</span>
    </div>
  );
}

/** Card that follows the pointer while dragging (position: fixed, so it escapes scroll containers). */
export function DragGhost({ findDeal }: { findDeal: (id: string) => PipelineDeal | undefined }) {
  const board = useBoard();
  const active = usePipelineStore((s) => (s.active?.mode === "pointer" ? s.active.dealId : null));
  const pointer = usePipelineStore((s) => s.pointer);
  const deal = active ? findDeal(active) : undefined;
  return (
    <AnimatePresence>
      {deal && pointer && (
        <motion.div
          key={deal.id}
          aria-hidden
          initial={{ scale: 1, rotate: 0, opacity: 0.6 }}
          animate={{ scale: 1.03, rotate: -2, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="pointer-events-none fixed z-[1000] w-[264px] rounded-crm border border-crm-primary/60 bg-crm-raised p-2.5 font-crm text-crm-fg shadow-crm-overlay"
          style={{ left: pointer.x - 132, top: pointer.y - 24 }}
        >
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="truncate font-medium">{deal.title}</span>
            <span className="font-semibold tabular-nums">
              {formatMoney(deal.amount, board.currency, board.locale)}
            </span>
          </div>
          <div className="truncate text-xs text-crm-muted-fg">{deal.company}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Rollback / WIP rejection toast. */
export function ErrorToast() {
  const error = usePipelineStore((s) => s.error);
  const fail = usePipelineStore((s) => s.fail);
  React.useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => fail(null), 5000);
    return () => window.clearTimeout(t);
  }, [error, fail]);
  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-20">
      <AnimatePresence>
        {error && (
          <motion.div
            key={error.id}
            role="alert"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-crm border border-crm-danger/40 bg-crm-popover px-3 py-2 font-crm text-xs text-crm-fg shadow-crm-overlay"
          >
            <AlertCircle className="mt-px size-4 shrink-0 text-crm-danger" aria-hidden />
            <span className="flex-1">{error.text}</span>
            <button
              type="button"
              onClick={() => fail(null)}
              className="rounded p-0.5 text-crm-muted-fg hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
