import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useHotkeys } from "react-hotkeys-hook";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowDownToLine,
  CaseSensitive,
  Filter,
  Pause,
  Play,
  Regex,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LOG_LEVELS,
  compileSearch,
  useLogIndex,
  type LogEntry,
  type LogLevel,
} from "@/hooks/use-log-index";
import { LogRow, levelTone } from "@/components/crm/pro-log-explorer/log-row";
import { LogHistogram } from "@/components/crm/pro-log-explorer/log-histogram";

export type { LogEntry, LogLevel };

export interface ProLogExplorerProps {
  /** Append-only log buffer (oldest first). Pass a new array reference when lines arrive. */
  logs: readonly LogEntry[];
  title?: string;
  /** Controlled live state. When paused the view is frozen and new lines are buffered. */
  live?: boolean;
  defaultLive?: boolean;
  onLiveChange?: (live: boolean) => void;
  /** Initially visible levels (uncontrolled). */
  defaultLevels?: LogLevel[];
  /** Line to focus on mount (e.g. from a permalink). Defaults to `#log-<id>` in location.hash. */
  initialLineId?: string;
  /** Called with the line id; default copies `<url>#log-<id>` to the clipboard. */
  onPermalink?: (id: string) => void;
  /** Show the source column (service / pod). */
  showSource?: boolean;
  histogramBuckets?: number;
  height?: number | string;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

const ROW = 20;

/**
 * Virtualised log explorer for 100k+ lines: live tail with follow/pause, ANSI colours, level facets
 * with counts, literal/regex search with highlighting, brushable volume histogram, JSON field
 * expansion and permalinks. Keyboard: / search, j/k move, Enter expand, f follow, space pause,
 * g / G top / bottom, Esc clear.
 */
export function ProLogExplorer({
  logs,
  title = "Logs",
  live: liveProp,
  defaultLive = true,
  onLiveChange,
  defaultLevels = ["debug", "info", "warn", "error", "fatal"],
  initialLineId,
  onPermalink,
  showSource = true,
  histogramBuckets = 60,
  height = 520,
  loading,
  error,
  className,
}: ProLogExplorerProps) {
  const [innerLive, setInnerLive] = React.useState(defaultLive);
  const live = liveProp ?? innerLive;
  const setLive = (v: boolean) => {
    if (liveProp === undefined) setInnerLive(v);
    onLiveChange?.(v);
  };

  // Frozen snapshot while paused: keep the length at pause time (buffer is append-only).
  const [frozenAt, setFrozenAt] = React.useState<number | null>(null);
  if (!live && frozenAt === null) setFrozenAt(logs.length);
  if (live && frozenAt !== null) setFrozenAt(null);
  const view = React.useMemo(
    () => (frozenAt === null ? logs : logs.slice(0, frozenAt)),
    [logs, frozenAt],
  );
  const buffered = frozenAt === null ? 0 : logs.length - frozenAt;

  const [levels, setLevels] = React.useState<Set<LogLevel>>(() => new Set(defaultLevels));
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [regex, setRegex] = React.useState(false);
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const [filterBySearch, setFilterBySearch] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<[number, number] | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [follow, setFollow] = React.useState(true);
  const [toast, setToast] = React.useState<string | null>(null);

  const { re, error: searchError } = React.useMemo(
    () => compileSearch({ query: deferredQuery, regex, caseSensitive }),
    [deferredQuery, regex, caseSensitive],
  );
  const index = useLogIndex(view, {
    levels,
    search: re,
    filterBySearch,
    range: timeRange,
    buckets: histogramBuckets,
  });
  const { rows, counts, histogram, matchCount } = index;

  const brushIdx = React.useMemo<[number, number] | null>(() => {
    if (!timeRange || !histogram.length) return null;
    const find = (t: number) =>
      Math.max(
        0,
        histogram.findIndex((b) => t < b.end),
      );
    return [find(timeRange[0]), find(timeRange[1])];
  }, [timeRange, histogram]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW,
    getItemKey: (i) => rows[i]!.entry.id,
    overscan: 24,
  });

  // Follow: stick to the bottom as lines stream in.
  React.useLayoutEffect(() => {
    if (follow && live && rows.length) virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
  }, [rows.length, follow, live, virtualizer]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < ROW * 2;
    if (atBottom !== follow) setFollow(atBottom);
  };

  // Permalink target on mount.
  const didDeepLink = React.useRef(false);
  React.useEffect(() => {
    if (didDeepLink.current || !rows.length) return;
    const fromHash =
      typeof window !== "undefined" && window.location.hash.startsWith("#log-")
        ? decodeURIComponent(window.location.hash.slice(5))
        : undefined;
    const target = initialLineId ?? fromHash;
    didDeepLink.current = true;
    if (!target) return;
    const i = rows.findIndex((r) => r.entry.id === target);
    if (i < 0) return;
    setFollow(false);
    setActiveId(target);
    requestAnimationFrame(() => virtualizer.scrollToIndex(i, { align: "center" }));
  }, [rows, initialLineId, virtualizer]);

  const rowIndexOf = React.useCallback(
    (id: string | null) => (id ? rows.findIndex((r) => r.entry.id === id) : -1),
    [rows],
  );

  const move = (delta: number) => {
    if (!rows.length) return;
    const cur = rowIndexOf(activeId);
    const next = Math.max(
      0,
      Math.min(rows.length - 1, cur < 0 ? (delta > 0 ? 0 : rows.length - 1) : cur + delta),
    );
    setActiveId(rows[next]!.entry.id);
    setFollow(false);
    virtualizer.scrollToIndex(next, { align: "auto" });
  };

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  };
  const permalink = React.useCallback(
    (id: string) => {
      setActiveId(id);
      if (onPermalink) return onPermalink(id);
      const url = `${window.location.href.split("#")[0]}#log-${encodeURIComponent(id)}`;
      navigator.clipboard?.writeText(url).then(
        () => flash("Link to line copied"),
        () => flash(url),
      );
    },
    // flash is stable in behaviour; keeping deps minimal avoids re-rendering every row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onPermalink],
  );

  const searchRef = React.useRef<HTMLInputElement>(null);
  const hotkeysRef = useHotkeys<HTMLDivElement>(
    ["slash", "j", "k", "g", "shift+g", "f", "space", "enter", "escape"],
    (e) => {
      switch (e.key) {
        case "/":
          searchRef.current?.focus();
          break;
        case "j":
          move(1);
          break;
        case "k":
          move(-1);
          break;
        case "g":
          setFollow(false);
          virtualizer.scrollToIndex(0);
          break;
        case "G":
          setFollow(true);
          if (rows.length) virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
          break;
        case "f":
          setFollow((f) => !f);
          break;
        case " ":
          setLive(!live);
          break;
        case "Enter":
          if (activeId) toggle(activeId);
          break;
        case "Escape":
          setQuery("");
          setActiveId(null);
          break;
      }
    },
    { preventDefault: true },
    [rows, activeId, live, virtualizer],
  );

  const toggleLevel = (l: LogLevel, only: boolean) =>
    setLevels((prev) => {
      if (only) return new Set([l]);
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });

  const total = view.length;

  return (
    <section
      ref={hotkeysRef}
      tabIndex={-1}
      aria-label={title}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm shadow-crm-raised outline-none",
        className,
      )}
    >
      {/* Toolbar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-crm-border bg-crm-raised px-3 py-2">
        <h3 className="mr-1 text-sm font-medium text-crm-fg">{title}</h3>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]",
            live ? "bg-crm-success/15 text-crm-success" : "bg-crm-muted text-crm-soft",
          )}
          aria-live="polite"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              live ? "animate-pulse bg-crm-success" : "bg-crm-subtle",
            )}
          />
          {live ? "Live" : `Paused${buffered ? ` (${buffered.toLocaleString()} new)` : ""}`}
        </span>
        <div className="relative ml-auto flex min-w-[220px] flex-1 items-center sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-2.5 size-3.5 text-crm-subtle"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                scrollRef.current?.focus();
              }
              if (e.key === "Enter") scrollRef.current?.focus();
            }}
            aria-label="Search logs"
            aria-invalid={!!searchError}
            aria-describedby={searchError ? "log-search-error" : undefined}
            placeholder={regex ? "Regex, e.g. timeout|5\\d\\d" : "Search logs  ( / )"}
            className={cn(
              "h-8 w-full rounded-crm border bg-crm-bg pl-8 pr-24 text-xs text-crm-fg placeholder:text-crm-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
              searchError ? "border-crm-danger" : "border-crm-input",
            )}
          />
          <div className="absolute right-1 flex items-center gap-0.5">
            <ToggleBtn
              pressed={caseSensitive}
              onClick={() => setCaseSensitive((v) => !v)}
              label="Match case"
            >
              <CaseSensitive className="size-3.5" />
            </ToggleBtn>
            <ToggleBtn
              pressed={regex}
              onClick={() => setRegex((v) => !v)}
              label="Use regular expression"
            >
              <Regex className="size-3.5" />
            </ToggleBtn>
            <ToggleBtn
              pressed={filterBySearch}
              onClick={() => setFilterBySearch((v) => !v)}
              label="Only show matching lines"
            >
              <Filter className="size-3.5" />
            </ToggleBtn>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ToggleBtn
            pressed={!live}
            onClick={() => setLive(!live)}
            label={live ? "Pause (space)" : "Resume (space)"}
            size="md"
          >
            {live ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </ToggleBtn>
          <ToggleBtn
            pressed={follow}
            onClick={() => {
              setFollow(true);
              if (rows.length) virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
            }}
            label="Follow tail (f)"
            size="md"
          >
            <ArrowDownToLine className="size-3.5" />
          </ToggleBtn>
        </div>
        {searchError && (
          <p id="log-search-error" role="alert" className="basis-full text-[11px] text-crm-danger">
            Invalid pattern: {searchError}
          </p>
        )}
      </header>

      {/* Facets + histogram */}
      <div className="border-b border-crm-border">
        <div
          role="group"
          aria-label="Filter by level"
          className="flex flex-wrap items-center gap-1.5 px-3 pt-2"
        >
          {LOG_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={levels.has(l)}
              title="Click to toggle, Alt+click to show only this level"
              onClick={(e) => toggleLevel(l, e.altKey)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide",
                levels.has(l) ? "border-crm-input bg-crm-muted" : "border-crm-border opacity-50",
              )}
            >
              <span className={levelTone[l]}>{l}</span>
              <span className="font-mono tabular-nums text-crm-soft">
                {counts[l].toLocaleString()}
              </span>
            </button>
          ))}
          <span className="ml-auto text-[11px] text-crm-muted-fg" aria-live="polite">
            {rows.length.toLocaleString()} of {total.toLocaleString()} lines
            {re && ` · ${matchCount.toLocaleString()} matches`}
          </span>
          {timeRange && (
            <button
              type="button"
              onClick={() => setTimeRange(null)}
              className="inline-flex items-center gap-1 rounded-full bg-crm-primary/15 px-2 py-0.5 text-[11px] text-crm-fg"
            >
              {format(timeRange[0], "HH:mm:ss")} - {format(timeRange[1], "HH:mm:ss")}
              <X className="size-3" aria-label="Clear time range" />
            </button>
          )}
        </div>
        {!loading && !error && total > 0 && (
          <LogHistogram
            data={histogram}
            brush={brushIdx}
            onBrush={(r) => setTimeRange(r ? [histogram[r[0]]!.start, histogram[r[1]]!.end] : null)}
          />
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div
          style={{ height }}
          className="space-y-2 p-4"
          aria-busy="true"
          aria-label="Loading logs"
        >
          {Array.from({ length: 14 }, (_, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded bg-crm-muted"
              style={{ width: `${35 + ((i * 29) % 60)}%` }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          style={{ height }}
          role="alert"
          className="flex flex-col items-center justify-center gap-2 text-sm text-crm-danger"
        >
          <AlertTriangle className="size-5" aria-hidden />
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center gap-1 text-sm text-crm-muted-fg"
        >
          {total === 0 ? "Waiting for log lines..." : "No lines match the current filters."}
          {total > 0 && (
            <button
              type="button"
              className="text-xs text-crm-soft underline"
              onClick={() => {
                setQuery("");
                setTimeRange(null);
                setLevels(new Set(LOG_LEVELS));
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          role="grid"
          aria-label="Log lines"
          aria-rowcount={rows.length}
          aria-activedescendant={activeId ? `log-${activeId}` : undefined}
          tabIndex={0}
          onScroll={onScroll}
          style={{ height }}
          className="overflow-auto font-mono text-[12px] leading-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-crm-ring"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const log = rows[vi.index]!;
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  <LogRow
                    log={log}
                    lineNo={vi.index + 1}
                    active={log.entry.id === activeId}
                    expanded={expanded.has(log.entry.id)}
                    search={re}
                    showSource={showSource}
                    onToggle={toggle}
                    onActivate={setActiveId}
                    onPermalink={permalink}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!follow && live && rows.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setFollow(true);
            virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
          }}
          className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-crm-primary px-3 py-1.5 text-xs font-medium text-crm-primary-fg shadow-crm-raised"
        >
          <ArrowDownToLine className="size-3.5" aria-hidden /> Jump to latest
        </button>
      )}
      {toast && (
        <p
          role="status"
          className="absolute right-4 top-14 rounded-crm border border-crm-border bg-crm-raised px-3 py-1.5 text-xs text-crm-fg shadow-crm-raised"
        >
          {toast}
        </p>
      )}
    </section>
  );
}

function ToggleBtn({
  pressed,
  label,
  size = "sm",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed: boolean;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "flex items-center justify-center rounded text-crm-soft hover:bg-crm-muted hover:text-crm-fg",
        size === "sm" ? "size-6" : "size-8 rounded-crm border border-crm-border",
        pressed && "bg-crm-muted text-crm-fg",
      )}
    >
      {children}
    </button>
  );
}
