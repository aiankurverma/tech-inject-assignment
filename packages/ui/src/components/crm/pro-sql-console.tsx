import * as React from "react";
import Papa from "papaparse";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { EditorView } from "@codemirror/view";
import {
  AlertTriangle,
  Database,
  Download,
  History,
  Loader2,
  Play,
  Plus,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { indexSchema } from "@/components/crm/pro-sql-console/sql-analysis";
import {
  SqlEditor,
  runTargetOf,
  type RunTarget,
} from "@/components/crm/pro-sql-console/sql-editor";
import { ResultGrid, formatCell } from "@/components/crm/pro-sql-console/result-grid";
import { SchemaTree } from "@/components/crm/pro-sql-console/schema-tree";
import { QueryHistory } from "@/components/crm/pro-sql-console/query-history";
import type {
  HistoryEntry,
  QueryResult,
  QueryTab,
  RunQuery,
  SqlTable,
} from "@/components/crm/pro-sql-console/types";
import { useSqlConsole } from "@/hooks/use-sql-console";

export type * from "@/components/crm/pro-sql-console/types";
export { createQueryTab, useSqlConsole } from "@/hooks/use-sql-console";
export {
  tokenize,
  splitStatements,
  statementAt,
} from "@/components/crm/pro-sql-console/sql-language";

export interface ProSqlConsoleProps {
  /** Tables and columns that drive autocomplete, lint and the schema browser. */
  schema: SqlTable[];
  /** Executes SQL. Reject with `{ message, position? }` to show an error; honour `signal` to cancel. */
  onRun: RunQuery;
  tabs?: QueryTab[];
  defaultTabs?: QueryTab[];
  onTabsChange?: (tabs: QueryTab[]) => void;
  /** Persist history in localStorage under this key. */
  historyKey?: string;
  defaultHistory?: HistoryEntry[];
  /** Override CSV export (e.g. server-side export of the full result). */
  onExport?: (result: QueryResult, rows: unknown[][]) => void;
  schemaLoading?: boolean;
  readOnly?: boolean;
  /** Hide the schema/history sidebar. */
  hideSidebar?: boolean;
  /** Pixel height of the whole console. */
  height?: number | string;
  className?: string;
}

const num = new Intl.NumberFormat("en-US");

function downloadCsv(result: QueryResult, rows: unknown[][], name: string) {
  const csv = Papa.unparse({
    fields: result.columns.map((c) => c.name),
    data: rows.map((r) =>
      r.map((v) => (v == null ? "" : typeof v === "object" ? formatCell(v) : v)),
    ),
  });
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w-]+/g, "_") || "query"}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Elapsed({ since }: { since?: number }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{((now - (since ?? now)) / 1000).toFixed(1)}s</span>;
}

const iconBtn =
  "inline-flex items-center justify-center rounded-crm text-crm-subtle hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crm-ring disabled:pointer-events-none disabled:opacity-40";

/**
 * Pro SQL console: multi-tab CodeMirror editor with schema-aware completion and lint, run
 * selection/statement/all, cancellable runs, searchable history, a virtualised sortable and
 * resizable result grid, and CSV export. Engine-agnostic: bring your own `onRun`.
 */
export function ProSqlConsole({
  schema,
  onRun,
  tabs: tabsProp,
  defaultTabs,
  onTabsChange,
  historyKey,
  defaultHistory,
  onExport,
  schemaLoading,
  readOnly,
  hideSidebar,
  height = 640,
  className,
}: ProSqlConsoleProps) {
  const sql = useSqlConsole({
    onRun,
    tabs: tabsProp,
    defaultTabs,
    onTabsChange,
    historyKey,
    defaultHistory,
  });
  const { tabs, active, activeId } = sql;
  const index = React.useMemo(() => indexSchema(schema), [schema]);
  const viewRef = React.useRef<EditorView | null>(null);
  const [sidebar, setSidebar] = React.useState<"schema" | "history">("schema");
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const sortedRows = React.useRef<unknown[][]>([]);

  const runTarget = React.useCallback(
    (target: RunTarget) => {
      if (!readOnly && activeId) void sql.run(activeId, target.sql, target.from);
    },
    [activeId, readOnly, sql],
  );
  const runFromView = (all: boolean) => {
    const view = viewRef.current;
    if (view) runTarget(runTargetOf(view, all));
    else if (active) runTarget({ sql: active.sql, from: 0 });
  };

  const insert = React.useCallback((text: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }, []);

  const jumpToError = () => {
    const view = viewRef.current;
    const pos = active?.error?.position;
    if (!view || pos == null) return;
    const at = Math.min(view.state.doc.length, (active?.ranFrom ?? 0) + pos);
    view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
    view.focus();
  };

  const onTabKeyDown = (e: React.KeyboardEvent, i: number) => {
    const go = (j: number) => {
      const t = tabs[(j + tabs.length) % tabs.length];
      if (!t) return;
      sql.setActiveId(t.id);
      document.getElementById(`kb-sql-tab-${t.id}`)?.focus();
    };
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(tabs.length - 1);
    else if (e.key === "Delete" && tabs[i]) sql.closeTab(tabs[i].id);
    else if (e.key === "F2" && tabs[i]) setRenaming(tabs[i].id);
    else return;
    e.preventDefault();
  };

  const result = active?.result;
  const running = active?.status === "running";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg text-crm-fg shadow-crm-raised",
        className,
      )}
      style={{ height }}
    >
      <Group orientation="horizontal" className="min-h-0 flex-1">
        {!hideSidebar && (
          <>
            <Panel
              defaultSize="22"
              minSize="14"
              maxSize="40"
              collapsible
              className="flex flex-col bg-crm-card"
            >
              <div
                role="tablist"
                aria-label="Sidebar"
                className="flex border-b border-crm-border px-1"
              >
                {(
                  [
                    ["schema", "Schema", Database],
                    ["history", "History", History],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={sidebar === id}
                    onClick={() => setSidebar(id)}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-crm-ring",
                      sidebar === id
                        ? "border-crm-primary text-crm-fg"
                        : "border-transparent text-crm-subtle hover:text-crm-soft",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {label}
                    {id === "history" && sql.history.length > 0 && (
                      <span className="rounded-full bg-crm-muted px-1.5 text-[10px] tabular-nums text-crm-soft">
                        {sql.history.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div role="tabpanel" className="min-h-0 flex-1">
                {sidebar === "schema" ? (
                  <SchemaTree tables={schema} onInsert={insert} loading={schemaLoading} />
                ) : (
                  <QueryHistory
                    entries={sql.history}
                    onClear={sql.clearHistory}
                    onSelect={(e, newTab) => {
                      if (newTab || !active) sql.addTab({ sql: e.sql });
                      else sql.patch(active.id, { sql: e.sql });
                    }}
                  />
                )}
              </div>
            </Panel>
            <Separator className="w-px bg-crm-border outline-none transition-colors hover:bg-crm-primary focus-visible:bg-crm-primary data-[separator=active]:bg-crm-primary" />
          </>
        )}
        <Panel minSize="40" className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1 border-b border-crm-border bg-crm-card pr-2">
            <div
              role="tablist"
              aria-label="Query tabs"
              className="flex min-w-0 flex-1 overflow-x-auto"
            >
              {tabs.map((t, i) => {
                const selected = t.id === activeId;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "group flex shrink-0 items-center border-r border-crm-border text-xs",
                      selected ? "bg-crm-bg text-crm-fg" : "text-crm-subtle hover:text-crm-soft",
                    )}
                  >
                    {renaming === t.id ? (
                      <input
                        autoFocus
                        defaultValue={t.title}
                        aria-label="Tab name"
                        onBlur={(e) => {
                          sql.patch(t.id, { title: e.target.value.trim() || t.title });
                          setRenaming(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        className="mx-2 h-6 w-28 rounded border border-crm-border bg-crm-input px-1 text-xs text-crm-fg outline-none"
                      />
                    ) : (
                      <button
                        id={`kb-sql-tab-${t.id}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls="kb-sql-tabpanel"
                        tabIndex={selected ? 0 : -1}
                        onClick={() => sql.setActiveId(t.id)}
                        onDoubleClick={() => setRenaming(t.id)}
                        onKeyDown={(e) => onTabKeyDown(e, i)}
                        title="Double-click or F2 to rename"
                        className="flex h-9 items-center gap-1.5 pl-3 pr-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-crm-ring"
                      >
                        {t.status === "running" ? (
                          <Loader2
                            className="size-3 animate-spin text-crm-primary"
                            aria-label="Running"
                          />
                        ) : t.status === "error" ? (
                          <span
                            className="size-1.5 rounded-full bg-crm-danger"
                            aria-label="Error"
                          />
                        ) : null}
                        <span className="max-w-[140px] truncate">{t.title}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Close ${t.title}`}
                      tabIndex={-1}
                      onClick={() => sql.closeTab(t.id)}
                      className={cn(
                        iconBtn,
                        "mr-1 size-5 opacity-0 group-hover:opacity-100",
                        selected && "opacity-60",
                      )}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                aria-label="New query tab"
                onClick={() => sql.addTab()}
                className={cn(iconBtn, "m-1.5 size-6 shrink-0")}
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {running ? (
              <button
                type="button"
                onClick={() => active && sql.cancel(active.id)}
                className="inline-flex h-7 items-center gap-1.5 rounded-crm border border-crm-border px-2.5 text-xs text-crm-danger hover:bg-crm-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crm-ring"
              >
                <Square className="size-3 fill-current" /> Cancel
              </button>
            ) : (
              <button
                type="button"
                disabled={readOnly || !active?.sql.trim()}
                onClick={() => runFromView(false)}
                title="Run selection or current statement (Ctrl/Cmd+Enter). Shift adds all statements."
                className="inline-flex h-7 items-center gap-1.5 rounded-crm bg-crm-primary px-2.5 text-xs font-medium text-crm-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-40"
              >
                <Play className="size-3 fill-current" /> Run
                <kbd className="ml-1 hidden font-sans text-[10px] opacity-70 sm:inline">⌘↵</kbd>
              </button>
            )}
          </div>

          <Group
            orientation="vertical"
            className="min-h-0 flex-1"
            id="kb-sql-tabpanel"
            role="tabpanel"
          >
            <Panel defaultSize="45" minSize="15" className="min-h-0">
              {active && (
                <SqlEditor
                  key={active.id}
                  value={active.sql}
                  onChange={(v) => sql.patch(active.id, { sql: v })}
                  schema={index}
                  onRun={runTarget}
                  readOnly={readOnly}
                  onViewChange={(v) => {
                    viewRef.current = v;
                  }}
                  className="h-full"
                />
              )}
            </Panel>
            <Separator className="h-px bg-crm-border outline-none transition-colors hover:bg-crm-primary focus-visible:bg-crm-primary data-[separator=active]:bg-crm-primary" />
            <Panel minSize="15" className="flex min-h-0 flex-col">
              <div className="flex h-8 shrink-0 items-center gap-3 border-b border-crm-border bg-crm-card px-3 text-[11px] text-crm-subtle">
                <span aria-live="polite" className="flex items-center gap-2">
                  {running ? (
                    <>
                      <Loader2 className="size-3 animate-spin text-crm-primary" /> Running…{" "}
                      <Elapsed since={active?.startedAt} />
                    </>
                  ) : active?.status === "error" ? (
                    <span className="text-crm-danger">Failed</span>
                  ) : result ? (
                    <>
                      <span className="text-crm-soft">
                        {num.format(result.rowCount ?? result.rows.length)} rows
                      </span>
                      {result.durationMs != null && <span>{num.format(result.durationMs)} ms</span>}
                      {result.notice && <span className="text-crm-warning">{result.notice}</span>}
                    </>
                  ) : (
                    "No results yet"
                  )}
                </span>
                {result && result.columns.length > 0 && !running && (
                  <button
                    type="button"
                    onClick={() =>
                      onExport
                        ? onExport(result, sortedRows.current)
                        : downloadCsv(result, sortedRows.current, active?.title ?? "query")
                    }
                    className={cn(iconBtn, "ml-auto h-6 gap-1 px-2 text-[11px]")}
                  >
                    <Download className="size-3" /> CSV
                  </button>
                )}
              </div>
              <div className="relative min-h-0 flex-1">
                {active?.status === "error" && active.error ? (
                  <div
                    role="alert"
                    className="m-3 flex gap-2 rounded-crm border border-crm-danger/40 bg-crm-danger/10 p-3 text-xs"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-crm-danger" aria-hidden />
                    <div className="min-w-0 space-y-1.5">
                      <p className="whitespace-pre-wrap break-words font-mono text-crm-fg">
                        {active.error.message}
                      </p>
                      {active.error.position != null && (
                        <button
                          type="button"
                          onClick={jumpToError}
                          className="text-crm-danger underline-offset-2 hover:underline"
                        >
                          Go to position {active.error.position + 1}
                        </button>
                      )}
                    </div>
                  </div>
                ) : result ? (
                  <ResultGrid
                    result={result}
                    className={cn(running && "opacity-50")}
                    onSortedRowsChange={(rows) => {
                      sortedRows.current = rows;
                    }}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-crm-subtle">
                    {running ? (
                      <Loader2
                        className="size-4 animate-spin text-crm-primary"
                        aria-label="Running"
                      />
                    ) : (
                      <>
                        <span>Run a query to see results</span>
                        <span className="text-crm-faint">
                          Ctrl/Cmd+Enter runs the statement under the cursor · Shift adds all
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
