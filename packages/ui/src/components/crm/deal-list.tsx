import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableFooterBar,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/crm/data-table";
import { Checkbox } from "@/components/crm/checkbox";
import { Avatar } from "@/components/crm/avatar";
import { Tag, type TagColor } from "@/components/crm/tag";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { EmptyState, Skeleton } from "@/components/crm/feedback";

export type DealStatus = "open" | "won" | "lost";

export interface DealRow {
  id: string;
  name: string;
  company: string;
  amount: number;
  /** ISO currency code, defaults to the list currency. */
  currency?: string;
  stage: string;
  probability: number;
  /** ISO date (YYYY-MM-DD). */
  closeDate: string;
  owner: string;
  status: DealStatus;
}

type SortKey = "name" | "amount" | "probability" | "closeDate" | "weighted";

export interface DealListProps {
  deals: DealRow[];
  /** Stage label → tag colour. */
  stageColors?: Record<string, TagColor>;
  currency?: string;
  /** Used to flag overdue open deals. Defaults to today. */
  today?: string;
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onOpenDeal?: (deal: DealRow) => void;
  /** Bulk action bar content, rendered when rows are selected. */
  bulkActions?: (ids: string[]) => React.ReactNode;
  loading?: boolean;
  error?: string;
  className?: string;
}

const fmt = (n: number, c: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Sortable, filterable deal table with selection, overdue flags and live totals of the filtered set. */
export function DealList({
  deals,
  stageColors = {},
  currency = "USD",
  today,
  selected,
  defaultSelected = [],
  onSelectedChange,
  onOpenDeal,
  bulkActions,
  loading,
  error,
  className,
}: DealListProps) {
  const [innerSel, setInnerSel] = React.useState(defaultSelected);
  const sel = selected ?? innerSel;
  const setSel = (ids: string[]) => {
    if (!selected) setInnerSel(ids);
    onSelectedChange?.(ids);
  };
  const [status, setStatus] = React.useState<"all" | DealStatus>("open");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "closeDate",
    dir: 1,
  });
  const todayIso = today ?? new Date().toISOString().slice(0, 10);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const value = (d: DealRow): string | number =>
      sort.key === "weighted" ? (d.amount * d.probability) / 100 : d[sort.key];
    return deals
      .filter((d) => status === "all" || d.status === status)
      .filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.company.toLowerCase().includes(q) ||
          d.owner.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const av = value(a);
        const bv = value(b);
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      });
  }, [deals, status, query, sort]);

  const counts = React.useMemo(
    () => ({
      all: deals.length,
      open: deals.filter((d) => d.status === "open").length,
      won: deals.filter((d) => d.status === "won").length,
      lost: deals.filter((d) => d.status === "lost").length,
    }),
    [deals],
  );

  const scope = sel.length ? rows.filter((r) => sel.includes(r.id)) : rows;
  const sum = scope.reduce((s, d) => s + d.amount, 0);
  const weighted = scope.reduce((s, d) => s + (d.amount * d.probability) / 100, 0);
  const allChecked = rows.length > 0 && rows.every((r) => sel.includes(r.id));
  const someChecked = rows.some((r) => sel.includes(r.id));

  const header = (key: SortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <TableHead
        align={align}
        aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => setSort({ key, dir: active ? (sort.dir === 1 ? -1 : 1) : 1 })}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 outline-none hover:text-crm-fg focus-visible:text-crm-fg focus-visible:underline",
            active && "text-crm-fg",
          )}
        >
          {label}
          <Icon className="size-3" aria-hidden />
        </button>
      </TableHead>
    );
  };

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-crm border border-crm-border bg-crm-bg font-crm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
        <SegmentedControl
          label="Deal status"
          size="sm"
          value={status}
          onValueChange={(v) => setStatus(v as "all" | DealStatus)}
          options={[
            { value: "open", label: "Open", count: counts.open },
            { value: "won", label: "Won", count: counts.won },
            { value: "lost", label: "Lost", count: counts.lost },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
        <SearchInput
          size="sm"
          value={query}
          onValueChange={setQuery}
          placeholder="Search deal, company, owner"
          aria-label="Search deals"
          className="w-full sm:ml-auto sm:w-64"
        />
      </div>

      {sel.length && bulkActions ? (
        <div className="flex items-center gap-2 border-b border-crm-border bg-crm-card px-3 py-2 text-xs text-crm-soft">
          <span className="text-crm-fg">{sel.length} selected</span>
          <div className="ml-auto flex items-center gap-2">{bulkActions(sel)}</div>
        </div>
      ) : null}

      {error ? (
        <EmptyState
          tone="error"
          icon={<AlertTriangle />}
          title="Couldn't load deals"
          description={error}
        />
      ) : loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={<Briefcase />}
          title={deals.length ? "No deals match" : "No deals yet"}
          description={
            deals.length
              ? "Try another status or clear the search."
              : "Deals you create will appear here."
          }
        />
      ) : (
        <Table aria-label="Deals">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8">
                <Checkbox
                  aria-label="Select all visible deals"
                  checked={allChecked ? true : someChecked ? "indeterminate" : false}
                  onCheckedChange={() =>
                    setSel(
                      allChecked
                        ? sel.filter((id) => !rows.some((r) => r.id === id))
                        : Array.from(new Set([...sel, ...rows.map((r) => r.id)])),
                    )
                  }
                />
              </TableHead>
              {header("name", "Deal")}
              <TableHead>Stage</TableHead>
              {header("amount", "Amount", "right")}
              {header("probability", "Prob.", "right")}
              {header("weighted", "Weighted", "right")}
              {header("closeDate", "Close date")}
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => {
              const checked = sel.includes(d.id);
              const overdue = d.status === "open" && d.closeDate < todayIso;
              const cur = d.currency ?? currency;
              return (
                <TableRow key={d.id} selected={checked}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${d.name}`}
                      checked={checked}
                      onCheckedChange={() =>
                        setSel(checked ? sel.filter((x) => x !== d.id) : [...sel, d.id])
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onOpenDeal?.(d)}
                      className="flex cursor-pointer flex-col text-left outline-none focus-visible:underline"
                    >
                      <span className="font-medium text-crm-fg">{d.name}</span>
                      <span className="text-xs text-crm-subtle">{d.company}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    {d.status === "open" ? (
                      <Tag size="sm" color={stageColors[d.stage] ?? "neutral"}>
                        {d.stage}
                      </Tag>
                    ) : (
                      <Tag size="sm" color={d.status === "won" ? "green" : "red"}>
                        {d.status === "won" ? "Closed won" : "Closed lost"}
                      </Tag>
                    )}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {fmt(d.amount, cur)}
                  </TableCell>
                  <TableCell align="right" className="text-crm-soft tabular-nums">
                    {d.probability}%
                  </TableCell>
                  <TableCell align="right" className="text-crm-soft tabular-nums">
                    {fmt((d.amount * d.probability) / 100, cur)}
                  </TableCell>
                  <TableCell className={cn(overdue && "text-crm-danger")}>
                    {fmtDate(d.closeDate)}
                    {overdue ? <span className="sr-only"> (overdue)</span> : null}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={d.owner} size="xs" />
                      {d.owner}
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
            { label: sel.length ? "selected" : "deals", value: scope.length },
            { label: "total", value: fmt(sum, currency) },
            { label: "weighted", value: fmt(weighted, currency) },
            {
              label: "avg. size",
              value: fmt(scope.length ? sum / scope.length : 0, currency),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
