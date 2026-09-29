import * as React from "react";
import type {
  HistoryEntry,
  QueryError,
  QueryTab,
  RunQuery,
} from "@/components/crm/pro-sql-console/types";

const uid = () => Math.random().toString(36).slice(2, 10);

export function createQueryTab(partial: Partial<QueryTab> = {}): QueryTab {
  return { id: uid(), title: "Untitled", sql: "", status: "idle", ...partial };
}

function toQueryError(err: unknown): QueryError {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as { message: unknown; position?: unknown };
    return {
      message: String(e.message),
      position: typeof e.position === "number" ? e.position : undefined,
    };
  }
  return { message: String(err) };
}

function readHistory(key: string | undefined): HistoryEntry[] {
  if (!key) return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export interface UseSqlConsoleOptions {
  onRun: RunQuery;
  /** Controlled tabs. Pair with `onTabsChange`. */
  tabs?: QueryTab[];
  defaultTabs?: QueryTab[];
  onTabsChange?: (tabs: QueryTab[]) => void;
  /** Persist history in localStorage under this key. Omit to keep it in memory. */
  historyKey?: string;
  historyLimit?: number;
  defaultHistory?: HistoryEntry[];
}

/**
 * Tab, run and history state for the SQL console. Every tab runs independently with its own
 * AbortController, so switching tabs never cancels a query and a re-run cancels the stale one.
 */
export function useSqlConsole({
  onRun,
  tabs: tabsProp,
  defaultTabs,
  onTabsChange,
  historyKey,
  historyLimit = 200,
  defaultHistory,
}: UseSqlConsoleOptions) {
  const [inner, setInner] = React.useState<QueryTab[]>(() =>
    defaultTabs?.length ? defaultTabs : [createQueryTab({ title: "Query 1" })],
  );
  const tabs = tabsProp ?? inner;
  const tabsRef = React.useRef(tabs);
  tabsRef.current = tabs;
  const onTabsChangeRef = React.useRef(onTabsChange);
  onTabsChangeRef.current = onTabsChange;

  const setTabs = React.useCallback(
    (update: (prev: QueryTab[]) => QueryTab[]) => {
      const next = update(tabsRef.current);
      tabsRef.current = next;
      if (tabsProp === undefined) setInner(next);
      onTabsChangeRef.current?.(next);
    },
    [tabsProp],
  );

  const [activeId, setActiveId] = React.useState(() => tabs[0]?.id ?? "");
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const [history, setHistory] = React.useState<HistoryEntry[]>(
    () => defaultHistory ?? readHistory(historyKey),
  );
  React.useEffect(() => {
    if (!historyKey) return;
    try {
      window.localStorage.setItem(historyKey, JSON.stringify(history));
    } catch {
      /* storage unavailable (private mode, quota) - history stays in memory */
    }
  }, [history, historyKey]);

  const controllers = React.useRef(new Map<string, AbortController>());
  React.useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  const patch = React.useCallback(
    (id: string, p: Partial<QueryTab>) =>
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t))),
    [setTabs],
  );

  const runRef = React.useRef(onRun);
  runRef.current = onRun;

  const run = React.useCallback(
    async (tabId: string, sql: string, from = 0) => {
      const text = sql.trim();
      if (!text) return;
      controllers.current.get(tabId)?.abort();
      const ctrl = new AbortController();
      controllers.current.set(tabId, ctrl);
      const startedAt = performance.now();
      patch(tabId, { status: "running", error: undefined, ranFrom: from, startedAt: Date.now() });
      const record = (e: Omit<HistoryEntry, "id" | "sql" | "at">) =>
        setHistory((h) =>
          [{ id: uid(), sql: text, at: Date.now(), ...e }, ...h].slice(0, historyLimit),
        );
      try {
        const result = await runRef.current(sql, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        const durationMs = result.durationMs ?? Math.round(performance.now() - startedAt);
        patch(tabId, { status: "success", result: { ...result, durationMs } });
        record({ ok: true, durationMs, rowCount: result.rowCount ?? result.rows.length });
      } catch (err) {
        if (ctrl.signal.aborted) {
          patch(tabId, { status: "error", error: { message: "Query cancelled" } });
          return;
        }
        patch(tabId, { status: "error", error: toQueryError(err) });
        record({ ok: false, durationMs: Math.round(performance.now() - startedAt) });
      } finally {
        if (controllers.current.get(tabId) === ctrl) controllers.current.delete(tabId);
      }
    },
    [patch, historyLimit],
  );

  const cancel = React.useCallback((tabId: string) => {
    controllers.current.get(tabId)?.abort();
  }, []);

  const addTab = React.useCallback(
    (partial?: Partial<QueryTab>) => {
      const n = tabsRef.current.length + 1;
      const tab = createQueryTab({ title: `Query ${n}`, ...partial });
      setTabs((prev) => [...prev, tab]);
      setActiveId(tab.id);
      return tab;
    },
    [setTabs],
  );

  const closeTab = React.useCallback(
    (id: string) => {
      controllers.current.get(id)?.abort();
      const prev = tabsRef.current;
      const idx = prev.findIndex((t) => t.id === id);
      const rest = prev.filter((t) => t.id !== id);
      const next = rest.length ? rest : [createQueryTab({ title: "Query 1" })];
      setTabs(() => next);
      setActiveId((cur) => (cur === id ? (next[Math.min(idx, next.length - 1)]?.id ?? "") : cur));
    },
    [setTabs],
  );

  return {
    tabs,
    active,
    activeId: active?.id ?? "",
    setActiveId,
    patch,
    run,
    cancel,
    addTab,
    closeTab,
    history,
    clearHistory: React.useCallback(() => setHistory([]), []),
  };
}
