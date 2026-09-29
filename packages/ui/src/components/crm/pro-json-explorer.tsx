import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { create as createDiffPatcher } from "jsondiffpatch";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Copy,
  FoldVertical,
  Search,
  Trash2,
  UnfoldVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deltaToChanges,
  fromPointer,
  getAt,
  parseLiteral,
  removeAt,
  setAt,
  toDisplayPath,
  type Change,
  type ChangeKind,
  type JsonValue,
} from "@/lib/json-explorer";
import { useJsonTree } from "@/hooks/use-json-tree";
import { useJsonSchema } from "@/hooks/use-json-schema";
import { TreeRow } from "@/components/crm/pro-json-explorer/tree-row";
import { DiffView } from "@/components/crm/pro-json-explorer/diff-view";

export type { JsonValue } from "@/lib/json-explorer";

export interface ProJsonExplorerProps {
  /** Controlled document. */
  value?: JsonValue;
  /** Uncontrolled initial document. */
  defaultValue?: JsonValue;
  /** Raw JSON text; parsed once (used when neither value nor defaultValue is given). */
  source?: string;
  /** Fires with the next document after an edit or delete. */
  onChange?: (next: JsonValue) => void;
  /** Allow inline editing (Enter/F2/double-click) and deleting (Delete key). */
  editable?: boolean;
  /** JSON Schema (draft-07 / 2019-09) validated with ajv on every change. */
  schema?: object;
  /** Reject edits that introduce new schema errors instead of applying them. */
  blockInvalidEdits?: boolean;
  /** Second payload to diff against (shown as "before"). Enables the Diff tab. */
  compareTo?: JsonValue;
  compareLabels?: [before: string, after: string];
  /** Controlled expanded pointers. */
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (pointers: string[]) => void;
  /** Depth expanded on mount when uncontrolled. */
  initialDepth?: number;
  /** Fires when a node is selected (pointer + JSONPath display path). */
  onSelect?: (pointer: string, path: string) => void;
  /** Key for array items used by the diff to match moved/edited items. */
  diffObjectKey?: string;
  loading?: boolean;
  error?: React.ReactNode;
  rowHeight?: number;
  height?: number | string;
  label?: string;
  className?: string;
}

type Tab = "tree" | "diff" | "problems";
const INDENT = 16;

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ProJsonExplorer(props: ProJsonExplorerProps) {
  const {
    editable = false,
    schema,
    compareTo,
    compareLabels = ["Before", "After"],
    rowHeight = 26,
    height = 560,
    label = "JSON explorer",
    diffObjectKey = "id",
    loading,
    error,
  } = props;

  // ---------- document (controlled / uncontrolled / raw source) ----------
  const parsed = React.useMemo<{ doc?: JsonValue; error?: string }>(() => {
    if (props.defaultValue !== undefined || props.source === undefined)
      return { doc: props.defaultValue };
    try {
      return { doc: JSON.parse(props.source) as JsonValue };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [props.defaultValue, props.source]);
  const [innerDoc, setInnerDoc] = React.useState<JsonValue | undefined>(parsed.doc);
  const [lastParsed, setLastParsed] = React.useState(parsed);
  if (lastParsed !== parsed) {
    setLastParsed(parsed);
    setInnerDoc(parsed.doc);
  }
  const doc = props.value !== undefined ? props.value : innerDoc;
  const docBytes = React.useMemo(
    () => (props.source !== undefined ? props.source.length : 0),
    [props.source],
  );

  const commitDoc = React.useCallback(
    (next: JsonValue) => {
      if (props.value === undefined) setInnerDoc(next);
      props.onChange?.(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.value, props.onChange],
  );

  // ---------- tree, search, validation, diff ----------
  const [query, setQuery] = React.useState("");
  const tree = useJsonTree({
    data: doc,
    expanded: props.expanded,
    defaultExpanded: props.defaultExpanded,
    onExpandedChange: props.onExpandedChange,
    initialDepth: props.initialDepth ?? 2,
    query,
  });
  const validation = useJsonSchema(schema, doc);

  const deferredDoc = React.useDeferredValue(doc);
  const diffPending = deferredDoc !== doc;
  const changes = React.useMemo<Change[]>(() => {
    if (compareTo === undefined || deferredDoc === undefined) return [];
    const differ = createDiffPatcher({
      objectHash: (item: object, index?: number) => {
        const k = (item as Record<string, unknown>)[diffObjectKey];
        return k === undefined ? `$$index:${index}` : String(k);
      },
      arrays: { detectMove: true },
    });
    return deltaToChanges(differ.diff(compareTo, deferredDoc));
  }, [compareTo, deferredDoc, diffObjectKey]);
  const changeById = React.useMemo(() => {
    const m = new Map<string, ChangeKind>();
    for (const c of changes) if (c.kind !== "removed") m.set(c.id, c.kind);
    return m;
  }, [changes]);

  // ---------- selection / keyboard ----------
  const [tab, setTab] = React.useState<Tab>("tree");
  const [activeId, setActiveId] = React.useState<string>("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [matchIndex, setMatchIndex] = React.useState(0);
  const [copied, setCopied] = React.useState<"path" | "value" | null>(null);
  const [rejected, setRejected] = React.useState<string | null>(null);
  const rows = tree.rows;
  const indexById = React.useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.id, i));
    return m;
  }, [rows]);
  const activeIndex = indexById.get(activeId) ?? 0;
  const activeRow = rows[activeIndex];

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 16,
  });
  const baseId = React.useId();
  const domId = (i: number) => `${baseId}-row-${i}`;

  const select = React.useCallback(
    (index: number) => {
      const r = rows[Math.max(0, Math.min(rows.length - 1, index))];
      if (!r) return;
      setActiveId(r.id);
      virtualizer.scrollToIndex(indexById.get(r.id) ?? 0, { align: "auto" });
      props.onSelect?.(r.id, toDisplayPath(r.path));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, indexById, virtualizer, props.onSelect],
  );

  // Once a pending "reveal" has expanded the ancestors, scroll the target into view.
  const [pendingReveal, setPendingReveal] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!pendingReveal) return;
    const i = indexById.get(pendingReveal);
    if (i !== undefined) virtualizer.scrollToIndex(i, { align: "center" });
  }, [pendingReveal, indexById, virtualizer]);

  const revealId = React.useCallback(
    (id: string) => {
      tree.reveal(id);
      setActiveId(id);
      setPendingReveal(id);
    },
    [tree],
  );

  const gotoMatch = (delta: number) => {
    const ids = tree.search.ids;
    if (!ids.length) return;
    const next = (matchIndex + delta + ids.length) % ids.length;
    setMatchIndex(next);
    setTab("tree");
    const target = ids[next];
    if (target !== undefined) revealId(target);
  };

  const commitEdit = React.useCallback(
    (text: string) => {
      const id = editingId;
      setEditingId(null);
      scrollRef.current?.focus();
      if (id === null || doc === undefined) return;
      const path = rows[indexById.get(id) ?? -1]?.path;
      if (!path) return;
      const nextValue = parseLiteral(text);
      if (JSON.stringify(getAt(doc, path)) === JSON.stringify(nextValue)) return;
      const next = setAt(doc, path, nextValue);
      if (props.blockInvalidEdits && schema) {
        const before = validation.issues.length;
        const after = validation.validate(next);
        const first = after[0];
        if (after.length > before && first) {
          setRejected(`Edit rejected: ${first.pointer || "/"} ${first.message}`);
          return;
        }
      }
      setRejected(null);
      commitDoc(next);
    },
    [editingId, doc, rows, indexById, props.blockInvalidEdits, schema, validation, commitDoc],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    const r = activeRow;
    if (!r) return;
    const container = r.type === "object" || r.type === "array";
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / rowHeight) - 1);
    switch (e.key) {
      case "ArrowDown":
        select(activeIndex + 1);
        break;
      case "ArrowUp":
        select(activeIndex - 1);
        break;
      case "PageDown":
        select(activeIndex + page);
        break;
      case "PageUp":
        select(activeIndex - page);
        break;
      case "Home":
        select(0);
        break;
      case "End":
        select(rows.length - 1);
        break;
      case "ArrowRight":
        if (container && !r.expanded) tree.setOpen(r.id, true);
        else if (container && r.size) select(activeIndex + 1);
        break;
      case "ArrowLeft":
        if (container && r.expanded) tree.setOpen(r.id, false);
        else if (r.parentId !== null) select(indexById.get(r.parentId) ?? 0);
        break;
      case "Enter":
      case "F2":
        if (container && e.key === "Enter") tree.toggle(r.id);
        else if (editable && !container) setEditingId(r.id);
        break;
      case "Delete":
        if (editable && doc !== undefined && r.path.length) {
          commitDoc(removeAt(doc, r.path));
          select(activeIndex - 1);
        }
        break;
      case "c":
        if (e.metaKey || e.ctrlKey) {
          void copyText(JSON.stringify(r.value, null, 2));
          flash("value");
        } else return;
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const flashTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = (what: "path" | "value") => {
    setCopied(what);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setCopied(null), 1200);
  };
  React.useEffect(() => () => clearTimeout(flashTimer.current), []);

  const currentMatchId = tree.search.ids[matchIndex];
  const toggle = tree.toggle;
  const startEdit = React.useCallback((i: number) => setEditingId(rows[i]?.id ?? null), [rows]);
  const cancelEdit = React.useCallback(() => {
    setEditingId(null);
    scrollRef.current?.focus();
  }, []);

  // ---------- render ----------
  const shell = cn(
    "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised",
    props.className,
  );
  const failure = error ?? (parsed.error ? `Invalid JSON: ${parsed.error}` : null);
  if (loading || failure || doc === undefined) {
    return (
      <div className={shell} style={{ height }} aria-busy={loading || undefined}>
        <div className="grid flex-1 place-items-center p-8 text-sm">
          {loading ? (
            <div className="w-full max-w-md space-y-2" aria-label="Loading payload">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="h-3 animate-pulse rounded bg-crm-muted"
                  style={{ width: `${40 + ((i * 37) % 55)}%`, marginLeft: (i % 3) * 16 }}
                />
              ))}
            </div>
          ) : failure ? (
            <div role="alert" className="flex max-w-md items-start gap-2 text-crm-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{failure}</span>
            </div>
          ) : (
            <span className="text-crm-muted-fg">No payload to show.</span>
          )}
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "tree", label: "Tree" },
    ...(compareTo !== undefined
      ? [{ id: "diff" as Tab, label: "Diff", count: changes.length }]
      : []),
    ...(schema
      ? [{ id: "problems" as Tab, label: "Problems", count: validation.issues.length }]
      : []),
  ];
  const s = tree.search;

  return (
    <section className={shell} style={{ height }} aria-label={label}>
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2">
        <div className="flex h-8 min-w-56 flex-1 items-center gap-2 rounded-crm border border-crm-input bg-crm-bg px-2 focus-within:border-crm-ring">
          <Search className="size-3.5 shrink-0 text-crm-subtle" aria-hidden />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatchIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                gotoMatch(e.shiftKey ? -1 : s.ids.length && currentMatchId === activeId ? 1 : 0);
              }
            }}
            placeholder="Search text, or a path like $.data..id / $.items[*].status"
            aria-label="Search keys, values or JSON path"
            className="min-w-0 flex-1 bg-transparent font-mono text-xs text-crm-fg outline-none placeholder:text-crm-faint"
          />
          {query && (
            <span
              className="shrink-0 text-[11px] text-crm-muted-fg tabular-nums"
              aria-live="polite"
            >
              {tree.searching
                ? "…"
                : s.mode === "invalid"
                  ? "invalid path"
                  : s.ids.length
                    ? `${matchIndex + 1}/${s.ids.length}${s.truncated ? "+" : ""}`
                    : "0 results"}
            </span>
          )}
          <button
            type="button"
            aria-label="Previous match"
            onClick={() => gotoMatch(-1)}
            disabled={!s.ids.length}
            className="text-crm-subtle hover:text-crm-fg disabled:opacity-30"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next match"
            onClick={() => gotoMatch(1)}
            disabled={!s.ids.length}
            className="text-crm-subtle hover:text-crm-fg disabled:opacity-30"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => tree.expandAll(3)}
          className="flex h-8 items-center gap-1.5 rounded-crm border border-crm-border px-2 text-xs text-crm-soft hover:bg-crm-raised"
        >
          <UnfoldVertical className="size-3.5" aria-hidden /> Expand
        </button>
        <button
          type="button"
          onClick={tree.collapseAll}
          className="flex h-8 items-center gap-1.5 rounded-crm border border-crm-border px-2 text-xs text-crm-soft hover:bg-crm-raised"
        >
          <FoldVertical className="size-3.5" aria-hidden /> Collapse
        </button>
        {tabs.length > 1 && (
          <div
            role="tablist"
            aria-label="View"
            className="flex rounded-crm border border-crm-border p-0.5"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex h-6 items-center gap-1.5 rounded-[calc(var(--radius-crm)-2px)] px-2 text-xs",
                  tab === t.id ? "bg-crm-muted text-crm-fg" : "text-crm-muted-fg hover:text-crm-fg",
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] tabular-nums",
                      t.id === "problems" && t.count
                        ? "bg-crm-danger/20 text-crm-danger"
                        : "bg-crm-raised",
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "tree" && (
        <div
          ref={scrollRef}
          role="tree"
          aria-label={label}
          aria-activedescendant={activeRow ? domId(activeIndex) : undefined}
          aria-multiselectable={false}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="relative min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-crm-ring focus-visible:ring-inset"
        >
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative", minWidth: "100%" }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const r = rows[vi.index];
              if (!r) return null;
              const issues = validation.byPointer.get(r.id);
              return (
                <TreeRow
                  key={r.id}
                  row={r}
                  index={vi.index}
                  domId={domId(vi.index)}
                  active={vi.index === activeIndex}
                  match={tree.matchSet.has(r.id)}
                  currentMatch={r.id === currentMatchId}
                  change={changeById.get(r.id)}
                  issues={issues?.map((i) => i.message)}
                  editing={editingId === r.id}
                  editable={editable}
                  indent={INDENT}
                  onToggle={toggle}
                  onSelect={select}
                  onStartEdit={startEdit}
                  onCommitEdit={commitEdit}
                  onCancelEdit={cancelEdit}
                  style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
                />
              );
            })}
          </div>
        </div>
      )}

      {tab === "diff" && (
        <DiffView
          changes={changes}
          pending={diffPending}
          beforeLabel={compareLabels[0]}
          afterLabel={compareLabels[1]}
          onJump={(c) => {
            setTab("tree");
            if (c.kind !== "removed") revealId(c.id);
          }}
        />
      )}

      {tab === "problems" && (
        <div className="min-h-0 flex-1 overflow-auto" role="list" aria-label="Schema problems">
          {validation.schemaError ? (
            <p role="alert" className="p-4 text-sm text-crm-danger">
              Schema does not compile: {validation.schemaError}
            </p>
          ) : validation.issues.length === 0 ? (
            <p className="grid h-full place-items-center p-8 text-sm text-crm-muted-fg">
              <span className="flex items-center gap-2">
                <Check className="size-4 text-crm-success" aria-hidden /> Payload matches the
                schema.
              </span>
            </p>
          ) : (
            validation.issues.slice(0, 500).map((i, n) => (
              <button
                key={n}
                type="button"
                role="listitem"
                onClick={() => {
                  setTab("tree");
                  if (getAt(doc, fromPointer(i.pointer)) !== undefined || i.pointer === "")
                    revealId(i.pointer);
                }}
                className="flex w-full items-start gap-2 border-b border-crm-border px-3 py-2 text-left text-xs hover:bg-crm-raised"
              >
                <CircleAlert className="mt-px size-3.5 shrink-0 text-crm-danger" aria-hidden />
                <span className="font-mono text-crm-icon">
                  {toDisplayPath(fromPointer(i.pointer))}
                </span>
                <span className="text-crm-soft">{i.message}</span>
                <span className="ml-auto text-crm-faint">{i.keyword}</span>
              </button>
            ))
          )}
        </div>
      )}

      <footer className="flex min-h-9 flex-wrap items-center gap-2 border-t border-crm-border px-3 py-1.5 text-xs">
        <span
          className="min-w-0 flex-1 truncate font-mono text-crm-icon"
          title={activeRow ? toDisplayPath(activeRow.path) : ""}
        >
          {activeRow ? toDisplayPath(activeRow.path) : "$"}
        </span>
        {rejected && (
          <span role="alert" className="truncate text-crm-danger">
            {rejected}
          </span>
        )}
        {schema && !validation.schemaError && (
          <span className={validation.ok ? "text-crm-success" : "text-crm-danger"}>
            {validation.ok ? "Valid" : `${validation.issues.length} schema errors`}
          </span>
        )}
        {docBytes > 0 && <span className="text-crm-muted-fg tabular-nums">{bytes(docBytes)}</span>}
        <span className="text-crm-muted-fg tabular-nums">{rows.length.toLocaleString()} rows</span>
        <button
          type="button"
          disabled={!activeRow}
          onClick={async () => {
            if (activeRow && (await copyText(toDisplayPath(activeRow.path)))) flash("path");
          }}
          className="flex h-6 items-center gap-1 rounded-crm border border-crm-border px-2 text-crm-soft hover:bg-crm-raised"
        >
          {copied === "path" ? <Check className="size-3" /> : <Copy className="size-3" />} Path
        </button>
        <button
          type="button"
          disabled={!activeRow}
          onClick={async () => {
            if (activeRow && (await copyText(JSON.stringify(activeRow.value, null, 2))))
              flash("value");
          }}
          className="flex h-6 items-center gap-1 rounded-crm border border-crm-border px-2 text-crm-soft hover:bg-crm-raised"
        >
          {copied === "value" ? <Check className="size-3" /> : <Copy className="size-3" />} Value
        </button>
        {editable && activeRow && activeRow.path.length > 0 && (
          <button
            type="button"
            aria-label="Delete selected node"
            onClick={() => commitDoc(removeAt(doc, activeRow.path))}
            className="flex h-6 items-center gap-1 rounded-crm border border-crm-border px-2 text-crm-danger hover:bg-crm-danger/10"
          >
            <Trash2 className="size-3" aria-hidden />
          </button>
        )}
      </footer>
      {editable && (
        <p className="sr-only">
          Use arrow keys to move, Enter or F2 to edit a value, Delete to remove a node, Ctrl+C to
          copy.
        </p>
      )}
    </section>
  );
}
