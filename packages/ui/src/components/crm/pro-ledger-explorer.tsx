import * as React from "react";
import { format } from "date-fns";
import { Download, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Sheet, SheetContent, SheetSection } from "@/components/crm/sheet";
import { AccountTree } from "@/components/crm/pro-ledger-explorer/account-tree";
import { JournalGrid } from "@/components/crm/pro-ledger-explorer/journal-grid";
import {
  buildLines,
  downloadText,
  expandSelection,
  groupLines,
  linesToCsv,
  type GroupBy,
  type JournalEntry,
  type JournalLine,
  type LedgerAccount,
} from "@/components/crm/pro-ledger-explorer/ledger-model";

export type {
  AccountType,
  GroupBy,
  JournalEntry,
  JournalLine,
  LedgerAccount,
  LedgerPosting,
} from "@/components/crm/pro-ledger-explorer/ledger-model";

export interface ProLedgerExplorerProps {
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  /** ISO currency for amounts (amounts are integer minor units). */
  currency?: string;
  locale?: string;
  /** Controlled account filter (ids; descendants are included automatically). */
  selectedAccounts?: string[];
  defaultSelectedAccounts?: string[];
  onSelectedAccountsChange?: (ids: string[]) => void;
  groupBy?: GroupBy;
  defaultGroupBy?: GroupBy;
  onGroupByChange?: (g: GroupBy) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Viewport height of the journal grid in px. */
  height?: number;
  exportFileName?: string;
  className?: string;
}

function useControllable<T>(value: T | undefined, initial: T, onChange?: (v: T) => void) {
  const [inner, setInner] = React.useState(initial);
  const current = value !== undefined ? value : inner;
  const set = React.useCallback(
    (v: T) => {
      if (value === undefined) setInner(v);
      onChange?.(v);
    },
    [value, onChange],
  );
  return [current, set] as const;
}

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "account", label: "Account" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

/**
 * Double-entry ledger explorer: virtualised journal (100k+ lines) with debit / credit /
 * running balance, chart-of-accounts tree filter, grouping by account or period with
 * subtotals, a postings drawer per entry, and CSV export of the filtered view.
 */
export function ProLedgerExplorer({
  accounts,
  entries,
  currency = "USD",
  locale = "en-US",
  selectedAccounts,
  defaultSelectedAccounts = [],
  onSelectedAccountsChange,
  groupBy: groupByProp,
  defaultGroupBy = "none",
  onGroupByChange,
  loading,
  error,
  onRetry,
  height = 520,
  exportFileName = "ledger.csv",
  className,
}: ProLedgerExplorerProps) {
  const [selected, setSelected] = useControllable(
    selectedAccounts,
    defaultSelectedAccounts,
    onSelectedAccountsChange,
  );
  const [groupBy, setGroupBy] = useControllable(groupByProp, defaultGroupBy, onGroupByChange);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [active, setActive] = React.useState<JournalLine | null>(null);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const accountsById = React.useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const include = React.useMemo(
    () => expandSelection(accounts, selectedSet),
    [accounts, selectedSet],
  );
  const allLines = React.useMemo(
    () => buildLines(entries, accountsById, include),
    [entries, accountsById, include],
  );
  const lines = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return allLines;
    return allLines.filter(
      (l) =>
        l.entry.reference.toLowerCase().includes(q) ||
        l.entry.description.toLowerCase().includes(q) ||
        (l.memo?.toLowerCase().includes(q) ?? false),
    );
  }, [allLines, deferredQuery]);
  const rows = React.useMemo(
    () => groupLines(lines, groupBy, collapsed),
    [lines, groupBy, collapsed],
  );
  const totals = React.useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      debit += l.debit;
      credit += l.credit;
    }
    return { debit, credit };
  }, [lines]);

  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2 }),
    [locale, currency],
  );
  const formatMoney = React.useCallback((minor: number) => money.format(minor / 100), [money]);
  const toggleGroup = React.useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const balanced = totals.debit === totals.credit;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-bg p-4 text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">General ledger</h2>
          <p className="text-xs text-crm-muted-fg">
            {lines.length.toLocaleString(locale)} postings · {entries.length.toLocaleString(locale)}{" "}
            entries
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reference or memo"
          aria-label="Search journal"
          className="h-8 w-52 rounded-crm border border-crm-border bg-crm-input px-2.5 text-xs placeholder:text-crm-muted-fg focus:outline-none focus:ring-2 focus:ring-crm-ring"
        />
        <label className="flex items-center gap-1.5 text-xs text-crm-muted-fg">
          Group by
          <select
            value={groupBy}
            onChange={(e) => {
              setCollapsed(new Set());
              setGroupBy(e.target.value as GroupBy);
            }}
            className="h-8 rounded-crm border border-crm-border bg-crm-input px-2 text-xs text-crm-fg focus:outline-none focus:ring-2 focus:ring-crm-ring"
          >
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="md"
          disabled={!lines.length}
          onClick={() => downloadText(exportFileName, linesToCsv(lines))}
        >
          <Download className="size-3.5" /> Export CSV
        </Button>
      </header>

      <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside aria-label="Chart of accounts" className="min-w-0">
          <AccountTree
            accounts={accounts}
            selected={selectedSet}
            onSelectedChange={(ids) => setSelected([...ids])}
            height={height - 40}
          />
        </aside>
        <section className="min-w-0">
          {error ? (
            <div
              role="alert"
              className="grid place-items-center gap-2 rounded-crm border border-crm-danger/40 bg-crm-danger/10 p-8 text-sm"
              style={{ height }}
            >
              <p className="text-crm-danger">{error}</p>
              {onRetry && <Button onClick={onRetry}>Retry</Button>}
            </div>
          ) : loading ? (
            <div
              aria-busy="true"
              className="space-y-1.5 rounded-crm border border-crm-border p-3"
              style={{ height }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-crm-muted" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div
              className="grid place-items-center rounded-crm border border-dashed border-crm-border text-sm text-crm-muted-fg"
              style={{ height }}
            >
              No postings match these filters.
            </div>
          ) : (
            <JournalGrid
              rows={rows}
              formatMoney={formatMoney}
              height={height}
              collapsed={collapsed}
              onToggleGroup={toggleGroup}
              onOpenLine={setActive}
              activeKey={active?.key}
            />
          )}
          <footer className="mt-2 flex flex-wrap items-center gap-4 text-xs tabular-nums text-crm-muted-fg">
            <span>
              Debits <strong className="text-crm-fg">{formatMoney(totals.debit)}</strong>
            </span>
            <span>
              Credits <strong className="text-crm-fg">{formatMoney(totals.credit)}</strong>
            </span>
            <span
              className={cn(
                "ml-auto flex items-center gap-1",
                balanced ? "text-crm-success" : "text-crm-warning",
              )}
            >
              <Scale className="size-3.5" />
              {balanced
                ? "Balanced"
                : `Net ${formatMoney(totals.debit - totals.credit)} (filtered view)`}
            </span>
          </footer>
        </section>
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        {active && (
          <SheetContent side="right" title={`Entry ${active.entry.reference}`}>
            <SheetSection title="Entry">
              <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-xs">
                <dt className="text-crm-muted-fg">Date</dt>
                <dd>{format(active.date, "EEEE, dd MMM yyyy")}</dd>
                <dt className="text-crm-muted-fg">Description</dt>
                <dd>{active.entry.description}</dd>
                {active.entry.source && (
                  <>
                    <dt className="text-crm-muted-fg">Source</dt>
                    <dd>{active.entry.source}</dd>
                  </>
                )}
              </dl>
            </SheetSection>
            <SheetSection title="Postings">
              <table className="w-full text-xs">
                <thead className="text-left text-crm-muted-fg">
                  <tr>
                    <th className="py-1 font-medium">Account</th>
                    <th className="py-1 text-right font-medium">Debit</th>
                    <th className="py-1 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {active.entry.postings.map((p, i) => {
                    const a = accountsById.get(p.accountId);
                    return (
                      <tr
                        key={i}
                        className={cn(
                          "border-t border-crm-border",
                          p.accountId === active.account.id && "bg-crm-primary/10",
                        )}
                      >
                        <td className="py-1.5">
                          <span className="font-mono text-crm-faint">{a?.code}</span>{" "}
                          {a?.name ?? p.accountId}
                          {p.memo && <div className="text-crm-muted-fg">{p.memo}</div>}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {p.debit ? formatMoney(p.debit) : ""}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {p.credit ? formatMoney(p.credit) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const d = active.entry.postings.reduce((s, p) => s + p.debit, 0);
                    const c = active.entry.postings.reduce((s, p) => s + p.credit, 0);
                    return (
                      <tr className="border-t border-crm-border font-medium">
                        <td className="py-1.5">{d === c ? "Balanced" : "Out of balance"}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatMoney(d)}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatMoney(c)}</td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </SheetSection>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
