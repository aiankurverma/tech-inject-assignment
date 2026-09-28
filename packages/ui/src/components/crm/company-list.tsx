import * as React from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/crm/data-table";
import { Checkbox } from "@/components/crm/checkbox";
import { Avatar, LogoTile } from "@/components/crm/avatar";
import { SearchInput } from "@/components/crm/search-input";
import { Sparkline } from "@/components/crm/sparkline";
import { EmptyState, Skeleton } from "@/components/crm/feedback";

export type CompanyTier = "Enterprise" | "Mid-market" | "SMB";

export interface CompanyRow {
  id: string;
  name: string;
  domain: string;
  industry: string;
  tier: CompanyTier;
  employees: number;
  /** Annual recurring revenue in the list currency. */
  arr: number;
  /** 0–100 account health. */
  health: number;
  owner: string;
  /** ISO date of last touch (email, call, meeting). */
  lastActivity: string;
  /** Monthly ARR history for the trend sparkline. */
  arrTrend?: number[];
  country?: string;
}

type SortKey = "name" | "arr" | "employees" | "health" | "lastActivity";

export interface CompanyListProps {
  companies: CompanyRow[];
  currency?: string;
  pageSize?: number;
  /** Days without activity before a company is flagged as going cold. */
  staleAfterDays?: number;
  /** Reference date for staleness; defaults to now. */
  today?: string;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onOpenCompany?: (c: CompanyRow) => void;
  loading?: boolean;
  error?: string;
  className?: string;
}

const compact = (n: number, c: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

function healthTone(h: number) {
  return h >= 70 ? "bg-crm-success" : h >= 40 ? "bg-crm-warning" : "bg-crm-danger";
}

/** Account directory with tier/industry filters, sort, pagination, health meters and stale-account flags. */
export function CompanyList({
  companies,
  currency = "USD",
  pageSize = 10,
  staleAfterDays = 30,
  today,
  selected,
  onSelectedChange,
  onOpenCompany,
  loading,
  error,
  className,
}: CompanyListProps) {
  const [innerSel, setInnerSel] = React.useState<string[]>([]);
  const sel = selected ?? innerSel;
  const setSel = (ids: string[]) => {
    if (!selected) setInnerSel(ids);
    onSelectedChange?.(ids);
  };
  const [query, setQuery] = React.useState("");
  const [tier, setTier] = React.useState<"all" | CompanyTier>("all");
  const [industry, setIndustry] = React.useState("all");
  const [onlyAtRisk, setOnlyAtRisk] = React.useState(false);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "arr", dir: -1 });
  const [page, setPage] = React.useState(0);
  const ref = today ? new Date(`${today}T00:00:00`) : new Date();

  const industries = React.useMemo(
    () => Array.from(new Set(companies.map((c) => c.industry))).sort(),
    [companies],
  );

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies
      .filter((c) => tier === "all" || c.tier === tier)
      .filter((c) => industry === "all" || c.industry === industry)
      .filter((c) => !onlyAtRisk || c.health < 40)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      });
  }, [companies, query, tier, industry, onlyAtRisk, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = rows.slice(current * pageSize, current * pageSize + pageSize);
  const totalArr = rows.reduce((s, c) => s + c.arr, 0);
  const atRisk = rows.filter((c) => c.health < 40);
  const allChecked = slice.length > 0 && slice.every((c) => sel.includes(c.id));

  const head = (key: SortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <TableHead
        align={align}
        aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => setSort({ key, dir: active ? (sort.dir === 1 ? -1 : 1) : -1 })}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 outline-none hover:text-crm-fg focus-visible:underline",
            active && "text-crm-fg",
          )}
        >
          {label}
          <Icon className="size-3" aria-hidden />
        </button>
      </TableHead>
    );
  };

  const selectCls =
    "h-7 rounded-crm border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
        <SearchInput
          size="sm"
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setPage(0);
          }}
          placeholder="Search name or domain"
          aria-label="Search companies"
          className="w-full sm:w-56"
        />
        <select
          aria-label="Tier"
          className={selectCls}
          value={tier}
          onChange={(e) => {
            setTier(e.target.value as "all" | CompanyTier);
            setPage(0);
          }}
        >
          <option value="all">All tiers</option>
          <option>Enterprise</option>
          <option>Mid-market</option>
          <option>SMB</option>
        </select>
        <select
          aria-label="Industry"
          className={selectCls}
          value={industry}
          onChange={(e) => {
            setIndustry(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All industries</option>
          {industries.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-crm-soft">
          <Checkbox
            checked={onlyAtRisk}
            onCheckedChange={(v) => {
              setOnlyAtRisk(v === true);
              setPage(0);
            }}
          />
          At risk only ({companies.filter((c) => c.health < 40).length})
        </label>
        <p className="ml-auto text-xs text-crm-soft">
          <span className="text-crm-fg tabular-nums">{rows.length}</span> accounts ·{" "}
          <span className="text-crm-fg tabular-nums">{compact(totalArr, currency)}</span> ARR
          {atRisk.length ? (
            <>
              {" "}
              ·{" "}
              <span className="text-crm-danger tabular-nums">
                {compact(
                  atRisk.reduce((s, c) => s + c.arr, 0),
                  currency,
                )}{" "}
                at risk
              </span>
            </>
          ) : null}
        </p>
      </div>

      {error ? (
        <EmptyState
          tone="error"
          icon={<AlertTriangle />}
          title="Couldn't load companies"
          description={error}
        />
      ) : loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={<Building2 />}
          title={companies.length ? "No companies match these filters" : "No companies yet"}
          description={
            companies.length
              ? "Clear a filter to see more accounts."
              : "Import accounts or create one to get started."
          }
        />
      ) : (
        <Table aria-label="Companies">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8">
                <Checkbox
                  aria-label="Select page"
                  checked={allChecked}
                  onCheckedChange={() =>
                    setSel(
                      allChecked
                        ? sel.filter((id) => !slice.some((c) => c.id === id))
                        : Array.from(new Set([...sel, ...slice.map((c) => c.id)])),
                    )
                  }
                />
              </TableHead>
              {head("name", "Company")}
              <TableHead>Industry</TableHead>
              {head("employees", "Employees", "right")}
              {head("arr", "ARR", "right")}
              <TableHead>Trend</TableHead>
              {head("health", "Health")}
              {head("lastActivity", "Last activity")}
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((c) => {
              const checked = sel.includes(c.id);
              const days = Math.floor(
                (ref.getTime() - new Date(`${c.lastActivity}T00:00:00`).getTime()) / 86_400_000,
              );
              const stale = days > staleAfterDays;
              return (
                <TableRow key={c.id} selected={checked}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${c.name}`}
                      checked={checked}
                      onCheckedChange={() =>
                        setSel(checked ? sel.filter((x) => x !== c.id) : [...sel, c.id])
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onOpenCompany?.(c)}
                      className="flex cursor-pointer items-center gap-2 text-left outline-none focus-visible:underline"
                    >
                      <LogoTile size="md" className="text-xs font-medium">
                        {c.name.charAt(0)}
                      </LogoTile>
                      <span className="flex flex-col">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-crm-subtle">
                          {c.domain} · {c.tier}
                        </span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-crm-soft">{c.industry}</TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {c.employees.toLocaleString("en-US")}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {compact(c.arr, currency)}
                  </TableCell>
                  <TableCell>
                    {c.arrTrend && c.arrTrend.length > 1 ? (
                      <Sparkline data={c.arrTrend} height={18} label={`${c.name} ARR trend`} />
                    ) : (
                      <span className="text-crm-subtle">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-14 overflow-hidden rounded-full bg-crm-track"
                        role="meter"
                        aria-valuenow={c.health}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${c.name} health`}
                      >
                        <span
                          className={cn("block h-full rounded-full", healthTone(c.health))}
                          style={{ width: `${c.health}%` }}
                        />
                      </span>
                      <span className="text-xs tabular-nums">{c.health}</span>
                    </span>
                  </TableCell>
                  <TableCell className={cn(stale ? "text-crm-warning" : "text-crm-soft")}>
                    {days <= 0 ? "Today" : `${days}d ago`}
                    {stale ? <span className="sr-only"> (going cold)</span> : null}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={c.owner} size="xs" />
                      {c.owner}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {!loading && !error && rows.length > pageSize ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between border-t border-crm-border px-3 py-2 text-xs text-crm-soft"
        >
          <span className="tabular-nums">
            {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)} of{" "}
            {rows.length}
          </span>
          <span className="flex gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="grid size-7 cursor-pointer place-items-center rounded-crm hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="grid size-7 cursor-pointer place-items-center rounded-crm hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </span>
        </nav>
      ) : null}
    </div>
  );
}
