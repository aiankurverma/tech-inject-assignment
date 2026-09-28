import * as React from "react";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type RichTextFormat =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "link"
  | "heading"
  | "bullet"
  | "numbered"
  | "task"
  | "quote";

interface Edit {
  value: string;
  start: number;
  end: number;
}

const INLINE: Partial<Record<RichTextFormat, string>> = {
  bold: "**",
  italic: "_",
  strike: "~~",
  code: "`",
};
const LINE: Partial<Record<RichTextFormat, (n: number) => string>> = {
  heading: () => "## ",
  bullet: () => "- ",
  numbered: (n) => `${n}. `,
  task: () => "- [ ] ",
  quote: () => "> ",
};
const LINE_RE: Partial<Record<RichTextFormat, RegExp>> = {
  heading: /^#{1,6} /,
  bullet: /^- (?!\[)/,
  numbered: /^\d+\. /,
  task: /^- \[[ x]\] /,
  quote: /^> /,
};

/**
 * Pure markdown transform: toggles `format` on the selection [start,end) of `value`.
 * Inline formats wrap/unwrap (and select the word under the caret when empty); line formats
 * add or remove a prefix on every selected line, renumbering ordered lists.
 */
export function applyMarkdownFormat(
  value: string,
  start: number,
  end: number,
  format: RichTextFormat,
  url = "https://",
): Edit {
  const mark = INLINE[format];
  if (mark) {
    if (start === end) {
      // Expand to the word under the caret.
      const left = value.slice(0, start).match(/[\w-]+$/)?.[0].length ?? 0;
      const right = value.slice(end).match(/^[\w-]+/)?.[0].length ?? 0;
      start -= left;
      end += right;
    }
    const before = value.slice(start - mark.length, start);
    const after = value.slice(end, end + mark.length);
    if (before === mark && after === mark) {
      return {
        value:
          value.slice(0, start - mark.length) +
          value.slice(start, end) +
          value.slice(end + mark.length),
        start: start - mark.length,
        end: end - mark.length,
      };
    }
    const sel = value.slice(start, end);
    return {
      value: value.slice(0, start) + mark + sel + mark + value.slice(end),
      start: start + mark.length,
      end: end + mark.length,
    };
  }
  if (format === "link") {
    const text = value.slice(start, end) || "link text";
    const insert = `[${text}](${url})`;
    const urlStart = start + text.length + 3;
    return {
      value: value.slice(0, start) + insert + value.slice(end),
      start: urlStart,
      end: urlStart + url.length,
    };
  }
  const prefix = LINE[format];
  const re = LINE_RE[format];
  if (!prefix || !re) return { value, start, end };
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = value.indexOf("\n", end);
  if (lineEnd === -1) lineEnd = value.length;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const allHave = lines.every((l) => re.test(l) || !l.trim());
  const stripAny = (l: string) =>
    Object.values(LINE_RE).reduce((acc, r) => (r ? acc.replace(r, "") : acc), l);
  let n = 0;
  const next = lines
    .map((l) => {
      if (!l.trim()) return l;
      if (allHave) return l.replace(re, "");
      n++;
      return prefix(n) + stripAny(l);
    })
    .join("\n");
  const out = value.slice(0, lineStart) + next + value.slice(lineEnd);
  return { value: out, start: lineStart, end: lineStart + next.length };
}

/** Which formats are active at the caret, for toolbar pressed state. */
export function activeFormats(value: string, start: number, end: number): Set<RichTextFormat> {
  const set = new Set<RichTextFormat>();
  for (const [f, mark] of Object.entries(INLINE) as [RichTextFormat, string][]) {
    const before = value.slice(0, start);
    const after = value.slice(end);
    const opens = before.split(mark).length - 1;
    if (opens % 2 === 1 && after.includes(mark)) set.add(f);
  }
  const line = value.slice(value.lastIndexOf("\n", start - 1) + 1).split("\n")[0] ?? "";
  for (const [f, re] of Object.entries(LINE_RE) as [RichTextFormat, RegExp][])
    if (re.test(line)) set.add(f);
  if (set.has("task")) set.delete("bullet");
  return set;
}

const TOOLS: {
  format: RichTextFormat;
  label: string;
  icon: React.ReactNode;
  keys?: string;
  group: number;
}[] = [
  { format: "bold", label: "Bold", icon: <Bold />, keys: "Mod+B", group: 0 },
  { format: "italic", label: "Italic", icon: <Italic />, keys: "Mod+I", group: 0 },
  {
    format: "strike",
    label: "Strikethrough",
    icon: <Strikethrough />,
    keys: "Mod+Shift+X",
    group: 0,
  },
  { format: "code", label: "Inline code", icon: <Code />, keys: "Mod+E", group: 0 },
  { format: "link", label: "Link", icon: <Link2 />, keys: "Mod+K", group: 1 },
  { format: "heading", label: "Heading", icon: <Heading2 />, group: 2 },
  { format: "bullet", label: "Bulleted list", icon: <List />, keys: "Mod+Shift+8", group: 2 },
  {
    format: "numbered",
    label: "Numbered list",
    icon: <ListOrdered />,
    keys: "Mod+Shift+7",
    group: 2,
  },
  { format: "task", label: "Checklist", icon: <ListChecks />, group: 2 },
  { format: "quote", label: "Quote", icon: <Quote />, group: 2 },
];

export interface RichTextToolbarProps {
  /** The textarea to format. The toolbar also binds keyboard shortcuts on it. */
  targetRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Current markdown value (controlled textarea). */
  value: string;
  onChange: (value: string) => void;
  /** Hide specific tools, e.g. ["task", "heading"] for short notes. */
  exclude?: RichTextFormat[];
  /** Max history entries for undo/redo. */
  historyLimit?: number;
  /** Character limit to display; turns red when exceeded. */
  maxLength?: number;
  disabled?: boolean;
  /** Extra controls at the right (e.g. "Preview" toggle). */
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * Markdown formatting toolbar for a plain textarea (notes, email bodies, ticket replies).
 * Toggles inline and line formats on the selection, reflects the active formats at the caret,
 * owns an undo/redo stack, binds ⌘/Ctrl shortcuts, continues lists on Enter, and follows the
 * WAI-ARIA toolbar pattern (one tab stop, arrow keys between buttons).
 */
export function RichTextToolbar({
  targetRef,
  value,
  onChange,
  exclude = [],
  historyLimit = 100,
  maxLength,
  disabled,
  trailing,
  className,
}: RichTextToolbarProps) {
  const [active, setActive] = React.useState<Set<RichTextFormat>>(new Set());
  const [focusIdx, setFocusIdx] = React.useState(0);
  const past = React.useRef<Edit[]>([]);
  const future = React.useRef<Edit[]>([]);
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const tools = TOOLS.filter((t) => !exclude.includes(t.format));
  const isMac = typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform);

  const snapshot = (): Edit => {
    const ta = targetRef.current;
    return { value: valueRef.current, start: ta?.selectionStart ?? 0, end: ta?.selectionEnd ?? 0 };
  };

  const commit = React.useCallback(
    (edit: Edit, record = true) => {
      if (record) {
        past.current = [...past.current, snapshot()].slice(-historyLimit);
        future.current = [];
      }
      onChange(edit.value);
      force();
      requestAnimationFrame(() => {
        const ta = targetRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(edit.start, edit.end);
        setActive(activeFormats(edit.value, edit.start, edit.end));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, historyLimit, targetRef],
  );

  const apply = React.useCallback(
    (format: RichTextFormat) => {
      const s = snapshot();
      commit(applyMarkdownFormat(s.value, s.start, s.end, format));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit],
  );

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(snapshot());
    commit(prev, false);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(snapshot());
    commit(next, false);
  };

  // Shortcuts, caret tracking and list continuation on the textarea itself.
  React.useEffect(() => {
    const ta = targetRef.current;
    if (!ta) return;
    const track = () => setActive(activeFormats(ta.value, ta.selectionStart, ta.selectionEnd));
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      let f: RichTextFormat | null = null;
      if (mod && !e.shiftKey && k === "b") f = "bold";
      else if (mod && !e.shiftKey && k === "i") f = "italic";
      else if (mod && !e.shiftKey && k === "e") f = "code";
      else if (mod && !e.shiftKey && k === "k") f = "link";
      else if (mod && e.shiftKey && k === "x") f = "strike";
      else if (mod && e.shiftKey && (k === "8" || k === "*")) f = "bullet";
      else if (mod && e.shiftKey && (k === "7" || k === "&")) f = "numbered";
      else if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      } else if (mod && k === "y") {
        e.preventDefault();
        redo();
        return;
      } else if (e.key === "Enter" && !e.shiftKey && ta.selectionStart === ta.selectionEnd) {
        const v = ta.value;
        const pos = ta.selectionStart;
        const line = v.slice(v.lastIndexOf("\n", pos - 1) + 1, pos);
        const m = line.match(/^(\s*)(- \[[ x]\] |- |> |(\d+)\. )(.*)$/);
        if (m) {
          e.preventDefault();
          const [, indent = "", marker = "", num, rest = ""] = m;
          if (!rest.trim()) {
            // Empty item ends the list.
            const ls = pos - line.length;
            commit({ value: v.slice(0, ls) + v.slice(pos), start: ls, end: ls });
            return;
          }
          const nextMarker = num
            ? `${Number(num) + 1}. `
            : marker.startsWith("- [")
              ? "- [ ] "
              : marker;
          const ins = `\n${indent}${nextMarker}`;
          commit({
            value: v.slice(0, pos) + ins + v.slice(pos),
            start: pos + ins.length,
            end: pos + ins.length,
          });
        }
        return;
      }
      if (f && !exclude.includes(f)) {
        e.preventDefault();
        apply(f);
      }
    };
    ta.addEventListener("keydown", onKey);
    ta.addEventListener("keyup", track);
    ta.addEventListener("mouseup", track);
    ta.addEventListener("select", track);
    return () => {
      ta.removeEventListener("keydown", onKey);
      ta.removeEventListener("keyup", track);
      ta.removeEventListener("mouseup", track);
      ta.removeEventListener("select", track);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRef, apply, commit, disabled, exclude.join()]);

  const onToolbarKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const btns = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-tool]"),
    );
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i === -1) return;
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % btns.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + btns.length) % btns.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = btns.length - 1;
    if (n < 0) return;
    e.preventDefault();
    setFocusIdx(n);
    btns[n]?.focus();
  };

  const fmtKeys = (k?: string) => (k ? ` (${k.replace("Mod", isMac ? "⌘" : "Ctrl")})` : "");
  const btn = (
    idx: number,
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    pressed?: boolean,
    off?: boolean,
  ) => (
    <button
      key={label}
      type="button"
      data-tool=""
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      tabIndex={idx === focusIdx ? 0 : -1}
      disabled={disabled || off}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        setFocusIdx(idx);
        onClick();
      }}
      className={cn(
        "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-crm-soft outline-none",
        "hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5",
        pressed && "bg-crm-muted text-crm-fg shadow-crm-raised",
      )}
    >
      {icon}
    </button>
  );

  let idx = 0;
  const groups: React.ReactNode[] = [];
  [0, 1, 2].forEach((g) => {
    const inGroup = tools.filter((t) => t.group === g);
    if (!inGroup.length) return;
    if (groups.length)
      groups.push(
        <span
          key={`sep-${g}`}
          role="separator"
          aria-orientation="vertical"
          className="mx-1 h-4 w-px shrink-0 bg-crm-border"
        />,
      );
    inGroup.forEach((t) =>
      groups.push(
        btn(
          idx++,
          `${t.label}${fmtKeys(t.keys)}`,
          t.icon,
          () => apply(t.format),
          active.has(t.format),
        ),
      ),
    );
  });
  groups.push(
    <span
      key="sep-h"
      role="separator"
      aria-orientation="vertical"
      className="mx-1 h-4 w-px shrink-0 bg-crm-border"
    />,
  );
  groups.push(
    btn(idx++, `Undo${fmtKeys("Mod+Z")}`, <Undo2 />, undo, undefined, !past.current.length),
  );
  groups.push(
    btn(idx++, `Redo${fmtKeys("Mod+Shift+Z")}`, <Redo2 />, redo, undefined, !future.current.length),
  );

  const over = maxLength !== undefined && value.length > maxLength;

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-disabled={disabled || undefined}
      onKeyDown={onToolbarKey}
      className={cn(
        "flex min-h-9 items-center gap-0.5 overflow-x-auto border-b border-crm-border px-1.5 py-1 font-crm",
        className,
      )}
    >
      {groups}
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        {maxLength !== undefined ? (
          <span
            className={cn("crm-caption tabular-nums", over ? "text-crm-danger" : "text-crm-subtle")}
            aria-live="polite"
          >
            {value.length.toLocaleString()}/{maxLength.toLocaleString()}
          </span>
        ) : null}
        {trailing}
      </div>
    </div>
  );
}
