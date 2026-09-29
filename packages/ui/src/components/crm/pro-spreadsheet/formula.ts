/**
 * Formula tokenizer and Pratt parser. Written in-house: every permissively licensed formula
 * engine we evaluated either ships no parser (formulajs only implements functions) or is
 * GPL (HyperFormula). The function library itself comes from @formulajs/formulajs.
 */
import { colIndex, colName } from "@/components/crm/pro-spreadsheet/address";

export type Ast =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "err"; v: string }
  | { t: "ref"; sheet?: string; r: number; c: number }
  | { t: "range"; sheet?: string; r1: number; c1: number; r2: number; c2: number }
  | { t: "fn"; name: string; args: Ast[] }
  | { t: "un"; op: "-" | "+"; x: Ast }
  | { t: "pct"; x: Ast }
  | { t: "bin"; op: string; l: Ast; r: Ast };

type Tok =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "ref"; sheet?: string; r: number; c: number }
  | { k: "name"; v: string }
  | { k: "op"; v: string }
  | { k: "("; v: "(" }
  | { k: ")"; v: ")" }
  | { k: ","; v: "," }
  | { k: ":"; v: ":" };

export class ParseError extends Error {}

const REF_RE = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})(?![\w(])/;
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_.]*/;
const NUM_RE = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/;
const OPS = ["<=", ">=", "<>", "+", "-", "*", "/", "^", "&", "=", "<", ">", "%"];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === " " || ch === "\n" || ch === "\t") {
      i++;
      continue;
    }
    const rest = src.slice(i);
    if (ch === '"') {
      let j = i + 1;
      let s = "";
      while (j < src.length) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            s += '"';
            j += 2;
            continue;
          }
          break;
        }
        s += src[j++];
      }
      if (j >= src.length) throw new ParseError("Unterminated string");
      out.push({ k: "str", v: s });
      i = j + 1;
      continue;
    }
    // Sheet-qualified reference: Sheet1!A1 or 'My sheet'!A1
    let sheet: string | undefined;
    let body = rest;
    let consumed = 0;
    if (ch === "'") {
      const end = src.indexOf("'!", i + 1);
      if (end < 0) throw new ParseError("Bad sheet reference");
      sheet = src.slice(i + 1, end);
      consumed = end + 2 - i;
      body = src.slice(end + 2);
    } else {
      const m = /^([A-Za-z_][\w.]*)!/.exec(rest);
      if (m) {
        sheet = m[1];
        consumed = m[0].length;
        body = rest.slice(consumed);
      }
    }
    const rm = REF_RE.exec(body);
    if (rm && (sheet !== undefined || !/^[A-Za-z_][\w.]*\(/.test(rest))) {
      const c = colIndex(rm[1]!);
      out.push({ k: "ref", sheet, r: Number(rm[2]) - 1, c });
      i += consumed + rm[0].length;
      continue;
    }
    if (sheet !== undefined) throw new ParseError("Bad reference");
    const nm = NUM_RE.exec(rest);
    if (nm) {
      out.push({ k: "num", v: Number(nm[0]) });
      i += nm[0].length;
      continue;
    }
    const name = NAME_RE.exec(rest);
    if (name) {
      out.push({ k: "name", v: name[0].toUpperCase() });
      i += name[0].length;
      continue;
    }
    if (ch === "#") {
      const m = /^#[A-Z/0!?]+[!?A]?/.exec(rest);
      if (m) {
        out.push({ k: "name", v: m[0] });
        i += m[0].length;
        continue;
      }
    }
    if (ch === "(" || ch === ")" || ch === "," || ch === ":") {
      out.push({ k: ch, v: ch } as Tok);
      i++;
      continue;
    }
    const op = OPS.find((o) => rest.startsWith(o));
    if (op) {
      out.push({ k: "op", v: op });
      i += op.length;
      continue;
    }
    throw new ParseError(`Unexpected "${ch}"`);
  }
  return out;
}

const BIN_PREC: Record<string, number> = {
  "=": 1,
  "<>": 1,
  "<": 1,
  ">": 1,
  "<=": 1,
  ">=": 1,
  "&": 2,
  "+": 3,
  "-": 3,
  "*": 4,
  "/": 4,
  "^": 6,
};

/** Parses a formula body (without the leading "="). Throws ParseError. */
export function parseFormula(src: string): Ast {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];

  const primary = (): Ast => {
    const t = next();
    if (!t) throw new ParseError("Unexpected end");
    switch (t.k) {
      case "num":
        return { t: "num", v: t.v };
      case "str":
        return { t: "str", v: t.v };
      case "ref": {
        if (peek()?.k === ":") {
          p++;
          const e = next();
          if (e?.k !== "ref") throw new ParseError("Bad range");
          return {
            t: "range",
            sheet: t.sheet,
            r1: Math.min(t.r, e.r),
            c1: Math.min(t.c, e.c),
            r2: Math.max(t.r, e.r),
            c2: Math.max(t.c, e.c),
          };
        }
        return { t: "ref", sheet: t.sheet, r: t.r, c: t.c };
      }
      case "name": {
        if (t.v.startsWith("#")) return { t: "err", v: t.v };
        if (peek()?.k === "(") {
          p++;
          const args: Ast[] = [];
          if (peek()?.k !== ")") {
            for (;;) {
              args.push(expr(0));
              if (peek()?.k === ",") p++;
              else break;
            }
          }
          if (next()?.k !== ")") throw new ParseError("Missing )");
          return { t: "fn", name: t.v, args };
        }
        if (t.v === "TRUE" || t.v === "FALSE") return { t: "bool", v: t.v === "TRUE" };
        return { t: "err", v: "#NAME?" };
      }
      case "(": {
        const e = expr(0);
        if (next()?.k !== ")") throw new ParseError("Missing )");
        return e;
      }
      case "op":
        if (t.v === "-" || t.v === "+") return { t: "un", op: t.v, x: expr(5) };
        throw new ParseError(`Unexpected ${t.v}`);
      default:
        throw new ParseError(`Unexpected ${t.v}`);
    }
  };

  const expr = (minPrec: number): Ast => {
    let left = primary();
    for (;;) {
      const t = peek();
      if (t?.k !== "op") break;
      if (t.v === "%") {
        p++;
        left = { t: "pct", x: left };
        continue;
      }
      const prec = BIN_PREC[t.v];
      if (prec === undefined || prec < minPrec) break;
      p++;
      // "^" is left-associative in Excel too.
      left = { t: "bin", op: t.v, l: left, r: expr(prec + 1) };
    }
    return left;
  };

  const ast = expr(0);
  if (p < toks.length) throw new ParseError("Unexpected input");
  return ast;
}

const quoteSheet = (name: string) => (/^[A-Za-z_][\w.]*$/.test(name) ? name : `'${name}'`);

/** Rewrites Sheet!A1 references after a sheet rename (outside string literals). */
export function renameSheetRefs(raw: string, from: string, to: string): string {
  if (!raw.startsWith("=") || !raw.toLowerCase().includes(from.toLowerCase())) return raw;
  const lower = from.toLowerCase();
  return raw.replace(
    /"(?:[^"]|"")*"|'([^']+)'!|([A-Za-z_][\w.]*)!/g,
    (m, quoted: string | undefined, bare: string | undefined) => {
      const name = quoted ?? bare;
      return name && name.toLowerCase() === lower ? `${quoteSheet(to)}!` : m;
    },
  );
}

/**
 * Shifts relative references in a formula by (dr, dc), leaving $-anchored parts alone.
 * References pushed off the sheet become #REF!. Non-formulas are returned unchanged.
 */
export function shiftFormula(raw: string, dr: number, dc: number): string {
  if (!raw.startsWith("=") || (dr === 0 && dc === 0)) return raw;
  let out = "";
  let i = 0;
  const src = raw;
  const re = /(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![\w(])/y;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '"') {
      const end = src.indexOf('"', i + 1);
      const stop = end < 0 ? src.length : end + 1;
      out += src.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === "'") {
      const end = src.indexOf("'!", i + 1);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop);
      i = stop;
      continue;
    }
    const prev = src[i - 1];
    if (!prev || !/[\w.$]/.test(prev)) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m) {
        const col = colIndex(m[2]!);
        const row = Number(m[4]) - 1;
        const nc = m[1] ? col : col + dc;
        const nr = m[3] ? row : row + dr;
        out += nc < 0 || nr < 0 ? "#REF!" : `${m[1]}${colName(nc)}${m[3]}${nr + 1}`;
        i += m[0].length;
        continue;
      }
      // Skip whole identifiers (function or sheet names) so their tails are not treated as refs.
      const id = /^[A-Za-z_][\w.]*/.exec(src.slice(i));
      if (id) {
        out += id[0];
        i += id[0].length;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}
