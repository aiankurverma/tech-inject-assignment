import * as React from "react";
import { format as fmtDate, formatDistanceToNowStrict, parseISO } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  CirclePause,
  CirclePlay,
  Gift,
  Receipt,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  InvoicePreview,
  TimelineEvent,
} from "@/components/crm/pro-subscription-manager/billing";

export function InvoicePanel({
  invoice,
  money,
}: {
  invoice: InvoicePreview | null;
  money: (m: number) => string;
}) {
  return (
    <section
      aria-labelledby="sub-inv-title"
      className="rounded-crm border border-crm-border bg-crm-card p-4"
    >
      <h3
        id="sub-inv-title"
        className="flex items-center gap-1.5 text-xs font-medium text-crm-muted-fg"
      >
        <Receipt className="size-3.5" aria-hidden /> Upcoming invoice
      </h3>
      {invoice ? (
        <>
          <p className="mt-2 text-lg font-semibold tabular-nums text-crm-fg">
            {money(invoice.total)}
          </p>
          <p className="text-xs text-crm-subtle">
            {fmtDate(parseISO(invoice.date), "d MMM yyyy")} ·{" "}
            {formatDistanceToNowStrict(parseISO(invoice.date), { addSuffix: true })}
          </p>
          <table className="mt-3 w-full text-xs">
            <caption className="sr-only">Invoice lines</caption>
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.description} className="border-b border-crm-border/60 last:border-0">
                  <td className="py-1.5 text-crm-muted-fg">{l.description}</td>
                  <td
                    className={cn(
                      "py-1.5 text-right tabular-nums",
                      l.amount < 0 ? "text-crm-success" : "text-crm-fg",
                    )}
                  >
                    {money(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="mt-2 text-xs text-crm-subtle">No further invoices are scheduled.</p>
      )}
    </section>
  );
}

const ICONS: Record<TimelineEvent["kind"], React.ComponentType<{ className?: string }>> = {
  created: Sparkles,
  upgrade: ArrowUpRight,
  downgrade: ArrowDownRight,
  seats: Users,
  paused: CirclePause,
  resumed: CirclePlay,
  cancel: XCircle,
  offer: Gift,
  invoice: Receipt,
};

/** Newest-first billing timeline; long histories are capped with a "show all" toggle. */
export function BillingTimeline({
  events,
  limit = 8,
}: {
  events: readonly TimelineEvent[];
  limit?: number;
}) {
  const [all, setAll] = React.useState(false);
  const sorted = React.useMemo(
    () => [...events].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)),
    [events],
  );
  const shown = all ? sorted : sorted.slice(0, limit);
  return (
    <section
      aria-labelledby="sub-tl-title"
      className="rounded-crm border border-crm-border bg-crm-card p-4"
    >
      <h3 id="sub-tl-title" className="text-xs font-medium text-crm-muted-fg">
        Timeline
      </h3>
      {sorted.length === 0 ? (
        <p className="mt-2 text-xs text-crm-subtle">No billing activity yet.</p>
      ) : (
        <ol className="mt-3 flex flex-col">
          {shown.map((e, i) => {
            const Icon = ICONS[e.kind];
            return (
              <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
                {i < shown.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute top-6 left-3 h-[calc(100%-20px)] w-px bg-crm-border"
                  />
                ) : null}
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-crm-muted text-crm-muted-fg">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 text-xs">
                  <p className="font-medium text-crm-fg">{e.title}</p>
                  {e.detail ? <p className="text-crm-subtle">{e.detail}</p> : null}
                  <time dateTime={e.at} className="text-[11px] text-crm-subtle">
                    {fmtDate(parseISO(e.at), "d MMM yyyy, HH:mm")}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {sorted.length > limit ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((v) => !v)}
          className="mt-2 text-xs font-medium text-crm-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          {all ? "Show fewer" : `Show all ${sorted.length}`}
        </button>
      ) : null}
    </section>
  );
}
