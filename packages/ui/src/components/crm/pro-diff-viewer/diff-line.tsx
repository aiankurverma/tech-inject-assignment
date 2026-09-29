import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HighlightToken } from "@/hooks/use-shiki-highlighter";
import {
  lineAnchor,
  wordSegments,
  type DiffLine,
  type DiffSide,
} from "@/components/crm/pro-diff-viewer/diff-model";

interface Piece {
  text: string;
  color?: string;
  italic?: boolean;
  bold?: boolean;
  changed: boolean;
}

/** Splits syntax tokens at word-diff boundaries so both layers render together. */
function mergePieces(
  text: string,
  tokens: HighlightToken[] | null,
  segments: { text: string; changed: boolean }[] | null,
): Piece[] {
  const syn: HighlightToken[] = tokens?.length ? tokens : [{ content: text }];
  if (!segments) {
    return syn.map((t) => ({
      text: t.content,
      color: t.color,
      italic: !!(t.fontStyle && t.fontStyle & 1),
      bold: !!(t.fontStyle && t.fontStyle & 2),
      changed: false,
    }));
  }
  const out: Piece[] = [];
  let si = 0;
  let segLeft = segments[0]?.text.length ?? Infinity;
  for (const t of syn) {
    let rest = t.content;
    while (rest.length) {
      const seg = segments[si];
      const take = Math.min(rest.length, segLeft);
      out.push({
        text: rest.slice(0, take),
        color: t.color,
        italic: !!(t.fontStyle && t.fontStyle & 1),
        bold: !!(t.fontStyle && t.fontStyle & 2),
        changed: !!seg?.changed,
      });
      rest = rest.slice(take);
      segLeft -= take;
      if (segLeft <= 0 && si < segments.length - 1) {
        si++;
        segLeft = segments[si]!.text.length;
      }
    }
  }
  return out;
}

export interface CodeCellProps {
  line: DiffLine;
  side: DiffSide;
  tokens: HighlightToken[] | null;
  wordDiff: boolean;
}

export const CodeCell = React.memo(function CodeCell({
  line,
  side,
  tokens,
  wordDiff,
}: CodeCellProps) {
  const segments =
    wordDiff && line.pair != null && line.type !== "ctx"
      ? wordSegments(line.text, line.pair, side)
      : null;
  const pieces = mergePieces(line.text, tokens, segments);
  return (
    <span className="whitespace-pre">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={p.color ? { color: p.color } : undefined}
          className={cn(
            p.italic && "italic",
            p.bold && "font-semibold",
            p.changed &&
              (line.type === "add"
                ? "rounded-sm bg-crm-success/35"
                : "rounded-sm bg-crm-danger/35"),
          )}
        >
          {p.text}
        </span>
      ))}
      {line.text === "" && " "}
    </span>
  );
});

const rowTone = {
  add: "bg-crm-success/10",
  del: "bg-crm-danger/10",
  ctx: "",
} as const;
const gutterTone = {
  add: "bg-crm-success/15 text-crm-success",
  del: "bg-crm-danger/15 text-crm-danger",
  ctx: "text-crm-faint",
} as const;

export interface LineHalfProps {
  line?: DiffLine;
  side: DiffSide;
  /** unified shows both numbers; split shows one. */
  unified: boolean;
  tokens: HighlightToken[] | null;
  wordDiff: boolean;
  commentable: boolean;
  onComment?: (anchor: { side: DiffSide; line: number }) => void;
}

/** One side (or the unified row) of a diff line: gutters, marker, code, comment affordance. */
export function LineHalf({
  line,
  side,
  unified,
  tokens,
  wordDiff,
  commentable,
  onComment,
}: LineHalfProps) {
  if (!line) return <div className="min-w-0 flex-1 bg-crm-muted/30" aria-hidden />;
  const marker = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
  const label = line.type === "add" ? "added" : line.type === "del" ? "removed" : "unchanged";
  const anchor = lineAnchor(line);
  return (
    <div
      className={cn("group/line relative flex min-w-0 flex-1", rowTone[line.type])}
      aria-label={`${label} line ${anchor.line}`}
    >
      {unified && (
        <span
          className={cn("w-12 shrink-0 select-none pr-2 text-right", gutterTone[line.type])}
          aria-hidden
        >
          {line.oldNo ?? ""}
        </span>
      )}
      <span
        className={cn("w-12 shrink-0 select-none pr-2 text-right", gutterTone[line.type])}
        aria-hidden
      >
        {unified ? (line.newNo ?? "") : side === "old" ? line.oldNo : line.newNo}
      </span>
      {commentable && onComment && (
        <button
          type="button"
          onClick={() => onComment(anchor)}
          aria-label={`Comment on ${anchor.side} line ${anchor.line}`}
          className="absolute left-1 top-0 z-10 flex size-5 items-center justify-center rounded bg-crm-primary text-crm-primary-fg opacity-0 focus-visible:opacity-100 group-hover/line:opacity-100"
        >
          <MessageSquarePlus className="size-3" aria-hidden />
        </button>
      )}
      <span
        className={cn("w-5 shrink-0 select-none text-center", gutterTone[line.type])}
        aria-hidden
      >
        {marker}
      </span>
      <span className="min-w-0 flex-1 overflow-hidden pr-4 text-crm-fg">
        <CodeCell line={line} side={side} tokens={tokens} wordDiff={wordDiff} />
      </span>
    </div>
  );
}
