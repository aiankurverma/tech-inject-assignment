/**
 * Incremental recalculation engine with a cell dependency graph.
 *
 * - Formulas are parsed once and their references recorded as graph edges (single cells in a
 *   reverse index, ranges in a per-sheet list).
 * - Values are computed lazily and memoised; an edit invalidates only its transitive
 *   dependents, so typing in one of 10k rows does not recalculate the workbook.
 * - Evaluation is iterative (explicit stack) so long chains such as running totals filled down
 *   10k rows cannot overflow the JS call stack; cycles resolve to #CYCLE!.
 *
 * Built in-house: no MIT/Apache formula engine with a dependency graph exists (HyperFormula is
 * GPL). The function library underneath is @formulajs/formulajs.
 */
import { cellKey, inRange, type CellRange } from "@/components/crm/pro-spreadsheet/address";
import { parseFormula, ParseError, type Ast } from "@/components/crm/pro-spreadsheet/formula";
import {
  ERR,
  FUNCTIONS,
  FormulaError,
  isError,
  toNumber,
  toText,
  type Arg,
  type CellValue,
} from "@/components/crm/pro-spreadsheet/functions";

export interface EngineSheet {
  id: string;
  name: string;
  cells: Record<string, string>;
}

interface Dep extends CellRange {
  sheet: string;
}

interface Compiled {
  ast: Ast;
  deps: Dep[];
}

interface SheetState {
  id: string;
  cells: Record<string, string>;
  formulas: Map<string, Compiled>;
  /** Formula cells (by gkey) that reference a range on this sheet. */
  rangeDeps: Map<string, CellRange[]>;
}

const gk = (sheet: string, key: string) => `${sheet}!${key}`;
const NUM_LITERAL = /^[-+]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** Interprets a raw (non-formula) cell string. */
export function literal(raw: string | undefined): CellValue {
  if (raw === undefined || raw === "") return null;
  if (raw.startsWith("'")) return raw.slice(1);
  const t = raw.trim();
  if (NUM_LITERAL.test(t)) return Number(t);
  if (/^[-+]?\d+(\.\d+)?%$/.test(t)) return Number(t.slice(0, -1)) / 100;
  if (/^[-+]?\$?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/[$,]/g, ""));
  const up = t.toUpperCase();
  if (up === "TRUE" || up === "FALSE") return up === "TRUE";
  if (/^#(REF!|VALUE!|DIV\/0!|N\/A|NAME\?|NUM!)$/.test(up)) return new FormulaError(up);
  return raw;
}

function compare(a: CellValue, b: CellValue): number {
  const rank = (v: CellValue) =>
    typeof v === "number" || v === null ? 0 : typeof v === "string" ? 1 : 2;
  if (a === null) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0;
  if (b === null) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === "string" && typeof b === "string") {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return Number(a) - Number(b);
}

const truthy = (v: CellValue): boolean | FormulaError => {
  if (isError(v)) return v;
  if (typeof v === "string") {
    const u = v.toUpperCase();
    if (u === "TRUE" || u === "FALSE") return u === "TRUE";
    return ERR.value;
  }
  return !!v;
};

export class SpreadsheetEngine {
  private sheets = new Map<string, SheetState>();
  private byName = new Map<string, string>();
  private values = new Map<string, CellValue>();
  private revSingle = new Map<string, Set<string>>();

  constructor(sheets: readonly EngineSheet[]) {
    this.rebuild(sheets);
  }

  /** Recompiles everything; used on load and when sheets are added, removed or renamed. */
  rebuild(sheets: readonly EngineSheet[]) {
    this.sheets.clear();
    this.byName.clear();
    this.values.clear();
    this.revSingle.clear();
    for (const s of sheets) {
      this.byName.set(s.name.toLowerCase(), s.id);
      this.sheets.set(s.id, {
        id: s.id,
        cells: s.cells,
        formulas: new Map(),
        rangeDeps: new Map(),
      });
    }
    for (const s of sheets)
      for (const [key, raw] of Object.entries(s.cells))
        if (raw.startsWith("=")) this.addFormula(s.id, key, raw);
  }

  /** Applies a new version of the workbook, invalidating only what changed. */
  sync(prev: readonly EngineSheet[], next: readonly EngineSheet[]) {
    const structural =
      prev.length !== next.length ||
      prev.some((s, i) => s.id !== next[i]!.id || s.name !== next[i]!.name);
    if (structural) return this.rebuild(next);
    const seen = new Set<string>();
    next.forEach((s, i) => {
      const old = prev[i]!.cells;
      if (old === s.cells) return;
      const st = this.sheets.get(s.id)!;
      st.cells = s.cells;
      const changed: string[] = [];
      for (const k in s.cells) if (old[k] !== s.cells[k]) changed.push(k);
      for (const k in old) if (!(k in s.cells)) changed.push(k);
      for (const key of changed) {
        this.invalidate(s.id, key, seen);
        this.removeFormula(s.id, key);
        const raw = s.cells[key];
        if (raw?.startsWith("=")) this.addFormula(s.id, key, raw);
      }
    });
  }

  /** Computed value of a cell (formulas are evaluated on demand and memoised). */
  getValue(sheetId: string, r: number, c: number): CellValue {
    const st = this.sheets.get(sheetId);
    if (!st) return ERR.ref;
    const key = cellKey(r, c);
    if (!st.formulas.has(key)) return literal(st.cells[key]);
    const g = gk(sheetId, key);
    if (!this.values.has(g)) this.ensure(sheetId, key);
    return this.values.get(g) ?? ERR.cycle;
  }

  isFormula(sheetId: string, r: number, c: number) {
    return this.sheets.get(sheetId)?.formulas.has(cellKey(r, c)) ?? false;
  }

  get formulaCount() {
    let n = 0;
    for (const s of this.sheets.values()) n += s.formulas.size;
    return n;
  }

  // ---- graph maintenance ----

  private addFormula(sheetId: string, key: string, raw: string) {
    let ast: Ast;
    try {
      ast = parseFormula(raw.slice(1));
    } catch (e) {
      ast = { t: "err", v: e instanceof ParseError ? "#ERROR!" : "#VALUE!" };
    }
    const deps: Dep[] = [];
    const walk = (n: Ast) => {
      if (n.t === "ref" || n.t === "range") {
        const sheet = n.sheet ? this.byName.get(n.sheet.toLowerCase()) : sheetId;
        if (!sheet) return;
        deps.push(
          n.t === "ref"
            ? { sheet, r1: n.r, c1: n.c, r2: n.r, c2: n.c }
            : { sheet, r1: n.r1, c1: n.c1, r2: n.r2, c2: n.c2 },
        );
      } else if (n.t === "fn") n.args.forEach(walk);
      else if (n.t === "bin") {
        walk(n.l);
        walk(n.r);
      } else if (n.t === "un" || n.t === "pct") walk(n.x);
    };
    walk(ast);
    const g = gk(sheetId, key);
    this.sheets.get(sheetId)!.formulas.set(key, { ast, deps });
    for (const d of deps) {
      if (d.r1 === d.r2 && d.c1 === d.c2) {
        const target = gk(d.sheet, cellKey(d.r1, d.c1));
        let set = this.revSingle.get(target);
        if (!set) this.revSingle.set(target, (set = new Set()));
        set.add(g);
      } else {
        const rd = this.sheets.get(d.sheet)!.rangeDeps;
        const list = rd.get(g);
        if (list) list.push(d);
        else rd.set(g, [d]);
      }
    }
  }

  private removeFormula(sheetId: string, key: string) {
    const st = this.sheets.get(sheetId)!;
    const f = st.formulas.get(key);
    if (!f) return;
    const g = gk(sheetId, key);
    for (const d of f.deps) {
      if (d.r1 === d.r2 && d.c1 === d.c2)
        this.revSingle.get(gk(d.sheet, cellKey(d.r1, d.c1)))?.delete(g);
      else this.sheets.get(d.sheet)?.rangeDeps.delete(g);
    }
    st.formulas.delete(key);
    this.values.delete(g);
  }

  /** Drops memoised values of a cell and everything downstream of it. */
  private invalidate(sheetId: string, key: string, seen: Set<string>) {
    const start = gk(sheetId, key);
    if (seen.has(start)) return;
    seen.add(start);
    const queue: string[] = [start];
    while (queue.length) {
      const g = queue.pop()!;
      this.values.delete(g);
      const bang = g.indexOf("!");
      const sid = g.slice(0, bang);
      const k = g.slice(bang + 1);
      const colon = k.indexOf(":");
      const r = Number(k.slice(0, colon));
      const c = Number(k.slice(colon + 1));
      const push = (d: string) => {
        if (!seen.has(d)) {
          seen.add(d);
          queue.push(d);
        }
      };
      this.revSingle.get(g)?.forEach(push);
      const st = this.sheets.get(sid);
      if (st)
        for (const [dep, ranges] of st.rangeDeps)
          if (!seen.has(dep) && ranges.some((rg) => inRange(rg, r, c))) push(dep);
    }
  }

  // ---- evaluation ----

  /** Formula cells a formula reads that have not been computed yet. */
  private pending(f: Compiled, out: [string, string][]) {
    for (const d of f.deps) {
      const st = this.sheets.get(d.sheet);
      if (!st || st.formulas.size === 0) continue;
      const area = (d.r2 - d.r1 + 1) * (d.c2 - d.c1 + 1);
      if (area <= st.formulas.size) {
        for (let r = d.r1; r <= d.r2; r++)
          for (let c = d.c1; c <= d.c2; c++) {
            const key = cellKey(r, c);
            if (st.formulas.has(key) && !this.values.has(gk(d.sheet, key)))
              out.push([d.sheet, key]);
          }
      } else {
        for (const key of st.formulas.keys()) {
          if (this.values.has(gk(d.sheet, key))) continue;
          const colon = key.indexOf(":");
          if (inRange(d, Number(key.slice(0, colon)), Number(key.slice(colon + 1))))
            out.push([d.sheet, key]);
        }
      }
    }
  }

  private ensure(sheetId: string, key: string) {
    const state = new Map<string, 1 | 2>();
    const stack: { s: string; k: string; open: boolean; cyclic: boolean }[] = [
      { s: sheetId, k: key, open: false, cyclic: false },
    ];
    const buf: [string, string][] = [];
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const g = gk(top.s, top.k);
      const f = this.sheets.get(top.s)?.formulas.get(top.k);
      if (!f || this.values.has(g)) {
        stack.pop();
        continue;
      }
      if (!top.open) {
        top.open = true;
        state.set(g, 1);
        buf.length = 0;
        this.pending(f, buf);
        for (const [s, k] of buf) {
          const cg = gk(s, k);
          const st = state.get(cg);
          if (st === 1) top.cyclic = true;
          else if (st !== 2) stack.push({ s, k, open: false, cyclic: false });
        }
        continue;
      }
      stack.pop();
      state.set(g, 2);
      this.values.set(g, top.cyclic ? ERR.cycle : this.toCell(this.evaluate(f.ast, top.s)));
    }
  }

  private toCell(a: Arg): CellValue {
    if (Array.isArray(a)) return a.length === 1 && a[0]!.length === 1 ? a[0]![0]! : ERR.value;
    return a;
  }

  private read(sheetId: string, r: number, c: number): CellValue {
    const st = this.sheets.get(sheetId);
    if (!st) return ERR.ref;
    const key = cellKey(r, c);
    if (st.formulas.has(key)) return this.values.get(gk(sheetId, key)) ?? ERR.cycle;
    return literal(st.cells[key]);
  }

  private resolve(name: string | undefined, current: string) {
    return name ? this.byName.get(name.toLowerCase()) : current;
  }

  private scalar(n: Ast, sheet: string): CellValue {
    const v = this.evaluate(n, sheet);
    return Array.isArray(v) ? (v.length === 1 && v[0]!.length === 1 ? v[0]![0]! : ERR.value) : v;
  }

  private evaluate(n: Ast, sheet: string): Arg {
    switch (n.t) {
      case "num":
      case "str":
      case "bool":
        return n.v;
      case "err":
        return new FormulaError(n.v);
      case "ref": {
        const s = this.resolve(n.sheet, sheet);
        return s ? this.read(s, n.r, n.c) : ERR.ref;
      }
      case "range": {
        const s = this.resolve(n.sheet, sheet);
        if (!s) return ERR.ref;
        const rows: CellValue[][] = [];
        for (let r = n.r1; r <= n.r2; r++) {
          const row: CellValue[] = [];
          for (let c = n.c1; c <= n.c2; c++) row.push(this.read(s, r, c));
          rows.push(row);
        }
        return rows;
      }
      case "un": {
        const x = toNumber(this.scalar(n.x, sheet));
        return isError(x) ? x : n.op === "-" ? -x : x;
      }
      case "pct": {
        const x = toNumber(this.scalar(n.x, sheet));
        return isError(x) ? x : x / 100;
      }
      case "bin":
        return this.binary(n.op, this.scalar(n.l, sheet), this.scalar(n.r, sheet));
      case "fn":
        return this.call(n.name, n.args, sheet);
    }
  }

  private binary(op: string, a: CellValue, b: CellValue): CellValue {
    if (isError(a)) return a;
    if (isError(b)) return b;
    if (op === "&") return toText(a) + toText(b);
    if (op === "=" || op === "<>" || op === "<" || op === ">" || op === "<=" || op === ">=") {
      const d = compare(a, b);
      return op === "="
        ? d === 0
        : op === "<>"
          ? d !== 0
          : op === "<"
            ? d < 0
            : op === ">"
              ? d > 0
              : op === "<="
                ? d <= 0
                : d >= 0;
    }
    const x = toNumber(a);
    const y = toNumber(b);
    if (isError(x)) return x;
    if (isError(y)) return y;
    switch (op) {
      case "+":
        return x + y;
      case "-":
        return x - y;
      case "*":
        return x * y;
      case "/":
        return y === 0 ? ERR.div0 : x / y;
      case "^": {
        const p = Math.pow(x, y);
        return Number.isFinite(p) ? p : ERR.num;
      }
      default:
        return ERR.value;
    }
  }

  private call(name: string, args: Ast[], sheet: string): CellValue {
    switch (name) {
      case "IF": {
        const cond = truthy(this.scalar(args[0] ?? { t: "bool", v: false }, sheet));
        if (isError(cond)) return cond;
        const branch = cond ? args[1] : args[2];
        return branch ? this.scalar(branch, sheet) : cond ? true : false;
      }
      case "IFERROR":
      case "IFNA": {
        const v = args[0] ? this.scalar(args[0], sheet) : null;
        const hit = name === "IFERROR" ? isError(v) : isError(v) && v.code === "#N/A";
        return hit ? (args[1] ? this.scalar(args[1], sheet) : null) : v;
      }
      case "CHOOSE": {
        const i = toNumber(args[0] ? this.scalar(args[0], sheet) : null);
        if (isError(i)) return i;
        const pick = args[Math.trunc(i)];
        return pick && i >= 1 ? this.scalar(pick, sheet) : ERR.value;
      }
    }
    const impl = FUNCTIONS[name];
    if (!impl) return ERR.name;
    return impl(args.map((a) => this.evaluate(a, sheet)));
  }
}
