import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Building2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
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

export type SaasPlan = "starter" | "growth" | "enterprise";

export interface SaasAccount {
  id: string;
  name: string;
  domain: string;
  plan: SaasPlan;
  /** Annual recurring revenue. */
  arr: number;
  seatsPurchased: number;
  seatsActive: number;
  /** 0–100 composite health score. */
  health: number;
  owner: string;
  /** Days since any user was active. */
  lastActiveDays: number;
  /** Open support tickets. */
  openTickets: number;
}

export type AccountSignal = "expansion" | "churn-risk" | "dormant" | null;

export interface SaasAccountsProps {
  accounts: SaasAccount[];
  currency?: string;
  locale?: string;
  loading?: boolean;
  error?: string;
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onOpenAccount?: (account: SaasAccount) => void;
  /** Seat utilisation (0–1) at which an account is flagged for expansion. */
  expansionThreshold?: number;
  /** Rendered next to the selection count, e.g. bulk "Assign owner" buttons. */
  bulkActions?: (ids: string[]) => React.ReactNode;
  className?: string;
}

type SortKey = "name" | "arr" | "seats" | "health" | "lastActiveDays";

const planTone: Record<SaasPlan, TagColor> = {
  starter: "neutral",
  growth: "blue",
  enterprise: "purple",
};

/** Classifies an account into one actionable signal (priority: churn risk → dormant → expansion). */
export function accountSignal(a: SaasAccount, expansionThreshold = 0.9): AccountSignal {
  if (a.health < 40) return "churn-risk";
  if (a.lastActiveDays > 14) return "dormant";
  if (a.seatsPurchased && a.seatsActive / a.seatsPurchased >= expansionThreshold)
    return "expansion";
  return null;
}

const signalMeta: Record<Exclude<AccountSignal, null>, { label: string; color: TagColor }> = {
  expansion: { label: "Expansion", color: "green" },
  "churn-risk": { label: "Churn risk", color: "red" },
  dormant: { label: "Dormant", color: "amber" },
};

function healthTone(h: number) {
  return h >= 70 ? "text-crm-success" : h >= 40 ? "text-crm-warning" : "text-crm-danger";
}

function SortHead({
  k,
  sort,
  onSort,
  align,
  children,
}: {
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const active = sort.key === k;
  return (
    <TableHead
      align={align}
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
      >
        {children}
        {active ? (
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

/** B2B SaaS account list: ARR, seat utilisation, health, activity recency and derived expansion / churn signals. */
export function SaasAccounts({
  accounts,
  currency = "USD",
  locale = "en-US",
  loading,
  error,
  selected,
  defaultSelected = [],
  onSelectedChange,
  onOpenAccount,
  expansionThreshold = 0.9,
  bulkActions,
  className,
}: SaasAccountsProps) {
  const [query, setQuery] = React.useState("");
  const [plan, setPlan] = React.useState<"all" | SaasPlan>("all");
  const [signal, setSignal] = React.useState<"all" | Exclude<AccountSignal, null>>("all");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "arr", dir: -1 });
  const [innerSel, setInnerSel] = React.useState(defaultSelected);
  const sel = selected ?? innerSel;
  const setSel = (ids: string[]) => {
    if (selected === undefined) setInnerSel(ids);
    onSelectedChange?.(ids);
  };
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  const byPlan = accounts.filter((a) => plan === "all" || a.plan === plan);
  const signalCount = (s: Exclude<AccountSignal, null>) =>
    byPlan.filter((a) => accountSignal(a, expansionThreshold) === s).length;
  const q = query.trim().toLowerCase();
  const rows = byPlan
    .filter((a) => !q || `${a.name} ${a.domain} ${a.owner}`.toLowerCase().includes(q))
    .filter((a) => signal === "all" || accountSignal(a, expansionThreshold) === signal)
    .sort((a, b) => {
      const v = (x: SaasAccount): number | string =>
        sort.key === "seats" ? x.seatsActive / (x.seatsPurchased || 1) : x[sort.key];
      const x = v(a);
      const y = v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
  const allSel = rows.length > 0 && rows.every((r) => sel.includes(r.id));

  const arr = rows.reduce((s, a) => s + a.arr, 0);
  const seatsP = rows.reduce((s, a) => s + a.seatsPurchased, 0);
  const seatsA = rows.reduce((s, a) => s + a.seatsActive, 0);
  const wHealth = arr ? rows.reduce((s, a) => s + a.health * a.arr, 0) / arr : 0;
  const atRiskArr = rows
    .filter((a) => accountSignal(a, expansionThreshold) === "churn-risk")
    .reduce((s, a) => s + a.arr, 0);

  return (
    <section
      aria-label="Accounts"
      className={cn(
        "flex flex-col rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
        <SegmentedControl
          label="Plan"
          size="sm"
          value={plan}
          onValueChange={(v) => setPlan(v as "all" | SaasPlan)}
          options={[
            { value: "all", label: "All plans" },
            { value: "starter", label: "Starter" },
            { value: "growth", label: "Growth" },
            { value: "enterprise", label: "Enterprise" },
          ]}
        />
        <SegmentedControl
          label="Signal"
          size="sm"
          value={signal}
          onValueChange={(v) => setSignal(v as "all" | Exclude<AccountSignal, null>)}
          options={[
            { value: "all", label: "Any signal" },
            { value: "expansion", label: "Expansion", count: signalCount("expansion") },
            { value: "churn-risk", label: "Churn risk", count: signalCount("churn-risk") },
            { value: "dormant", label: "Dormant", count: signalCount("dormant") },
          ]}
        />
        <SearchInput
          size="sm"
          className="ml-auto w-56"
          placeholder="Search accounts, domains…"
          value={query}
          onValueChange={setQuery}
          aria-label="Search accounts"
        />
      </div>
      {sel.length ? (
        <div
          className="flex items-center gap-2 border-b border-crm-border bg-crm-raised px-3 py-2 text-xs text-crm-fg"
          aria-live="polite"
        >
          {sel.length} selected ·{" "}
          {money.format(accounts.filter((a) => sel.includes(a.id)).reduce((s, a) => s + a.arr, 0))}{" "}
          ARR
          <span className="ml-auto flex gap-1">{bulkActions?.(sel)}</span>
          <button
            type="button"
            className="cursor-pointer text-crm-soft hover:text-crm-fg"
            onClick={() => setSel([])}
          >
            Clear
          </button>
        </div>
      ) : null}

      {error ? (
        <EmptyState
          tone="error"
          icon={<AlertTriangle />}
          title="Couldn't load accounts"
          description={error}
        />
      ) : loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy="true" aria-label="Loading accounts">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="No accounts match"
          description="Adjust plan, signal or search filters."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select all visible accounts"
                  checked={allSel}
                  onChange={() =>
                    setSel(
                      allSel
                        ? sel.filter((id) => !rows.some((r) => r.id === id))
                        : Array.from(new Set([...sel, ...rows.map((r) => r.id)])),
                    )
                  }
                  className="size-3.5 accent-crm-primary"
                />
              </TableHead>
              <SortHead k="name" sort={sort} onSort={onSort}>
                Account
              </SortHead>
              <TableHead>Plan</TableHead>
              <SortHead k="arr" sort={sort} onSort={onSort} align="right">
                ARR
              </SortHead>
              <SortHead k="seats" sort={sort} onSort={onSort}>
                Seats
              </SortHead>
              <SortHead k="health" sort={sort} onSort={onSort} align="right">
                Health
              </SortHead>
              <SortHead k="lastActiveDays" sort={sort} onSort={onSort}>
                Last active
              </SortHead>
              <TableHead>Signal</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => {
              const checked = sel.includes(a.id);
              const util = a.seatsPurchased ? a.seatsActive / a.seatsPurchased : 0;
              const s = accountSignal(a, expansionThreshold);
              return (
                <TableRow key={a.id} selected={checked}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${a.name}`}
                      checked={checked}
                      onChange={() =>
                        setSel(checked ? sel.filter((i) => i !== a.id) : [...sel, a.id])
                      }
                      className="size-3.5 accent-crm-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onOpenAccount?.(a)}
                      className="flex cursor-pointer flex-col rounded-sm text-left focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
                    >
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-crm-subtle">{a.domain}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Tag size="sm" color={planTone[a.plan]} className="capitalize">
                      {a.plan}
                    </Tag>
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {money.format(a.arr)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 text-xs tabular-nums">
                      <span
                        className="h-1.5 w-16 overflow-hidden rounded-full bg-crm-muted"
                        role="meter"
                        aria-label={`${a.name} seat utilisation`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(util * 100)}
                      >
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            util >= expansionThreshold
                              ? "bg-crm-success"
                              : util < 0.4
                                ? "bg-crm-warning"
                                : "bg-crm-primary",
                          )}
                          style={{ width: `${Math.min(100, util * 100)}%` }}
                        />
                      </span>
                      {a.seatsActive}/{a.seatsPurchased}
                    </span>
                  </TableCell>
                  <TableCell
                    align="right"
                    className={cn("font-medium tabular-nums", healthTone(a.health))}
                  >
                    {a.health}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-xs",
                      a.lastActiveDays > 14 ? "text-crm-warning" : "text-crm-soft",
                    )}
                  >
                    {a.lastActiveDays === 0 ? "Today" : `${a.lastActiveDays}d ago`}
                    {a.openTickets ? (
                      <span className="text-crm-subtle"> · {a.openTickets} tickets</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {s ? (
                      <Tag size="sm" color={signalMeta[s].color}>
                        {s === "expansion" ? <TrendingUp className="size-3" aria-hidden /> : null}
                        {signalMeta[s].label}
                      </Tag>
                    ) : (
                      <span className="text-xs text-crm-faint">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-xs">
                      <Avatar name={a.owner} size="sm" />
                      {a.owner}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {!loading && !error && rows.length ? (
        <TableFooterBar
          cells={[
            { label: "accounts", value: rows.length },
            { label: "ARR", value: money.format(arr) },
            {
              label: "seat utilisation",
              value: `${seatsP ? Math.round((seatsA / seatsP) * 100) : 0}%`,
            },
            { label: "ARR-weighted health", value: Math.round(wHealth) },
            { label: "ARR at risk", value: money.format(atRiskArr) },
          ]}
        />
      ) : null}
    </section>
  );
}
