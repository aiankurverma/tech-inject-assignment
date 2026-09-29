import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

/*
 * In-house SQL tokenizer + highlighter.
 * @codemirror/lang-sql is not approved for this component and @codemirror/language (home of
 * StreamLanguage) is not on the allow-list, so the language mode is a small hand-written lexer
 * whose tokens are painted with mark decorations over the visible ranges only. The same lexer
 * feeds completion (context detection) and lint (identifier resolution).
 */

export type TokenType =
  | "keyword"
  | "function"
  | "type"
  | "identifier"
  | "quoted"
  | "string"
  | "number"
  | "comment"
  | "operator"
  | "punct"
  | "param"
  | "ws";

export interface Token {
  type: TokenType;
  from: number;
  to: number;
  text: string;
  /** Unterminated string, quoted identifier or block comment. */
  open?: boolean;
}

export const KEYWORDS = new Set(
  `select from where and or not in is null like ilike between exists as on join inner left right full outer cross
  group by order having limit offset asc desc distinct union all intersect except case when then else end with
  recursive insert into values update set delete returning create table view index drop alter add column primary
  key foreign references default unique check constraint if true false over partition window rows range
  preceding following current row filter using natural lateral fetch first next only nulls last explain analyze
  begin commit rollback grant revoke truncate cascade restrict`
    .split(/\s+/)
    .filter(Boolean),
);

export const FUNCTIONS = new Set(
  `count sum avg min max coalesce nullif greatest least round floor ceil abs length lower upper trim substring
  replace concat now date_trunc date_part extract to_char cast row_number rank dense_rank lag lead first_value
  last_value string_agg array_agg json_agg jsonb_build_object percentile_cont generate_series`
    .split(/\s+/)
    .filter(Boolean),
);

export const TYPES = new Set(
  "int integer bigint smallint numeric decimal real float double text varchar char boolean bool date timestamp timestamptz interval uuid json jsonb".split(
    " ",
  ),
);

const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdent = (c: string) => /[A-Za-z0-9_$]/.test(c);

/** Linear-time lexer over the whole document. */
export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = src.length;
  const push = (type: TokenType, from: number, to: number, open?: boolean) =>
    out.push({ type, from, to, text: src.slice(from, to), open });

  while (i < n) {
    const c = src[i]!;
    const start = i;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      while (i < n && /\s/.test(src[i]!)) i++;
      push("ws", start, i);
    } else if (c === "-" && src[i + 1] === "-") {
      while (i < n && src[i] !== "\n") i++;
      push("comment", start, i);
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? n : end + 2;
      push("comment", start, i, end < 0);
    } else if (c === "'" || c === '"' || c === "`") {
      i++;
      let closed = false;
      while (i < n) {
        if (src[i] === c) {
          if (src[i + 1] === c) {
            i += 2; // doubled quote escape
            continue;
          }
          i++;
          closed = true;
          break;
        }
        i++;
      }
      push(c === "'" ? "string" : "quoted", start, i, !closed);
    } else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      while (i < n && /[0-9._eE]/.test(src[i]!)) i++;
      push("number", start, i);
    } else if (isIdentStart(c)) {
      while (i < n && isIdent(src[i]!)) i++;
      const word = src.slice(start, i).toLowerCase();
      // A word followed by "(" is a call even when it is not a known function.
      let j = i;
      while (j < n && src[j] === " ") j++;
      const type: TokenType = KEYWORDS.has(word)
        ? "keyword"
        : FUNCTIONS.has(word) || src[j] === "("
          ? "function"
          : TYPES.has(word)
            ? "type"
            : "identifier";
      push(type, start, i);
    } else if ((c === "$" || c === ":") && isIdent(src[i + 1] ?? "") && src[i - 1] !== ":") {
      i++;
      while (i < n && isIdent(src[i]!)) i++;
      push("param", start, i);
    } else if (/[<>=!|&+\-*/%^~:]/.test(c)) {
      while (i < n && /[<>=!|&+\-*/%^~:]/.test(src[i]!) && i - start < 3) i++;
      push("operator", start, i);
    } else {
      i++;
      push("punct", start, i);
    }
  }
  return out;
}

/** Splits a script into statements on top-level ";" (ignores ; in strings/comments). */
export function splitStatements(src: string): { from: number; to: number; text: string }[] {
  const tokens = tokenize(src);
  const out: { from: number; to: number; text: string }[] = [];
  let from = 0;
  for (const t of tokens) {
    if (t.type === "punct" && t.text === ";") {
      out.push({ from, to: t.from, text: src.slice(from, t.from) });
      from = t.to;
    }
  }
  out.push({ from, to: src.length, text: src.slice(from) });
  return out.filter((s) => s.text.trim().length > 0);
}

/** The statement under the cursor (what ⌘Enter runs when nothing is selected). */
export function statementAt(src: string, pos: number) {
  const all = splitStatements(src);
  return (
    all.find((s) => pos >= s.from && pos <= s.to + 1) ??
    [...all].reverse().find((s) => s.to <= pos) ??
    all[0] ?? { from: 0, to: 0, text: "" }
  );
}

// ---------------------------------------------------------------- highlighting

const marks: Partial<Record<TokenType, Decoration>> = {
  keyword: Decoration.mark({ class: "kb-sql-kw" }),
  function: Decoration.mark({ class: "kb-sql-fn" }),
  type: Decoration.mark({ class: "kb-sql-type" }),
  string: Decoration.mark({ class: "kb-sql-str" }),
  quoted: Decoration.mark({ class: "kb-sql-qid" }),
  number: Decoration.mark({ class: "kb-sql-num" }),
  comment: Decoration.mark({ class: "kb-sql-cmt" }),
  operator: Decoration.mark({ class: "kb-sql-op" }),
  param: Decoration.mark({ class: "kb-sql-param" }),
};

class Highlighter {
  decorations: DecorationSet;
  private tokens: Token[];
  constructor(view: EditorView) {
    this.tokens = tokenize(view.state.doc.toString());
    this.decorations = this.build(view);
  }
  update(u: ViewUpdate) {
    if (u.docChanged) this.tokens = tokenize(u.state.doc.toString());
    if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view);
  }
  /** Decorates only tokens intersecting visible ranges (binary search to the first one). */
  private build(view: EditorView): DecorationSet {
    const b = new RangeSetBuilder<Decoration>();
    const toks = this.tokens;
    for (const { from, to } of view.visibleRanges) {
      let lo = 0;
      let hi = toks.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (toks[mid]!.to <= from) lo = mid + 1;
        else hi = mid;
      }
      for (let k = lo; k < toks.length && toks[k]!.from < to; k++) {
        const tk = toks[k]!;
        const m = marks[tk.type];
        if (m && tk.to > tk.from) b.add(tk.from, tk.to, m);
      }
    }
    return b.finish();
  }
}

const highlighter = ViewPlugin.fromClass(Highlighter, { decorations: (v) => v.decorations });

/** Editor chrome in CRM tokens; token colours read CSS variables so themes can override. */
const crmTheme = EditorView.theme(
  {
    "&": {
      color: "var(--color-crm-fg)",
      backgroundColor: "var(--color-crm-bg)",
      fontSize: "13px",
      height: "100%",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      lineHeight: "1.6",
    },
    ".cm-content": { caretColor: "var(--color-crm-fg)", padding: "8px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-crm-fg)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "color-mix(in srgb, var(--color-crm-primary) 35%, transparent) !important",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--color-crm-muted) 45%, transparent)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--color-crm-bg)",
      color: "var(--color-crm-faint)",
      border: "none",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--color-crm-soft)" },
    ".cm-matchingBracket": { backgroundColor: "var(--color-crm-muted)", outline: "none" },
    ".cm-tooltip": {
      backgroundColor: "var(--color-crm-popover)",
      border: "1px solid var(--color-crm-border)",
      borderRadius: "8px",
      boxShadow: "var(--shadow-crm-overlay)",
      color: "var(--color-crm-fg)",
      overflow: "hidden",
    },
    ".cm-tooltip-autocomplete > ul": { fontFamily: "inherit", maxHeight: "16em" },
    ".cm-tooltip-autocomplete > ul > li": { padding: "3px 8px", lineHeight: "1.5" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--color-crm-muted)",
      color: "var(--color-crm-fg)",
    },
    ".cm-completionDetail": {
      color: "var(--color-crm-subtle)",
      fontStyle: "normal",
      marginLeft: "8px",
    },
    ".cm-completionMatchedText": { textDecoration: "none", color: "var(--color-crm-status)" },
    ".cm-completionInfo": { padding: "6px 8px", fontSize: "12px", color: "var(--color-crm-soft)" },
    ".cm-diagnostic": { padding: "4px 8px", fontSize: "12px" },
    ".cm-diagnostic-error": { borderLeftColor: "var(--color-crm-danger)" },
    ".cm-diagnostic-warning": { borderLeftColor: "var(--color-crm-warning)" },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      textDecoration: "underline wavy var(--color-crm-danger)",
      textUnderlineOffset: "3px",
    },
    ".cm-lintRange-warning": {
      backgroundImage: "none",
      textDecoration: "underline wavy var(--color-crm-warning)",
      textUnderlineOffset: "3px",
    },
    ".cm-lint-marker": { width: "0.8em", height: "0.8em" },
    ".cm-panels": { backgroundColor: "var(--color-crm-raised)", color: "var(--color-crm-fg)" },
    ".cm-searchMatch": {
      backgroundColor: "color-mix(in srgb, var(--color-crm-warning) 30%, transparent)",
    },
    ".kb-sql-kw": { color: "var(--kb-sql-keyword, #b7aee9)", fontWeight: "500" },
    ".kb-sql-fn": { color: "var(--kb-sql-function, #93c5fd)" },
    ".kb-sql-type": { color: "var(--kb-sql-type, #5eead4)" },
    ".kb-sql-str": { color: "var(--kb-sql-string, #b1ebc5)" },
    ".kb-sql-qid": { color: "var(--kb-sql-quoted, #fed7aa)" },
    ".kb-sql-num": { color: "var(--kb-sql-number, #fde68a)" },
    ".kb-sql-cmt": { color: "var(--color-crm-subtle)", fontStyle: "italic" },
    ".kb-sql-op": { color: "var(--color-crm-soft)" },
    ".kb-sql-param": { color: "var(--kb-sql-param, #eeb390)" },
  },
  { dark: true },
);

/** Highlighting + theme. Pass to CodeMirror's `extensions` slot. */
export function sqlLanguage(): Extension {
  return [highlighter, crmTheme];
}
