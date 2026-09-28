import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Building2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { EmptyState, Skeleton } from "@/components/crm/feedback";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";
import {
  Table,
  TableBody,
  TableCell,
  TableFooterBar,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/crm/data-table";

export type AgencyClientStatus = "active" | "onboarding" | "paused" | "churned";

export interface AgencyClient {
  id: string;
  name: string;
  industry: string;
  accountLead: string;
  status: AgencyClientStatus;
  /** Monthly retainer fee in the table currency. */
  retainer: number;
  /** Hours included in the retainer this month. */
  hoursIncluded: number;
  /** Hours logged against the client this month. */
  hoursUsed: number;
  /** Unpaid invoiced amount. */
  outstanding: number;
  /** Oldest unpaid invoice age in days (0 when nothing is overdue). */
  oldestInvoiceDays: number;
  /** ISO date the contract renews. */
  renewsOn: string;
}

export interface AgencyClientsProps {
  clients: AgencyClient[];
  currency?: string;
  locale?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** Controlled selection of client ids. */
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onOpenClient?: (client: AgencyClient) => void;
  /** Reference date for renewal countdowns (defaults to today). */
  today?: Date;
  className?: string;
}

type SortKey = "name" | "retainer" | "burn" | "outstanding" | "renewsOn";

const statusTone: Record<AgencyClientStatus, TagColor> = {
  active: "green",
  onboarding: "blue",
  paused: "amber",
  churned: "neutral",
};

/** Share of retainer hours consumed (1 = exactly used up). */
export function retainerBurn(c: Pick<AgencyClient, "hoursUsed" | "hoursIncluded">) {
  return c.hoursIncluded > 0 ? c.hoursUsed / c.hoursIncluded : 0;
}

const isOver = (c: AgencyClient) => retainerBurn(c) > 1;
const isAtRisk = (c: AgencyClient) => c.oldestInvoiceDays > 30 || retainerBurn(c) > 0.9;

function daysUntil(iso: string, today: Date) {
  const d = new Date(`${iso}T00:00:00`);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

function SortHead({
  k,
  sort,
  onSort,
  children,
  align,
}: {
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <TableHead
      align={align}
      aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
      >
        {children}
        {sort.key === k ? (
          sort.dir === 1 ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </TableHead>
  );
}

/** Agency client roster: retainer burn, overage risk, receivables ageing and renewal countdown. */
export function AgencyClients({
  clients,
  currency = "USD",
  locale = "en-US",
  loading,
  error,
  onRetry,
  selected,
  defaultSelected = [],
  onSelectedChange,
  onOpenClient,
  today = new Date(),
  className,
}: AgencyClientsProps) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "burn",
    dir: -1,
  });
  const [innerSel, setInnerSel] = React.useState<string[]>(defaultSelected);
  const sel = selected ?? innerSel;
  const setSel = (ids: string[]) => {
    if (selected === undefined) setInnerSel(ids);
    onSelectedChange?.(ids);
  };

  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [locale, currency],
  );

  const counts = {
    all: clients.length,
    over: clients.filter(isOver).length,
    risk: clients.filter(isAtRisk).length,
    renewing: clients.filter((c) => {
      const d = daysUntil(c.renewsOn, today);
      return d >= 0 && d <= 60;
    }).length,
  };

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = clients.filter((c) => {
      if (q && !`${c.name} ${c.industry} ${c.accountLead}`.toLowerCase().includes(q)) return false;
      if (filter === "over") return isOver(c);
      if (filter === "risk") return isAtRisk(c);
      if (filter === "renewing") {
        const d = daysUntil(c.renewsOn, today);
        return d >= 0 && d <= 60;
      }
      return true;
    });
    const val = (c: AgencyClient): number | string =>
      sort.key === "burn" ? retainerBurn(c) : c[sort.key];
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [clients, query, filter, sort, today]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));

  const allVisibleSelected = rows.length > 0 && rows.every((r) => sel.includes(r.id));
  const toggleAll = () =>
    setSel(
      allVisibleSelected
        ? sel.filter((id) => !rows.some((r) => r.id === id))
        : Array.from(new Set([...sel, ...rows.map((r) => r.id)])),
    );

  const totals = rows.reduce(
    (t, c) => ({
      retainer: t.retainer + c.retainer,
      used: t.used + c.hoursUsed,
      included: t.included + c.hoursIncluded,
      outstanding: t.outstanding + c.outstanding,
      overage: t.overage + Math.max(0, c.hoursUsed - c.hoursIncluded),
    }),
    { retainer: 0, used: 0, included: 0, outstanding: 0, overage: 0 },
  );

  return (
    <section
      aria-label="Agency clients"
      className={cn(
        "flex flex-col rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border p-3">
        <SegmentedControl
          label="Client filter"
          size="sm"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "over", label: "Over retainer", count: counts.over },
            { value: "risk", label: "At risk", count: counts.risk },
            { value: "renewing", label: "Renewing ≤60d", count: counts.renewing },
          ]}
        />
        <div className="flex items-center gap-2">
          {sel.length > 0 ? (
            <span className="text-xs text-crm-soft" aria-live="polite">
              {sel.length} selected
            </span>
          ) : null}
          <SearchInput
            size="sm"
            className="w-56"
            placeholder="Search clients, leads…"
            value={query}
            onValueChange={setQuery}
            aria-label="Search clients"
          />
        </div>
      </div>

      {error ? (
        <EmptyState
          tone="error"
          icon={<AlertTriangle />}
          title="Couldn't load clients"
          description={error}
          action={
            onRetry ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <RefreshCw className="size-3" aria-hidden /> Retry
              </Button>
            ) : null
          }
        />
      ) : loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy="true" aria-label="Loading clients">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title={clients.length ? "No clients match" : "No clients yet"}
          description={
            clients.length
              ? "Try another filter or clear the search."
              : "Add your first retainer client to track burn and billing."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select all visible clients"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  className="size-3.5 accent-crm-primary"
                />
              </TableHead>
              <SortHead k="name" sort={sort} onSort={toggleSort}>
                Client
              </SortHead>
              <TableHead>Status</TableHead>
              <SortHead k="retainer" sort={sort} onSort={toggleSort} align="right">
                Retainer / mo
              </SortHead>
              <SortHead k="burn" sort={sort} onSort={toggleSort}>
                Hours burn
              </SortHead>
              <SortHead k="outstanding" sort={sort} onSort={toggleSort} align="right">
                Outstanding
              </SortHead>
              <SortHead k="renewsOn" sort={sort} onSort={toggleSort}>
                Renews
              </SortHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => {
              const burn = retainerBurn(c);
              const days = daysUntil(c.renewsOn, today);
              const checked = sel.includes(c.id);
              return (
                <TableRow key={c.id} selected={checked}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.name}`}
                      checked={checked}
                      onChange={() =>
                        setSel(checked ? sel.filter((id) => id !== c.id) : [...sel, c.id])
                      }
                      className="size-3.5 accent-crm-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onOpenClient?.(c)}
                      className="flex cursor-pointer items-center gap-2 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
                    >
                      <Avatar name={c.name} size="md" />
                      <span className="flex flex-col">
                        <span className="font-medium text-crm-fg">{c.name}</span>
                        <span className="text-xs text-crm-subtle">
                          {c.industry} · {c.accountLead}
                        </span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Tag color={statusTone[c.status]} size="sm" className="capitalize">
                      {c.status}
                    </Tag>
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {money.format(c.retainer)}
                  </TableCell>
                  <TableCell>
                    <div className="flex w-40 flex-col gap-1">
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-crm-muted"
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(burn * 100)}
                        aria-label={`${c.name} retainer hours used`}
                      >
                        <div
                          className={cn(
                            "h-full rounded-full",
                            burn > 1
                              ? "bg-crm-danger"
                              : burn > 0.9
                                ? "bg-crm-warning"
                                : "bg-crm-success",
                          )}
                          style={{ width: `${Math.min(100, burn * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-crm-soft tabular-nums">
                        {c.hoursUsed}h / {c.hoursIncluded}h
                        {burn > 1 ? (
                          <span className="text-crm-danger">
                            {" "}
                            · +{(c.hoursUsed - c.hoursIncluded).toFixed(1)}h over
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    <span className="flex flex-col items-end">
                      {money.format(c.outstanding)}
                      {c.oldestInvoiceDays > 0 ? (
                        <span
                          className={cn(
                            "text-xs",
                            c.oldestInvoiceDays > 30 ? "text-crm-danger" : "text-crm-subtle",
                          )}
                        >
                          oldest {c.oldestInvoiceDays}d
                        </span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        days < 0
                          ? "text-crm-danger"
                          : days <= 60
                            ? "text-crm-warning"
                            : "text-crm-soft",
                      )}
                    >
                      {days < 0 ? `Lapsed ${-days}d ago` : days === 0 ? "Today" : `in ${days}d`}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {!loading && !error && rows.length > 0 ? (
        <TableFooterBar
          cells={[
            { label: "clients", value: rows.length },
            { label: "MRR", value: money.format(totals.retainer) },
            {
              label: "utilised",
              value: `${totals.included ? Math.round((totals.used / totals.included) * 100) : 0}%`,
            },
            { label: "overage hrs", value: totals.overage.toFixed(1) },
            { label: "receivable", value: money.format(totals.outstanding) },
          ]}
        />
      ) : null}
    </section>
  );
}
