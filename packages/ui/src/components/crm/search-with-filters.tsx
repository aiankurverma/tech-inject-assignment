import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/crm/search-input";

export interface QuickFilter<T> {
  id: string;
  label: string;
  predicate: (item: T) => boolean;
  /** Filters sharing a group are OR-ed together; different groups are AND-ed. Default: own group. */
  group?: string;
}

export interface SearchWithFiltersProps<T> {
  items: T[];
  /** Text fields searched (case- and accent-insensitive, every word must match). */
  getSearchText: (item: T) => string;
  quickFilters: QuickFilter<T>[];
  /** Controlled query. */
  query?: string;
  onQueryChange?: (q: string) => void;
  /** Controlled active filter ids. */
  activeFilters?: string[];
  onActiveFiltersChange?: (ids: string[]) => void;
  /** Receives the filtered list whenever it changes. */
  onResultsChange?: (results: T[]) => void;
  /** Renders the results. Omit to handle results yourself via onResultsChange. */
  children?: (results: T[], query: string) => React.ReactNode;
  debounceMs?: number;
  placeholder?: string;
  /** Global Cmd/Ctrl shortcut that focuses search. */
  shortcut?: string;
  loading?: boolean;
  noun?: { one: string; many: string };
  className?: string;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Wraps every occurrence of the query words in <mark>. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return <>{text}</>;
  const folded = fold(text);
  const marks: boolean[] = new Array(text.length).fill(false);
  for (const w of words) {
    let i = folded.indexOf(w);
    while (i !== -1) {
      for (let j = i; j < i + w.length; j++) marks[j] = true;
      i = folded.indexOf(w, i + w.length);
    }
  }
  const parts: React.ReactNode[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marks[i] !== marks[start]) {
      const chunk = text.slice(start, i);
      parts.push(
        marks[start] ? (
          <mark key={start} className="rounded-[2px] bg-crm-primary/35 text-crm-fg">
            {chunk}
          </mark>
        ) : (
          chunk
        ),
      );
      start = i;
    }
  }
  return <>{parts}</>;
}

/**
 * Search box plus quick filter pills with live match counts. Words are AND-matched, accents folded,
 * filters in the same group OR-ed and groups AND-ed. Debounced, controlled or uncontrolled.
 */
export function SearchWithFilters<T>({
  items,
  getSearchText,
  quickFilters,
  query: queryProp,
  onQueryChange,
  activeFilters: activeProp,
  onActiveFiltersChange,
  onResultsChange,
  children,
  debounceMs = 150,
  placeholder = "Search",
  shortcut,
  loading,
  noun = { one: "result", many: "results" },
  className,
}: SearchWithFiltersProps<T>) {
  const [qInner, setQInner] = React.useState("");
  const [aInner, setAInner] = React.useState<string[]>([]);
  const query = queryProp ?? qInner;
  const active = activeProp ?? aInner;
  const [debounced, setDebounced] = React.useState(query);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  const setQuery = (q: string) => {
    if (queryProp === undefined) setQInner(q);
    onQueryChange?.(q);
  };
  const setActive = (ids: string[]) => {
    if (activeProp === undefined) setAInner(ids);
    onActiveFiltersChange?.(ids);
  };

  const index = React.useMemo(
    () => items.map((it) => fold(getSearchText(it))),
    [items, getSearchText],
  );
  const words = React.useMemo(() => fold(debounced).split(/\s+/).filter(Boolean), [debounced]);

  const apply = React.useCallback(
    (ids: string[]) => {
      const groups = new Map<string, QuickFilter<T>[]>();
      for (const f of quickFilters) {
        if (!ids.includes(f.id)) continue;
        const g = f.group ?? f.id;
        groups.set(g, [...(groups.get(g) ?? []), f]);
      }
      return items.filter((it, i) => {
        if (words.length && !words.every((w) => (index[i] ?? "").includes(w))) return false;
        for (const fs of groups.values()) if (!fs.some((f) => f.predicate(it))) return false;
        return true;
      });
    },
    [items, index, words, quickFilters],
  );

  const results = React.useMemo(() => apply(active), [apply, active]);

  const cb = React.useRef(onResultsChange);
  React.useEffect(() => {
    cb.current = onResultsChange;
  });
  React.useEffect(() => {
    cb.current?.(results);
  }, [results]);

  const toggle = (id: string) =>
    setActive(active.includes(id) ? active.filter((a) => a !== id) : [...active, id]);
  const countIfToggled = (id: string) =>
    apply(active.includes(id) ? active : [...active, id]).length;
  const pending = query !== debounced;
  const hasCriteria = query.trim() !== "" || active.length > 0;

  return (
    <div className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={placeholder}
          shortcut={shortcut}
          loading={loading || pending}
          className="sm:max-w-xs"
        />
        <p className="text-xs text-crm-subtle sm:ml-auto" role="status" aria-live="polite">
          {results.length.toLocaleString("en-US")} {results.length === 1 ? noun.one : noun.many}
          {hasCriteria ? ` of ${items.length.toLocaleString("en-US")}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick filters">
        {quickFilters.map((f) => {
          const on = active.includes(f.id);
          const n = countIfToggled(f.id);
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              disabled={!on && n === 0}
              onClick={() => toggle(f.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-40",
                on
                  ? "border-crm-primary bg-crm-primary/20 text-crm-fg"
                  : "border-crm-border bg-crm-raised text-crm-soft hover:border-crm-input hover:text-crm-fg",
              )}
            >
              {f.label}
              <span className={cn("tabular-nums", on ? "text-crm-fg" : "text-crm-subtle")}>
                {n}
              </span>
            </button>
          );
        })}
        {hasCriteria ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActive([]);
            }}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <X className="size-3" aria-hidden />
            Clear all
          </button>
        ) : null}
      </div>
      {children ? (
        results.length === 0 && !loading ? (
          <div
            role="status"
            className="rounded-crm border border-dashed border-crm-border p-6 text-center text-xs text-crm-subtle"
          >
            No {noun.many} match
            {debounced ? (
              <>
                {" "}
                “<span className="text-crm-soft">{debounced}</span>”
              </>
            ) : null}
            {active.length ? ` with ${active.length} filter${active.length > 1 ? "s" : ""}` : ""}.
          </div>
        ) : (
          children(results, debounced)
        )
      ) : null}
    </div>
  );
}
