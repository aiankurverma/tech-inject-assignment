import * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useStore } from "zustand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import {
  scoreMatches,
  ruleFromMatch,
  type BankLine,
  type BookEntry,
  type ReconMatch,
  type ReconRule,
  type Suggestion,
} from "@/components/crm/pro-bank-reconciliation/scorer";
import {
  createReconStore,
  type ReconFilter,
  type ReconState,
} from "@/components/crm/pro-bank-reconciliation/store";
import { LineList, type LineRow } from "@/components/crm/pro-bank-reconciliation/line-list";

export type { BankLine, BookEntry, ReconMatch, ReconRule, Suggestion, ReconFilter };
export { scoreMatches, ruleFromMatch };

export interface ProBankReconciliationProps {
  bankLines: BankLine[];
  bookEntries: BookEntry[];
  /** ISO 4217 code used to format minor-unit amounts. */
  currency?: string;
  locale?: string;
  /** Minor units per major unit (100 for USD/EUR, 1 for JPY). */
  minorUnits?: number;
  matches?: ReconMatch[];
  defaultMatches?: ReconMatch[];
  onMatchesChange?: (matches: ReconMatch[]) => void;
  rules?: ReconRule[];
  defaultRules?: ReconRule[];
  onRulesChange?: (rules: ReconRule[]) => void;
  /** Absolute amount tolerance (minor units) for exact-match and auto-match. */
  tolerance?: number;
  /** Allow matching unbalanced selections; the difference is recorded as an adjustment. */
  allowAdjustments?: boolean;
  /** Max date drift for suggestions, in days. */
  maxDays?: number;
  /** Confidence required by "Accept all" (0..1). */
  autoAcceptThreshold?: number;
  defaultFilter?: ReconFilter;
  loading?: boolean;
  error?: React.ReactNode;
  onRetry?: () => void;
  /** Height of the working area. */
  height?: number | string;
  className?: string;
}

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

function useControllable<T>(
  store: ReturnType<typeof createReconStore>,
  value: T | undefined,
  pick: (s: ReconState) => T,
  push: (v: T) => void,
  onChange?: (v: T) => void,
) {
  const cb = React.useRef(onChange);
  cb.current = onChange;
  React.useEffect(() => {
    if (value !== undefined && value !== pick(store.getState())) push(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(
    () =>
      store.subscribe((s, prev) => {
        const next = pick(s);
        if (next !== pick(prev)) cb.current?.(next);
      }),
    [store], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

const FILTERS: { id: ReconFilter; label: string }[] = [
  { id: "unresolved", label: "Unresolved" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

/**
 * Bank reconciliation workspace: statement vs. ledger in resizable panes, in-house confidence
 * scorer, click / shift-range / drag multi-to-one matching, live difference, rules from matches.
 */
export function ProBankReconciliation({
  bankLines,
  bookEntries,
  currency = "USD",
  locale = "en-US",
  minorUnits = 100,
  matches: matchesProp,
  defaultMatches,
  onMatchesChange,
  rules: rulesProp,
  defaultRules,
  onRulesChange,
  tolerance = 0,
  allowAdjustments = false,
  maxDays = 7,
  autoAcceptThreshold = 0.9,
  defaultFilter = "unresolved",
  loading,
  error,
  onRetry,
  height = 560,
  className,
}: ProBankReconciliationProps) {
  const storeRef = React.useRef<ReturnType<typeof createReconStore>>(null);
  if (!storeRef.current)
    storeRef.current = createReconStore({
      matches: matchesProp ?? defaultMatches ?? [],
      rules: rulesProp ?? defaultRules ?? [],
      filter: defaultFilter,
    });
  const store = storeRef.current;
  useControllable(
    store,
    matchesProp,
    (s) => s.matches,
    store.getState().setMatches,
    onMatchesChange,
  );
  useControllable(store, rulesProp, (s) => s.rules, store.getState().setRules, onRulesChange);

  const matches = useStore(store, (s) => s.matches);
  const rules = useStore(store, (s) => s.rules);
  const selectedBank = useStore(store, (s) => s.selectedBank);
  const selectedBook = useStore(store, (s) => s.selectedBook);
  const filter = useStore(store, (s) => s.filter);
  const query = useStore(store, (s) => s.query);
  const api = store.getState();
  const deferredQuery = React.useDeferredValue(query);
  const [pendingRule, setPendingRule] = React.useState<ReconRule | null>(null);
  const [announce, setAnnounce] = React.useState("");

  const money = React.useMemo(() => {
    const f = new Intl.NumberFormat(locale, { style: "currency", currency });
    return (minor: number) => f.format(minor / minorUnits);
  }, [locale, currency, minorUnits]);

  const bankById = React.useMemo(() => new Map(bankLines.map((b) => [b.id, b])), [bankLines]);
  const bookById = React.useMemo(() => new Map(bookEntries.map((b) => [b.id, b])), [bookEntries]);

  const { matchedBank, matchedBook } = React.useMemo(() => {
    const mb = new Map<string, string>();
    const mk = new Map<string, string>();
    for (const m of matches) {
      for (const id of m.bankIds) mb.set(id, m.id);
      for (const id of m.bookIds) mk.set(id, m.id);
    }
    return { matchedBank: mb, matchedBook: mk };
  }, [matches]);

  const openBank = React.useMemo(
    () => bankLines.filter((b) => !matchedBank.has(b.id)),
    [bankLines, matchedBank],
  );
  const openBook = React.useMemo(
    () => bookEntries.filter((b) => !matchedBook.has(b.id)),
    [bookEntries, matchedBook],
  );

  const suggestions = React.useMemo(
    () => scoreMatches(openBank, openBook, { amountTolerance: tolerance, maxDays, rules }),
    [openBank, openBook, tolerance, maxDays, rules],
  );
  const bestConf = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const [id, list] of suggestions) m.set(id, list[0]!.confidence);
    return m;
  }, [suggestions]);

  const hinted = React.useMemo(() => {
    const s = new Set<string>();
    for (const id of selectedBank) for (const sug of suggestions.get(id) ?? []) s.add(sug.bookId);
    return s;
  }, [selectedBank, suggestions]);

  const visible = React.useCallback(
    <T extends LineRow>(rows: T[], matched: ReadonlyMap<string, string>) => {
      const q = deferredQuery.trim().toLowerCase();
      return rows.filter((r) => {
        const isM = matched.has(r.id);
        if (filter === "unresolved" && isM) return false;
        if (filter === "resolved" && !isM) return false;
        if (!q) return true;
        return (
          r.description.toLowerCase().includes(q) ||
          (r.reference ?? "").toLowerCase().includes(q) ||
          money(r.amount).includes(q)
        );
      });
    },
    [deferredQuery, filter, money],
  );
  const bankRows = React.useMemo(
    () => visible(bankLines, matchedBank),
    [visible, bankLines, matchedBank],
  );
  const bookRows = React.useMemo(
    () => visible(bookEntries, matchedBook),
    [visible, bookEntries, matchedBook],
  );

  const sum = (ids: ReadonlySet<string>, by: Map<string, { amount: number }>) => {
    let t = 0;
    for (const id of ids) t += by.get(id)?.amount ?? 0;
    return t;
  };
  const bankSum = sum(selectedBank, bankById);
  const bookSum = sum(selectedBook, bookById);
  const diff = bankSum - bookSum;
  const balanced = Math.abs(diff) <= tolerance;
  const hasBoth = selectedBank.size > 0 && selectedBook.size > 0;
  const canMatch = hasBoth && (balanced || allowAdjustments);

  const commit = React.useCallback(
    (bankIds: string[], bookIds: string[], kind: ReconMatch["kind"] = "manual") => {
      const b = bankIds.map((id) => bankById.get(id)!).filter(Boolean);
      const k = bookIds.map((id) => bookById.get(id)!).filter(Boolean);
      const d = b.reduce((a, x) => a + x.amount, 0) - k.reduce((a, x) => a + x.amount, 0);
      const m: ReconMatch = {
        id: uid("m"),
        bankIds,
        bookIds,
        kind,
        adjustment: Math.abs(d) <= tolerance ? 0 : d,
        createdAt: new Date().toISOString(),
      };
      store.getState().addMatches([m]);
      setAnnounce(`Matched ${bankIds.length} bank and ${bookIds.length} book lines`);
      if (kind === "manual") setPendingRule(ruleFromMatch(b, k, uid("r")));
    },
    [bankById, bookById, store, tolerance],
  );

  const onCommit = React.useCallback(() => {
    const s = store.getState();
    const b = [...s.selectedBank];
    const k = [...s.selectedBook];
    if (!b.length || !k.length) return;
    const d = sum(s.selectedBank, bankById) - sum(s.selectedBook, bookById);
    if (Math.abs(d) > tolerance && !allowAdjustments) {
      setAnnounce(`Cannot match: difference ${money(d)}`);
      return;
    }
    commit(b, k);
  }, [store, bankById, bookById, tolerance, allowAdjustments, commit, money]);

  const acceptAll = () => {
    const usedBook = new Set<string>();
    const batch: ReconMatch[] = [];
    for (const [bankId, list] of suggestions) {
      const top = list.find((x) => !usedBook.has(x.bookId));
      if (!top || top.confidence < autoAcceptThreshold) continue;
      usedBook.add(top.bookId);
      batch.push({
        id: uid("m"),
        bankIds: [bankId],
        bookIds: [top.bookId],
        kind: top.ruleId ? "rule" : "auto",
        adjustment: (() => {
          const d = bankById.get(bankId)!.amount - bookById.get(top.bookId)!.amount;
          return Math.abs(d) <= tolerance ? 0 : d;
        })(),
        createdAt: new Date().toISOString(),
      });
    }
    if (batch.length) store.getState().addMatches(batch);
    setAnnounce(`Accepted ${batch.length} suggestions`);
  };
  const acceptable = React.useMemo(() => {
    let n = 0;
    for (const list of suggestions.values()) if (list[0]!.confidence >= autoAcceptThreshold) n++;
    return n;
  }, [suggestions, autoAcceptThreshold]);

  const onToggleBank = React.useCallback(
    (id: string, add: boolean) => api.toggle("bank", id, add),
    [api],
  );
  const onToggleBook = React.useCallback(
    (id: string, add: boolean) => api.toggle("book", id, add),
    [api],
  );
  const onRangeBank = React.useCallback(
    (ids: string[]) =>
      api.select(
        "bank",
        ids.filter((i) => !matchedBank.has(i)),
      ),
    [api, matchedBank],
  );
  const onRangeBook = React.useCallback(
    (ids: string[]) =>
      api.select(
        "book",
        ids.filter((i) => !matchedBook.has(i)),
      ),
    [api, matchedBook],
  );

  // Drag bank lines onto a book entry (or vice versa): builds a many-to-one selection and
  // commits straight away when it balances.
  const dropOnBook = React.useCallback(
    (bookId: string, bankIds: string[]) => {
      const s = store.getState();
      const book = new Set(s.selectedBook);
      book.add(bookId);
      s.select("bank", bankIds);
      s.select("book", [...book]);
      const d =
        bankIds.reduce((a, i) => a + (bankById.get(i)?.amount ?? 0), 0) - sum(book, bookById);
      if (Math.abs(d) <= tolerance) commit(bankIds, [...book]);
    },
    [store, bankById, bookById, tolerance, commit],
  );
  const dropOnBank = React.useCallback(
    (bankId: string, bookIds: string[]) => {
      const s = store.getState();
      const bank = new Set(s.selectedBank);
      bank.add(bankId);
      s.select("book", bookIds);
      s.select("bank", [...bank]);
      const d =
        sum(bank, bankById) - bookIds.reduce((a, i) => a + (bookById.get(i)?.amount ?? 0), 0);
      if (Math.abs(d) <= tolerance) commit([...bank], bookIds);
    },
    [store, bankById, bookById, tolerance, commit],
  );

  const lastMatch = matches[matches.length - 1];
  const resolvedPct = bankLines.length
    ? Math.round((matchedBank.size / bankLines.length) * 100)
    : 0;

  if (error) {
    return (
      <div
        role="alert"
        className={cn("rounded-crm border border-crm-border bg-crm-card p-6 text-sm", className)}
      >
        <p className="font-medium text-crm-danger">Could not load reconciliation data</p>
        <p className="mt-1 text-crm-muted-fg">{error}</p>
        {onRetry && (
          <Button className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2">
        <div
          role="radiogroup"
          aria-label="Filter lines"
          className="flex rounded-full bg-crm-muted p-0.5"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => api.setFilter(f.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                filter === f.id
                  ? "bg-crm-raised text-crm-fg shadow-crm-raised"
                  : "text-crm-muted-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => api.setQuery(e.target.value)}
          placeholder="Search description, reference, amount"
          aria-label="Search lines"
          className="h-7 min-w-40 flex-1 rounded-full border border-crm-input bg-crm-bg px-3 text-xs text-crm-fg outline-none placeholder:text-crm-muted-fg focus-visible:ring-2 focus-visible:ring-crm-ring"
        />
        <div className="flex items-center gap-2 text-xs text-crm-muted-fg">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-crm-track" aria-hidden>
            <div className="h-full bg-crm-success" style={{ width: `${resolvedPct}%` }} />
          </div>
          <span>{resolvedPct}% reconciled</span>
        </div>
        <Button
          size="sm"
          variant="primary"
          disabled={!acceptable || loading}
          onClick={acceptAll}
          title={`Accept every suggestion at or above ${Math.round(autoAcceptThreshold * 100)}%`}
        >
          Accept {acceptable.toLocaleString()} suggestions
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!lastMatch}
          onClick={() => lastMatch && api.unmatch(lastMatch.id)}
        >
          Undo last
        </Button>
      </div>

      <div style={{ height }} className="min-h-0">
        <Group orientation="horizontal" className="h-full">
          <Panel defaultSize="50%" minSize="25%">
            <LineList
              side="bank"
              title="Bank statement"
              rows={bankRows}
              total={bankLines.length}
              selected={selectedBank}
              matched={matchedBank}
              confidence={bestConf}
              formatMoney={money}
              onToggle={onToggleBank}
              onRange={onRangeBank}
              onCommit={onCommit}
              onDropFromOther={dropOnBank}
              loading={loading}
              emptyText={
                filter === "unresolved" ? "Every statement line is reconciled." : "No lines match."
              }
            />
          </Panel>
          <Separator className="w-1.5 bg-crm-border outline-none transition-colors hover:bg-crm-primary/60 focus-visible:bg-crm-primary data-[separator=active]:bg-crm-primary" />
          <Panel defaultSize="50%" minSize="25%">
            <LineList
              side="book"
              title="Books"
              rows={bookRows}
              total={bookEntries.length}
              selected={selectedBook}
              matched={matchedBook}
              hinted={hinted}
              formatMoney={money}
              onToggle={onToggleBook}
              onRange={onRangeBook}
              onCommit={onCommit}
              onDropFromOther={dropOnBook}
              loading={loading}
              emptyText={filter === "unresolved" ? "No open ledger entries." : "No entries match."}
            />
          </Panel>
        </Group>
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-crm-border bg-crm-card px-3 py-2 text-xs">
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          <div className="flex gap-1.5">
            <dt className="text-crm-muted-fg">Bank</dt>
            <dd className="tabular-nums">{money(bankSum)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-crm-muted-fg">Books</dt>
            <dd className="tabular-nums">{money(bookSum)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-crm-muted-fg">Difference</dt>
            <dd
              aria-live="polite"
              className={cn(
                "font-medium tabular-nums",
                !hasBoth ? "text-crm-muted-fg" : balanced ? "text-crm-success" : "text-crm-warning",
              )}
            >
              {money(diff)}
            </dd>
          </div>
        </dl>
        {selectedBank.size > 0 && suggestions.get([...selectedBank][0]!)?.[0] && (
          <span className="text-crm-muted-fg">
            Suggested:{" "}
            {suggestions
              .get([...selectedBank][0]!)!
              .map(
                (s) =>
                  `${bookById.get(s.bookId)?.description} (${Math.round(s.confidence * 100)}%)`,
              )
              .join(", ")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {pendingRule && (
            <>
              <span className="text-crm-muted-fg">Rule {pendingRule.name}?</span>
              <Button
                size="sm"
                onClick={() => {
                  api.addRule(pendingRule);
                  setPendingRule(null);
                  setAnnounce(`Rule ${pendingRule.name} created`);
                }}
              >
                Create rule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingRule(null)}>
                Dismiss
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={!selectedBank.size && !selectedBook.size}
            onClick={api.clearSelection}
          >
            Clear
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!canMatch}
            onClick={onCommit}
            aria-keyshortcuts="Enter"
          >
            {hasBoth && !balanced ? `Match with ${money(diff)} adjustment` : "Match"}
          </Button>
        </div>
      </footer>
      {rules.length > 0 && (
        <ul
          aria-label="Matching rules"
          className="flex flex-wrap gap-1.5 border-t border-crm-border px-3 py-2 text-xs"
        >
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-1 rounded-full bg-crm-muted py-0.5 pr-1 pl-2.5 text-crm-chip"
            >
              {r.name}
              <button
                type="button"
                aria-label={`Remove rule ${r.name}`}
                onClick={() => api.removeRule(r.id)}
                className="grid size-4 place-items-center rounded-full hover:bg-crm-raised"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
