import * as React from "react";
import { CalendarClock, DollarSign, Handshake, Home, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { Progress } from "@/components/crm/progress";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export interface ReTransaction {
  id: string;
  address: string;
  side: "buyer" | "listing";
  price: number;
  /** Commission rate for this side, e.g. 0.025. */
  rate: number;
  status: "pending" | "closed";
  /** ISO date closed or expected to close. */
  closeDate: string;
  /** Days from list (or first tour) to contract. */
  daysToContract: number;
}

export interface ReAgentDashboardProps {
  agent: string;
  transactions: ReTransaction[];
  /** Annual gross commission income goal. */
  gciGoal: number;
  /** Agent share of GCI after brokerage split, e.g. 0.7. */
  split?: number;
  /** Flat fee per closed transaction paid to the brokerage. */
  transactionFee?: number;
  /** Annual cap on brokerage share; once reached the agent keeps 100%. */
  cap?: number;
  now?: Date;
  className?: string;
}

type Period = "month" | "quarter" | "ytd";

const inPeriod = (iso: string, now: Date, p: Period) => {
  const d = new Date(iso);
  if (d.getFullYear() !== now.getFullYear()) return false;
  if (p === "ytd") return true;
  if (p === "month") return d.getMonth() === now.getMonth();
  return Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
};

/** Computes agent net for the year applying split, cap and per-deal fees in close-date order. */
export function computeNet(closed: ReTransaction[], split: number, cap: number, fee: number) {
  let paidToBroker = 0;
  let net = 0;
  [...closed]
    .sort((a, b) => +new Date(a.closeDate) - +new Date(b.closeDate))
    .forEach((t) => {
      const gci = t.price * t.rate;
      const brokerWant = gci * (1 - split);
      const brokerTake = Math.max(0, Math.min(brokerWant, cap - paidToBroker));
      paidToBroker += brokerTake;
      net += gci - brokerTake - fee;
    });
  return { net, paidToBroker };
}

/** Agent production dashboard: period KPIs, GCI goal pace, split/cap-aware net income, pending pipeline and closings list. */
export function ReAgentDashboard({
  agent,
  transactions,
  gciGoal,
  split = 0.7,
  transactionFee = 395,
  cap = 18000,
  now: nowProp,
  className,
}: ReAgentDashboardProps) {
  const now = nowProp ?? new Date();
  const [period, setPeriod] = React.useState<Period>("ytd");
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const compact = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const closed = transactions.filter(
    (t) => t.status === "closed" && inPeriod(t.closeDate, now, period),
  );
  const pending = transactions.filter((t) => t.status === "pending");
  const gci = (ts: ReTransaction[]) => ts.reduce((s, t) => s + t.price * t.rate, 0);
  const volume = closed.reduce((s, t) => s + t.price, 0);
  const avgDays = closed.length
    ? closed.reduce((s, t) => s + t.daysToContract, 0) / closed.length
    : 0;

  const ytdClosed = transactions.filter(
    (t) => t.status === "closed" && inPeriod(t.closeDate, now, "ytd"),
  );
  const ytdGci = gci(ytdClosed);
  const { net, paidToBroker } = computeNet(ytdClosed, split, cap, transactionFee);
  const start = new Date(now.getFullYear(), 0, 1);
  const yearFrac = Math.min(1, (+now - +start) / (365 * 86_400_000));
  const pace = yearFrac ? ytdGci / yearFrac : 0;
  const pendingGci = gci(pending);
  const onTrack = pace >= gciGoal;

  return (
    <section
      aria-label={`${agent} production`}
      className={cn("flex flex-col gap-3 font-crm", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Agent dashboard</p>
          <h2 className="text-lg font-semibold text-crm-fg">{agent}</h2>
        </div>
        <SegmentedControl
          label="Period"
          size="sm"
          value={period}
          onValueChange={(v) => setPeriod(v as Period)}
          options={[
            { value: "month", label: "Month" },
            { value: "quarter", label: "Quarter" },
            { value: "ytd", label: "YTD" },
          ]}
        />
      </div>
      <KpiGrid
        items={[
          {
            label: "Closed GCI",
            value: compact.format(gci(closed)),
            caption: `${closed.length} closings`,
            icon: <DollarSign />,
          },
          { label: "Sales volume", value: compact.format(volume), icon: <Home /> },
          {
            label: "Buyer / listing",
            value: `${closed.filter((t) => t.side === "buyer").length} / ${closed.filter((t) => t.side === "listing").length}`,
            icon: <Handshake />,
          },
          { label: "Avg days to contract", value: Math.round(avgDays), icon: <Timer /> },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-crm-fg">GCI goal {now.getFullYear()}</h3>
            <Tag size="sm" color={onTrack ? "green" : "amber"}>
              {onTrack ? "On pace" : "Behind pace"}
            </Tag>
          </div>
          <Progress
            value={Math.min(ytdGci, gciGoal)}
            max={gciGoal}
            tone={onTrack ? "success" : "warning"}
            label={`${money.format(ytdGci)} of ${money.format(gciGoal)}`}
            showValue
          />
          <Progress
            value={Math.min(ytdGci + pendingGci, gciGoal)}
            max={gciGoal}
            tone="primary"
            size="sm"
            label={`Incl. pending ${money.format(pendingGci)}`}
            showValue
          />
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-crm-subtle">Projected year-end</dt>
              <dd className="text-sm text-crm-fg tabular-nums">{money.format(pace)}</dd>
            </div>
            <div>
              <dt className="text-crm-subtle">Needed per month</dt>
              <dd className="text-sm text-crm-fg tabular-nums">
                {money.format(Math.max(0, gciGoal - ytdGci) / Math.max(1, 12 - now.getMonth()))}
              </dd>
            </div>
            <div>
              <dt className="text-crm-subtle">Net to agent (YTD)</dt>
              <dd className="text-sm text-crm-fg tabular-nums">{money.format(net)}</dd>
            </div>
            <div>
              <dt className="text-crm-subtle">Brokerage cap</dt>
              <dd className="text-sm text-crm-fg tabular-nums">
                {money.format(paidToBroker)} / {money.format(cap)}
                {paidToBroker >= cap ? " · capped" : ""}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
          <h3 className="flex items-center justify-between border-b border-crm-border px-4 py-3 text-sm font-medium text-crm-fg">
            Pending closings
            <span className="text-xs text-crm-subtle tabular-nums">
              {money.format(pendingGci)} GCI
            </span>
          </h3>
          {pending.length ? (
            <ul className="max-h-64 overflow-y-auto">
              {[...pending]
                .sort((a, b) => +new Date(a.closeDate) - +new Date(b.closeDate))
                .map((t) => {
                  const days = Math.ceil((+new Date(t.closeDate) - +now) / 86_400_000);
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 border-b border-crm-border px-4 py-2.5 last:border-0"
                    >
                      <CalendarClock className="size-4 shrink-0 text-crm-subtle" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-crm-fg">{t.address}</p>
                        <p className="text-xs text-crm-subtle">
                          {t.side === "buyer" ? "Buyer side" : "Listing side"} ·{" "}
                          {money.format(t.price)} · {(t.rate * 100).toFixed(2)}%
                        </p>
                      </div>
                      <span className="text-right text-xs tabular-nums">
                        <span className="block text-crm-fg">{money.format(t.price * t.rate)}</span>
                        <span
                          className={
                            days < 0
                              ? "text-crm-danger"
                              : days <= 7
                                ? "text-crm-warning"
                                : "text-crm-subtle"
                          }
                        >
                          {days < 0 ? `${-days}d late` : `in ${days}d`}
                        </span>
                      </span>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <p className="p-8 text-center text-sm text-crm-subtle">No pending transactions.</p>
          )}
        </div>
      </div>
    </section>
  );
}
