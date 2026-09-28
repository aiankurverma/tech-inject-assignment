import * as React from "react";
import { Download, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { Tag, type TagColor } from "@/components/crm/tag";

export interface PortalInvoice {
  id: string;
  number: string;
  /** ISO dates. */
  issuedAt: string;
  dueAt: string;
  /** Minor units (cents). */
  amount: number;
  status: "paid" | "open" | "void";
}

export interface PortalTicket {
  id: string;
  subject: string;
  status: "open" | "pending" | "solved";
  priority: "low" | "normal" | "high" | "urgent";
  /** ISO timestamps. */
  createdAt: string;
  /** First-response SLA deadline; omitted once answered. */
  slaDueAt?: string;
}

export interface PortalUsage {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}

export interface CustomerPortalProps {
  account: { name: string; plan: string; renewsAt: string; seats: number };
  invoices: PortalInvoice[];
  tickets: PortalTicket[];
  usage?: PortalUsage[];
  currency?: string;
  locale?: string;
  /** Reference time for overdue/SLA maths (defaults to now). */
  now?: Date;
  onPay?: (invoiceIds: string[], totalMinor: number) => void;
  onDownload?: (invoiceId: string) => void;
  onNewTicket?: () => void;
  onOpenTicket?: (ticketId: string) => void;
  defaultTab?: "overview" | "invoices" | "tickets";
  className?: string;
}

const ticketColor: Record<PortalTicket["status"], TagColor> = {
  open: "blue",
  pending: "amber",
  solved: "green",
};
const prioColor: Record<PortalTicket["priority"], TagColor> = {
  low: "neutral",
  normal: "neutral",
  high: "orange",
  urgent: "red",
};

function slaText(due: string, now: number) {
  const ms = new Date(due).getTime() - now;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const t = h ? `${h}h ${m}m` : `${m}m`;
  return {
    late: ms < 0,
    soon: ms >= 0 && ms < 3_600_000,
    text: ms < 0 ? `SLA breached ${t} ago` : `Reply due in ${t}`,
  };
}

/** Self-serve account portal: plan & usage, invoices with overdue maths and bulk pay, support tickets with SLA. */
export function CustomerPortal({
  account,
  invoices,
  tickets,
  usage = [],
  currency = "USD",
  locale = "en-US",
  now,
  onPay,
  onDownload,
  onNewTicket,
  onOpenTicket,
  defaultTab = "overview",
  className,
}: CustomerPortalProps) {
  const uid = React.useId();
  const [tab, setTab] = React.useState(defaultTab);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [invFilter, setInvFilter] = React.useState<"all" | "open" | "paid">("all");
  const t0 = (now ?? new Date()).getTime();
  const money = (minor: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  const tabIds = ["overview", "invoices", "tickets"] as const;

  const isOverdue = (i: PortalInvoice) => i.status === "open" && new Date(i.dueAt).getTime() < t0;
  const openInv = invoices.filter((i) => i.status === "open");
  const outstanding = openInv.reduce((n, i) => n + i.amount, 0);
  const overdue = openInv.filter(isOverdue);
  const selTotal = invoices
    .filter((i) => selected.includes(i.id))
    .reduce((n, i) => n + i.amount, 0);
  const shownInv = invoices
    .filter((i) => invFilter === "all" || i.status === invFilter)
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  const openTickets = tickets.filter((t) => t.status !== "solved");

  const onTabKey = (e: React.KeyboardEvent) => {
    const i = tabIds.indexOf(tab);
    const n = e.key === "ArrowRight" ? (i + 1) % 3 : e.key === "ArrowLeft" ? (i + 2) % 3 : -1;
    const next = tabIds[n];
    if (!next) return;
    e.preventDefault();
    setTab(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return (
    <section
      aria-label="Customer portal"
      className={cn(
        "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm sm:p-5",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-crm-fg">{account.name}</h2>
          <p className="crm-caption text-crm-subtle">
            {account.plan} · {account.seats} seats · renews {date(account.renewsAt)}
          </p>
        </div>
        {overdue.length ? (
          <Tag color="red">
            {overdue.length} overdue invoice{overdue.length > 1 ? "s" : ""}
          </Tag>
        ) : null}
      </header>

      <div
        role="tablist"
        aria-label="Portal sections"
        className="flex gap-1 border-b border-crm-border"
        onKeyDown={onTabKey}
      >
        {tabIds.map((t) => (
          <button
            key={t}
            id={`${uid}-tab-${t}`}
            role="tab"
            type="button"
            aria-selected={tab === t}
            aria-controls={`${uid}-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              tab === t
                ? "border-crm-primary text-crm-fg"
                : "border-transparent text-crm-muted-fg hover:text-crm-fg",
            )}
          >
            {t}
            {t === "tickets" && openTickets.length ? (
              <span className="ml-1 text-crm-subtle">{openTickets.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div
          id={`${uid}-panel-overview`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-overview`}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Outstanding", money(outstanding)],
              ["Overdue", money(overdue.reduce((n, i) => n + i.amount, 0))],
              ["Open tickets", String(openTickets.length)],
            ].map(([l, v]) => (
              <div
                key={l}
                className="flex flex-col gap-1 rounded-crm border border-crm-input/70 p-3"
              >
                <span className="text-xs text-crm-soft">{l}</span>
                <span className="text-sm font-medium text-crm-fg tabular-nums">{v}</span>
              </div>
            ))}
          </div>
          {usage.length ? (
            <ul className="flex flex-col gap-3">
              {usage.map((u) => {
                const pct = u.limit > 0 ? Math.min(100, (u.used / u.limit) * 100) : 0;
                return (
                  <li key={u.label} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-crm-soft">{u.label}</span>
                      <span className="text-crm-fg tabular-nums">
                        {u.used.toLocaleString(locale)} / {u.limit.toLocaleString(locale)}{" "}
                        {u.unit ?? ""}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={u.label}
                      aria-valuemin={0}
                      aria-valuemax={u.limit}
                      aria-valuenow={u.used}
                      className="h-1.5 overflow-hidden rounded-full bg-crm-track"
                    >
                      <div
                        className={cn(
                          "h-full rounded-full",
                          pct >= 90
                            ? "bg-crm-danger"
                            : pct >= 75
                              ? "bg-crm-warning"
                              : "bg-crm-primary",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {pct >= 90 ? (
                      <span className="crm-caption text-crm-danger">
                        Near limit — overage billed at end of cycle.
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {tab === "invoices" ? (
        <div
          id={`${uid}-panel-invoices`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-invoices`}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1" role="group" aria-label="Filter invoices">
              {(["all", "open", "paid"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={invFilter === f}
                  onClick={() => setInvFilter(f)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-xs capitalize",
                    invFilter === f
                      ? "bg-crm-raised text-crm-fg shadow-crm-raised"
                      : "text-crm-muted-fg hover:text-crm-fg",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            {onPay ? (
              <Button
                variant="primary"
                disabled={!selected.length}
                onClick={() => onPay(selected, selTotal)}
              >
                {selected.length ? `Pay ${money(selTotal)}` : "Select invoices to pay"}
              </Button>
            ) : null}
          </div>
          {shownInv.length === 0 ? (
            <p className="rounded-crm border border-dashed border-crm-border p-6 text-center text-sm text-crm-subtle">
              No invoices here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="crm-caption text-crm-subtle">
                  <tr>
                    <th className="w-8 py-2">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="py-2 font-normal">Invoice</th>
                    <th className="py-2 font-normal">Issued</th>
                    <th className="py-2 font-normal">Due</th>
                    <th className="py-2 text-right font-normal">Amount</th>
                    <th className="py-2 font-normal">Status</th>
                    <th className="py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-crm-border">
                  {shownInv.map((i) => {
                    const od = isOverdue(i);
                    const days = od
                      ? Math.floor((t0 - new Date(i.dueAt).getTime()) / 86_400_000)
                      : 0;
                    return (
                      <tr key={i.id} className="text-crm-soft">
                        <td className="py-2">
                          {i.status === "open" ? (
                            <Checkbox
                              aria-label={`Select invoice ${i.number}`}
                              checked={selected.includes(i.id)}
                              onCheckedChange={(c) =>
                                setSelected((s) =>
                                  c === true ? [...s, i.id] : s.filter((x) => x !== i.id),
                                )
                              }
                            />
                          ) : null}
                        </td>
                        <td className="py-2 font-medium text-crm-fg">{i.number}</td>
                        <td className="py-2">{date(i.issuedAt)}</td>
                        <td className={cn("py-2", od && "text-crm-danger")}>
                          {date(i.dueAt)}
                          {od ? <span className="block crm-caption">{days}d overdue</span> : null}
                        </td>
                        <td
                          className={cn(
                            "py-2 text-right tabular-nums text-crm-fg",
                            i.status === "void" && "line-through opacity-60",
                          )}
                        >
                          {money(i.amount)}
                        </td>
                        <td className="py-2">
                          <Tag
                            size="sm"
                            color={
                              i.status === "paid"
                                ? "green"
                                : od
                                  ? "red"
                                  : i.status === "void"
                                    ? "neutral"
                                    : "amber"
                            }
                          >
                            {od ? "Overdue" : i.status.charAt(0).toUpperCase() + i.status.slice(1)}
                          </Tag>
                        </td>
                        <td className="py-2 text-right">
                          {onDownload ? (
                            <button
                              type="button"
                              aria-label={`Download ${i.number} PDF`}
                              onClick={() => onDownload(i.id)}
                              className="rounded-full p-1 text-crm-subtle hover:bg-crm-muted hover:text-crm-fg [&_svg]:size-3.5"
                            >
                              <Download />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "tickets" ? (
        <div
          id={`${uid}-panel-tickets`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-tickets`}
          className="flex flex-col gap-3"
        >
          {onNewTicket ? (
            <Button className="self-end" onClick={onNewTicket}>
              <Plus aria-hidden /> New request
            </Button>
          ) : null}
          {tickets.length === 0 ? (
            <p className="rounded-crm border border-dashed border-crm-border p-6 text-center text-sm text-crm-subtle">
              No support requests yet.
            </p>
          ) : (
            <ul className="divide-y divide-crm-border rounded-crm border border-crm-border">
              {[...tickets]
                .sort(
                  (a, b) =>
                    Number(a.status === "solved") - Number(b.status === "solved") ||
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                )
                .map((tk) => {
                  const sla =
                    tk.slaDueAt && tk.status !== "solved" ? slaText(tk.slaDueAt, t0) : null;
                  return (
                    <li key={tk.id}>
                      <button
                        type="button"
                        onClick={() => onOpenTicket?.(tk.id)}
                        className="flex w-full flex-wrap items-center gap-2 p-3 text-left outline-none hover:bg-crm-raised/60 focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-inset"
                      >
                        <MessageSquare aria-hidden className="size-4 text-crm-subtle" />
                        <span className="min-w-0 flex-1 truncate text-sm text-crm-fg">
                          {tk.subject}
                        </span>
                        {sla ? (
                          <span
                            className={cn(
                              "crm-caption tabular-nums",
                              sla.late
                                ? "text-crm-danger"
                                : sla.soon
                                  ? "text-crm-warning"
                                  : "text-crm-subtle",
                            )}
                          >
                            {sla.text}
                          </span>
                        ) : null}
                        <Tag size="sm" color={prioColor[tk.priority]}>
                          {tk.priority}
                        </Tag>
                        <Tag size="sm" color={ticketColor[tk.status]}>
                          {tk.status}
                        </Tag>
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
