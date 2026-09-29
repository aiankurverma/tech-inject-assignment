import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Columns2,
  FoldVertical,
  Rows3,
  UnfoldVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useShikiLines } from "@/hooks/use-shiki-highlighter";
import {
  anchorKey,
  buildDiffModel,
  buildRows,
  type DiffLine,
  type DiffMode,
  type DiffRow,
  type DiffSide,
} from "@/components/crm/pro-diff-viewer/diff-model";
import { LineHalf } from "@/components/crm/pro-diff-viewer/diff-line";
import {
  CommentComposer,
  CommentThread,
  type DiffComment,
} from "@/components/crm/pro-diff-viewer/diff-comments";
import {
  VersionTimeline,
  type DocVersion,
} from "@/components/crm/pro-diff-viewer/version-timeline";

export type { DiffComment, DocVersion, DiffMode, DiffSide };

export interface ProDiffViewerProps {
  oldText: string;
  newText: string;
  /** Shiki language id (ts, tsx, json, yaml, sql, md, ...). "text" disables highlighting. */
  language?: string;
  oldLabel?: string;
  newLabel?: string;
  /** Controlled layout. */
  mode?: DiffMode;
  defaultMode?: DiffMode;
  onModeChange?: (mode: DiffMode) => void;
  /** Unchanged lines kept around each change before folding. */
  contextLines?: number;
  wordDiff?: boolean;
  comments?: DiffComment[];
  /** Enables line comments. Resolve to persist; throw to show an error in the composer. */
  onAddComment?: (c: { side: DiffSide; line: number; body: string }) => Promise<void> | void;
  /** Viewport height of the scrolling diff body. */
  height?: number | string;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

const ROW_H = 20;

/**
 * Virtualised unified/split diff with Shiki syntax colours, word-level intra-line changes,
 * folded context with expand, and line-anchored comment threads. Handles 50k-line files.
 */
export function ProDiffViewer({
  oldText,
  newText,
  language = "text",
  oldLabel = "Before",
  newLabel = "After",
  mode: modeProp,
  defaultMode = "unified",
  onModeChange,
  contextLines = 3,
  wordDiff = true,
  comments = [],
  onAddComment,
  height = 560,
  loading,
  error,
  className,
}: ProDiffViewerProps) {
  const [innerMode, setInnerMode] = React.useState<DiffMode>(defaultMode);
  const mode = modeProp ?? innerMode;
  const setMode = (m: DiffMode) => {
    if (modeProp === undefined) setInnerMode(m);
    onModeChange?.(m);
  };

  const model = React.useMemo(
    () => buildDiffModel(oldText, newText, contextLines),
    [oldText, newText, contextLines],
  );
  const [revealed, setRevealed] = React.useState<Map<number, number>>(() => new Map());
  React.useEffect(() => setRevealed(new Map()), [model]);
  const [composer, setComposer] = React.useState<{ side: DiffSide; line: number } | null>(null);

  const byAnchor = React.useMemo(() => {
    const m = new Map<string, DiffComment[]>();
    for (const c of comments) {
      const k = anchorKey(c.side, c.line);
      const list = m.get(k);
      if (list) list.push(c);
      else m.set(k, [c]);
    }
    return m;
  }, [comments]);
  const anchors = React.useMemo(() => new Set(byAnchor.keys()), [byAnchor]);

  const rows = React.useMemo(
    () => buildRows(model, { mode, revealed, commentAnchors: anchors, composer }),
    [model, mode, revealed, anchors, composer],
  );

  const { tokensFor, error: hlError } = useShikiLines(oldText, newText, language);
  const tokensOf = (line: DiffLine, side?: DiffSide) => {
    const s = side ?? (line.type === "del" ? "old" : "new");
    const no = s === "old" ? line.oldNo : line.newNo;
    return no == null ? null : tokensFor(s, no, line.text);
  };

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) =>
      rows[i]!.kind === "comments" || rows[i]!.kind === "composer" ? 96 : ROW_H,
    getItemKey: (i) => rows[i]!.key,
    overscan: 20,
  });

  // Change navigation: map change-start line indices to row indices.
  const changeRows = React.useMemo(() => {
    const out: number[] = [];
    const starts = new Set(model.changeStarts.map((i) => model.lines[i]));
    rows.forEach((r, i) => {
      const l = r.kind === "line" ? r.line : r.kind === "split" ? (r.left ?? r.right) : undefined;
      if (l && starts.has(l)) out.push(i);
    });
    return out;
  }, [rows, model]);
  const [changeCursor, setChangeCursor] = React.useState(-1);
  const jump = (dir: 1 | -1) => {
    if (!changeRows.length) return;
    const next = (changeCursor + dir + changeRows.length) % changeRows.length;
    setChangeCursor(next);
    virtualizer.scrollToIndex(changeRows[next]!, { align: "center" });
  };

  const reveal = (id: number, n: number) =>
    setRevealed((prev) => new Map(prev).set(id, (prev.get(id) ?? 0) + n));
  const allExpanded = model.folds.every((f) => (revealed.get(f.id) ?? 0) >= f.end - f.start);
  const toggleAll = () =>
    setRevealed(allExpanded ? new Map() : new Map(model.folds.map((f) => [f.id, f.end - f.start])));

  const onComment = onAddComment ? setComposer : undefined;

  const renderRow = (row: DiffRow) => {
    switch (row.kind) {
      case "line":
        return (
          <LineHalf
            line={row.line}
            side={row.line.type === "del" ? "old" : "new"}
            unified
            tokens={tokensOf(row.line)}
            wordDiff={wordDiff}
            commentable={!!onAddComment}
            onComment={onComment}
          />
        );
      case "split":
        return (
          <div className="flex">
            <LineHalf
              line={row.left}
              side="old"
              unified={false}
              tokens={row.left ? tokensOf(row.left, row.left.type === "ctx" ? "new" : "old") : null}
              wordDiff={wordDiff}
              commentable={!!onAddComment && row.left?.type === "del"}
              onComment={onComment}
            />
            <div className="w-px shrink-0 bg-crm-border" aria-hidden />
            <LineHalf
              line={row.right}
              side="new"
              unified={false}
              tokens={row.right ? tokensOf(row.right, "new") : null}
              wordDiff={wordDiff}
              commentable={!!onAddComment}
              onComment={onComment}
            />
          </div>
        );
      case "fold": {
        const first = model.lines[row.from]!;
        const last = model.lines[row.fold.end - 1]!;
        return (
          <div className="flex items-center gap-2 bg-crm-primary/10 py-0.5 pl-3 font-crm text-xs text-crm-soft">
            <button
              type="button"
              onClick={() => reveal(row.fold.id, 20)}
              className="inline-flex items-center gap-1 rounded px-1.5 hover:bg-crm-muted"
              aria-label={`Show 20 more of ${row.hidden} hidden lines`}
            >
              <ChevronDown className="size-3" aria-hidden /> 20 lines
            </button>
            <button
              type="button"
              onClick={() => reveal(row.fold.id, row.hidden)}
              className="inline-flex items-center gap-1 rounded px-1.5 hover:bg-crm-muted"
            >
              <UnfoldVertical className="size-3" aria-hidden /> Show all {row.hidden}
            </button>
            <span className="text-crm-subtle">
              @@ lines {first.newNo}-{last.newNo} unchanged
            </span>
          </div>
        );
      }
      case "comments":
        return <CommentThread comments={byAnchor.get(anchorKey(row.side, row.line)) ?? []} />;
      case "composer":
        return (
          <CommentComposer
            side={row.side}
            line={row.line}
            onCancel={() => setComposer(null)}
            onSubmit={async (body) => {
              await onAddComment?.({ side: row.side, line: row.line, body });
              setComposer(null);
            }}
          />
        );
    }
  };

  const identical = !loading && !error && model.additions === 0 && model.deletions === 0;

  return (
    <section
      aria-label={`Diff: ${oldLabel} to ${newLabel}`}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-crm-border bg-crm-raised px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-xs text-crm-muted-fg">
          <span className="text-crm-soft">{oldLabel}</span> &rarr;{" "}
          <span className="text-crm-fg">{newLabel}</span>
          <span className="ml-3 font-mono text-crm-success">+{model.additions}</span>{" "}
          <span className="font-mono text-crm-danger">-{model.deletions}</span>
          {hlError && <span className="ml-3 text-crm-warning">(highlighting unavailable)</span>}
        </p>
        <div className="flex items-center gap-1">
          <IconBtn
            label="Previous change (k)"
            onClick={() => jump(-1)}
            disabled={!changeRows.length}
          >
            <ChevronUp className="size-3.5" />
          </IconBtn>
          <IconBtn label="Next change (j)" onClick={() => jump(1)} disabled={!changeRows.length}>
            <ChevronDown className="size-3.5" />
          </IconBtn>
          <IconBtn
            label={allExpanded ? "Collapse unchanged" : "Expand all"}
            onClick={toggleAll}
            disabled={!model.folds.length}
          >
            {allExpanded ? (
              <FoldVertical className="size-3.5" />
            ) : (
              <UnfoldVertical className="size-3.5" />
            )}
          </IconBtn>
          <div
            role="radiogroup"
            aria-label="Diff layout"
            className="ml-1 flex rounded-crm border border-crm-border p-0.5"
          >
            {(["unified", "split"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs capitalize",
                  mode === m ? "bg-crm-muted text-crm-fg" : "text-crm-muted-fg hover:text-crm-fg",
                )}
              >
                {m === "unified" ? (
                  <Rows3 className="size-3" aria-hidden />
                ) : (
                  <Columns2 className="size-3" aria-hidden />
                )}
                {m}
              </button>
            ))}
          </div>
        </div>
      </header>

      {mode === "split" && !loading && !error && (
        <div className="flex border-b border-crm-border text-[11px] text-crm-subtle">
          <p className="flex-1 truncate px-3 py-1">{oldLabel}</p>
          <p className="flex-1 truncate border-l border-crm-border px-3 py-1">{newLabel}</p>
        </div>
      )}

      {loading ? (
        <div
          style={{ height }}
          className="space-y-2 p-4"
          aria-busy="true"
          aria-label="Loading diff"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded bg-crm-muted"
              style={{ width: `${40 + ((i * 37) % 55)}%` }}
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
      ) : identical ? (
        <div
          style={{ height: 120 }}
          className="flex items-center justify-center text-sm text-crm-muted-fg"
        >
          No changes between these versions.
        </div>
      ) : (
        <div
          ref={scrollRef}
          tabIndex={0}
          role="region"
          aria-label="Diff lines. Use j and k to jump between changes."
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "j" || e.key === "n") jump(1);
            if (e.key === "k" || e.key === "p") jump(-1);
          }}
          style={{ height }}
          className="overflow-auto font-mono text-[12.5px] leading-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-crm-ring"
        >
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative", minWidth: "100%" }}
          >
            {virtualizer.getVirtualItems().map((vi) => (
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
                {renderRow(rows[vi.index]!)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function IconBtn({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="flex size-7 items-center justify-center rounded-crm text-crm-soft hover:bg-crm-muted hover:text-crm-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export interface ProVersionHistoryProps extends Omit<
  ProDiffViewerProps,
  "oldText" | "newText" | "oldLabel" | "newLabel"
> {
  versions: DocVersion[];
  /** Id of the live version (defaults to the newest). */
  currentId?: string;
  /** Controlled selected version. */
  selectedId?: string;
  onSelectedChange?: (id: string) => void;
  onRestore?: (version: DocVersion) => Promise<void> | void;
  onRename?: (version: DocVersion, name: string) => Promise<void> | void;
}

/** Version timeline + diff: pick any version, compare against its predecessor or any base, restore. */
export function ProVersionHistory({
  versions,
  currentId: currentProp,
  selectedId: selectedProp,
  onSelectedChange,
  onRestore,
  onRename,
  className,
  ...diffProps
}: ProVersionHistoryProps) {
  const sorted = React.useMemo(
    () =>
      [...versions].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [versions],
  );
  const currentId = currentProp ?? sorted[sorted.length - 1]?.id ?? "";
  const [innerSel, setInnerSel] = React.useState<string>(currentId);
  const selectedId = selectedProp ?? innerSel;
  const [baseOverride, setBaseOverride] = React.useState<string | null>(null);
  const [namedOnly, setNamedOnly] = React.useState(false);

  const select = (id: string) => {
    if (selectedProp === undefined) setInnerSel(id);
    setBaseOverride(null);
    onSelectedChange?.(id);
  };

  const idx = sorted.findIndex((v) => v.id === selectedId);
  const target = sorted[idx] ?? sorted[sorted.length - 1];
  const base =
    (baseOverride && sorted.find((v) => v.id === baseOverride)) || sorted[idx - 1] || undefined;
  const label = (v?: DocVersion) =>
    v ? (v.name ?? `${v.author.name}, ${new Date(v.createdAt).toLocaleString()}`) : "Empty";

  if (!sorted.length)
    return (
      <div
        className={cn(
          "rounded-crm border border-crm-border bg-crm-bg p-10 text-center text-sm text-crm-muted-fg",
          className,
        )}
      >
        No versions saved yet.
      </div>
    );

  return (
    <div
      className={cn(
        "grid min-w-0 overflow-hidden rounded-crm border border-crm-border bg-crm-bg md:grid-cols-[260px_minmax(0,1fr)]",
        className,
      )}
    >
      <aside className="max-h-72 border-b border-crm-border bg-crm-raised md:max-h-none md:border-b-0 md:border-r">
        <VersionTimeline
          versions={sorted}
          selectedId={target?.id ?? null}
          baseId={base?.id ?? null}
          currentId={currentId}
          onSelect={select}
          onSelectBase={setBaseOverride}
          onRestore={onRestore}
          onRename={onRename}
          namedOnly={namedOnly}
          onNamedOnlyChange={setNamedOnly}
        />
      </aside>
      <ProDiffViewer
        {...diffProps}
        className="rounded-none border-0 shadow-none"
        oldText={base?.content ?? ""}
        newText={target?.content ?? ""}
        oldLabel={label(base)}
        newLabel={label(target)}
      />
    </div>
  );
}
