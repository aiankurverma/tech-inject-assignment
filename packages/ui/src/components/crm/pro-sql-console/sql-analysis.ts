import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import {
  FUNCTIONS,
  KEYWORDS,
  splitStatements,
  tokenize,
  type Token,
} from "@/components/crm/pro-sql-console/sql-language";
import type { SqlTable } from "@/components/crm/pro-sql-console/types";

/** Case-insensitive lookup of tables by bare and schema-qualified name. Build once per schema. */
export interface SchemaIndex {
  tables: SqlTable[];
  byName: Map<string, SqlTable>;
  schemas: Set<string>;
}

export function indexSchema(tables: SqlTable[]): SchemaIndex {
  const byName = new Map<string, SqlTable>();
  const schemas = new Set<string>();
  for (const t of tables) {
    byName.set(t.name.toLowerCase(), t);
    if (t.schema) {
      schemas.add(t.schema.toLowerCase());
      byName.set(`${t.schema}.${t.name}`.toLowerCase(), t);
    }
  }
  return { tables, byName, schemas };
}

const unquote = (s: string) => (/^["`]/.test(s) ? s.slice(1, -1).replace(/""/g, '"') : s);
const significant = (t: Token) => t.type !== "ws" && t.type !== "comment";
const TABLE_KEYWORDS = new Set(["from", "join", "into", "update", "table"]);
const ALIAS_STOP = new Set([
  "where",
  "on",
  "join",
  "inner",
  "left",
  "right",
  "full",
  "cross",
  "group",
  "order",
  "limit",
  "having",
  "union",
  "set",
  "using",
  "natural",
  "lateral",
  "window",
  "offset",
  "returning",
]);

interface Scope {
  /** alias or table name (lowercased) -> table */
  aliases: Map<string, SqlTable>;
  /** Table references that did not resolve, with their token. */
  unknown: Token[];
  /** CTE names (treated as known, columns unknown). */
  ctes: Set<string>;
}

/** Resolves FROM/JOIN table references and their aliases for one statement's tokens. */
function scopeOf(tokens: Token[], schema: SchemaIndex): Scope {
  const sig = tokens.filter(significant);
  const aliases = new Map<string, SqlTable>();
  const unknown: Token[] = [];
  const ctes = new Set<string>();
  for (let i = 0; i < sig.length; i++) {
    // WITH name AS ( ... ) and , name AS (
    const cur = sig[i]!;
    if (
      cur.type === "identifier" &&
      sig[i + 1]?.text.toLowerCase() === "as" &&
      sig[i + 2]?.text === "("
    ) {
      const prev = sig[i - 1]?.text.toLowerCase();
      if (prev === "with" || prev === "," || prev === "recursive") ctes.add(cur.text.toLowerCase());
    }
  }
  for (let i = 0; i < sig.length; i++) {
    const kw = sig[i]!.text.toLowerCase();
    if (sig[i]!.type !== "keyword" || !TABLE_KEYWORDS.has(kw)) continue;
    // Comma-separated lists after FROM: FROM a x, b y
    let j = i + 1;
    while (j < sig.length) {
      const t = sig[j]!;
      if (t.type !== "identifier" && t.type !== "quoted") break;
      let name = unquote(t.text);
      let nameTok = t;
      let k = j + 1;
      const part = sig[k + 1];
      if (sig[k]?.text === "." && part && (part.type === "identifier" || part.type === "quoted")) {
        name = `${name}.${unquote(part.text)}`;
        nameTok = { ...t, to: part.to, text: name };
        k += 2;
      }
      const table = schema.byName.get(name.toLowerCase());
      if (table) {
        aliases.set(name.toLowerCase(), table);
        aliases.set(table.name.toLowerCase(), table);
      } else if (!ctes.has(name.toLowerCase())) unknown.push(nameTok);
      if (sig[k]?.text.toLowerCase() === "as") k++;
      const a = sig[k];
      if (
        a &&
        (a.type === "identifier" || a.type === "quoted") &&
        !ALIAS_STOP.has(a.text.toLowerCase())
      ) {
        if (table) aliases.set(unquote(a.text).toLowerCase(), table);
        else ctes.add(unquote(a.text).toLowerCase());
        k++;
      }
      if (sig[k]?.text === "," && kw === "from") j = k + 1;
      else break;
    }
  }
  return { aliases, unknown, ctes };
}

// ---------------------------------------------------------------- completion

const keywordOptions: Completion[] = [...KEYWORDS].map((k) => ({
  label: k.toUpperCase(),
  type: "keyword",
  boost: -1,
}));
const functionOptions: Completion[] = [...FUNCTIONS].map((f) => ({
  label: f,
  type: "function",
  apply: `${f}()`,
  detail: "fn",
  boost: -2,
}));

function tableOption(t: SqlTable): Completion {
  return {
    label: t.name,
    type: "class",
    detail: t.schema ? `${t.schema} · ${t.columns.length} cols` : `${t.columns.length} cols`,
    info: t.description,
    boost: 2,
  };
}

function columnOptions(t: SqlTable, qualify?: string): Completion[] {
  return t.columns.map((c) => ({
    label: c.name,
    type: "property",
    detail: `${c.type}${qualify ? ` · ${qualify}` : ""}`,
    info: c.description,
    boost: 3,
  }));
}

/** Schema-aware completion: tables after FROM/JOIN, columns after `alias.`, scoped columns elsewhere. */
export function sqlCompletionSource(getSchema: () => SchemaIndex) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const schema = getSchema();
    const doc = ctx.state.doc.toString();
    const stmt = splitStatements(doc).find((s) => ctx.pos >= s.from && ctx.pos <= s.to + 1);
    const base = stmt?.from ?? 0;
    const text = doc.slice(base, stmt ? stmt.to : doc.length);
    const tokens = tokenize(text).map((t) => ({ ...t, from: t.from + base, to: t.to + base }));
    const before = tokens.filter((t) => t.to <= ctx.pos);
    const inside = tokens.find((t) => t.from < ctx.pos && ctx.pos <= t.to);
    if (
      inside &&
      (inside.type === "string" || inside.type === "comment") &&
      (inside.open || ctx.pos < inside.to || inside.text.startsWith("--"))
    )
      return null;

    const word = ctx.matchBefore(/[\w$]*/);
    const from = word ? word.from : ctx.pos;
    const scope = scopeOf(tokens, schema);

    // qualifier.   -> columns of alias/table, or tables of a schema
    const dotted = ctx.matchBefore(/[\w$"]+\.[\w$]*$/);
    if (dotted) {
      const q = unquote(dotted.text.split(".")[0] ?? "").toLowerCase();
      const t = scope.aliases.get(q) ?? schema.byName.get(q);
      if (t) return { from, options: columnOptions(t), validFor: /^[\w$]*$/ };
      if (schema.schemas.has(q))
        return {
          from,
          options: schema.tables.filter((x) => x.schema?.toLowerCase() === q).map(tableOption),
          validFor: /^[\w$]*$/,
        };
      return null;
    }
    if (!word || (word.from === word.to && !ctx.explicit)) return null;

    const prevSig = before.filter(significant).filter((t) => t.from < from);
    const prev = prevSig[prevSig.length - 1];
    const prevKw = prev?.text.toLowerCase();
    if (
      prev &&
      (TABLE_KEYWORDS.has(prevKw ?? "") || (prev.text === "," && isInFromList(prevSig)))
    ) {
      return {
        from,
        options: [
          ...schema.tables.map(tableOption),
          ...[...schema.schemas].map((s) => ({ label: s, type: "namespace" })),
        ],
        validFor: /^[\w$]*$/,
      };
    }
    const scoped = new Set(scope.aliases.values());
    const cols = [...scoped].flatMap((t) => columnOptions(t, scoped.size > 1 ? t.name : undefined));
    const aliasOpts: Completion[] = [...scope.aliases.keys()]
      .filter((a) => !schema.byName.has(a) || scope.aliases.get(a)?.name.toLowerCase() !== a)
      .map((a) => ({
        label: a,
        type: "variable",
        detail: `alias · ${scope.aliases.get(a)?.name}`,
        boost: 1,
      }));
    return {
      from,
      options: [
        ...cols,
        ...aliasOpts,
        ...keywordOptions,
        ...functionOptions,
        ...schema.tables.map((t) => ({ ...tableOption(t), boost: -3 })),
      ],
      validFor: /^[\w$]*$/,
    };
  };
}

function isInFromList(sig: Token[]): boolean {
  for (let i = sig.length - 1; i >= 0; i--) {
    const w = sig[i]!.text.toLowerCase();
    if (sig[i]!.type === "keyword") return w === "from";
  }
  return false;
}

// ---------------------------------------------------------------- lint

/** Squiggles: unknown tables/columns, unbalanced parens, unterminated strings, unsafe DML. */
export function sqlLintSource(getSchema: () => SchemaIndex) {
  return (view: EditorView): Diagnostic[] => {
    const schema = getSchema();
    const doc = view.state.doc.toString();
    const out: Diagnostic[] = [];
    for (const stmt of splitStatements(doc)) {
      const tokens = tokenize(stmt.text).map((t) => ({
        ...t,
        from: t.from + stmt.from,
        to: t.to + stmt.from,
      }));
      const sig = tokens.filter(significant);
      const scope = scopeOf(tokens, schema);

      for (const t of tokens) {
        if (t.open && t.type === "string")
          out.push({
            from: t.from,
            to: t.to,
            severity: "error",
            message: "Unterminated string literal",
          });
        if (t.open && t.type === "quoted")
          out.push({
            from: t.from,
            to: t.to,
            severity: "error",
            message: "Unterminated quoted identifier",
          });
        if (t.open && t.type === "comment")
          out.push({
            from: t.from,
            to: Math.min(t.to, t.from + 2),
            severity: "error",
            message: "Unterminated block comment",
          });
      }

      const stack: Token[] = [];
      for (const t of sig) {
        if (t.text === "(") stack.push(t);
        else if (t.text === ")") {
          if (!stack.pop())
            out.push({
              from: t.from,
              to: t.to,
              severity: "error",
              message: "Unmatched closing parenthesis",
            });
        }
      }
      for (const t of stack)
        out.push({ from: t.from, to: t.to, severity: "error", message: "Unclosed parenthesis" });

      for (const t of scope.unknown)
        out.push({
          from: t.from,
          to: t.to,
          severity: "error",
          message: `Unknown table "${t.text}"`,
          actions: suggest(
            t.text,
            schema.tables.map((x) => x.name),
          ).map((name) => ({
            name: `Use ${name}`,
            apply: (v: EditorView, from: number, to: number) =>
              v.dispatch({ changes: { from, to, insert: name } }),
          })),
        });

      // alias.column checks (only when the alias resolves to a known table)
      for (let i = 0; i + 2 < sig.length; i++) {
        const q0 = sig[i]!;
        if (sig[i + 1]!.text !== "." || (q0.type !== "identifier" && q0.type !== "quoted"))
          continue;
        const col = sig[i + 2]!;
        if (col.type !== "identifier" && col.type !== "quoted") continue;
        const table = scope.aliases.get(unquote(q0.text).toLowerCase());
        if (!table) {
          const q = unquote(q0.text).toLowerCase();
          const prevKw = sig[i - 1]?.text.toLowerCase();
          if (!schema.schemas.has(q) && !scope.ctes.has(q) && !TABLE_KEYWORDS.has(prevKw ?? ""))
            out.push({
              from: q0.from,
              to: q0.to,
              severity: "warning",
              message: `"${q0.text}" is not a table or alias in this query`,
            });
          continue;
        }
        const name = unquote(col.text).toLowerCase();
        if (!table.columns.some((c) => c.name.toLowerCase() === name))
          out.push({
            from: col.from,
            to: col.to,
            severity: "error",
            message: `Column "${col.text}" does not exist on ${table.name}`,
            actions: suggest(
              col.text,
              table.columns.map((c) => c.name),
            ).map((n) => ({
              name: `Use ${n}`,
              apply: (v: EditorView, from: number, to: number) =>
                v.dispatch({ changes: { from, to, insert: n } }),
            })),
          });
      }

      const head = sig[0];
      const first = head?.text.toLowerCase();
      if (
        head &&
        (first === "delete" || first === "update") &&
        !sig.some((t) => t.text.toLowerCase() === "where")
      )
        out.push({
          from: head.from,
          to: head.to,
          severity: "warning",
          message: `${first.toUpperCase()} without WHERE affects every row`,
        });
    }
    return out;
  };
}

/** Up to 2 close names by edit distance (cheap: names are short, lists are small). */
function suggest(input: string, names: string[]): string[] {
  const a = input.toLowerCase();
  return names
    .map((n) => ({ n, d: distance(a, n.toLowerCase()) }))
    .filter((x) => x.d <= Math.max(2, Math.floor(a.length / 3)))
    .sort((x, y) => x.d - y.d)
    .slice(0, 2)
    .map((x) => x.n);
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(tmp + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}
