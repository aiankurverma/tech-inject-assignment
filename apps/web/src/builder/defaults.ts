/**
 * Starting props for a component dropped into the builder, so required props (arrays such as
 * `steps`, `items`, `columns`) are never undefined in the live preview.
 *
 * 1. Literal props from the component's first registry example (the author's own usage).
 *    Only JSON-safe values are kept: functions, JSX and state are dropped, never evaluated.
 * 2. Required props still missing get a placeholder generated from the `props` metadata.
 */
import { literalOptions } from "./propsSchema";
import type { ComponentDetail, PropDoc } from "./types";

const SKIP = Symbol("skip");
type Parsed = unknown | typeof SKIP;

const OPEN: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** Index just past a quoted string or template literal that starts at `i`. */
function skipString(src: string, i: number): number {
  const q = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== q) {
    if (src[j] === "\\") j++;
    else if (q === "`" && src[j] === "$" && src[j + 1] === "{") j = skipBalanced(src, j + 1) - 1;
    j++;
  }
  return j + 1;
}

/** Index just past the bracket group opening at `i`. */
function skipBalanced(src: string, i: number): number {
  const stack = [OPEN[src[i]!]!];
  let j = i + 1;
  while (j < src.length && stack.length) {
    const c = src[j]!;
    if (c === '"' || c === "'" || c === "`") {
      j = skipString(src, j);
      continue;
    }
    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === stack[stack.length - 1]) stack.pop();
    j++;
  }
  return j;
}

/**
 * Tolerant parser for JS object/array literals. Values it cannot express as JSON (functions,
 * JSX, identifiers, calls) come back as SKIP and are dropped from their parent.
 */
class LiteralParser {
  i = 0;
  constructor(readonly src: string) {}

  ws() {
    for (;;) {
      while (/\s/.test(this.src[this.i] ?? "")) this.i++;
      if (this.src.startsWith("//", this.i)) {
        const n = this.src.indexOf("\n", this.i);
        this.i = n < 0 ? this.src.length : n;
      } else if (this.src.startsWith("/*", this.i)) {
        const n = this.src.indexOf("*/", this.i);
        this.i = n < 0 ? this.src.length : n + 2;
      } else return;
    }
  }

  /** Skips one expression up to the next `,` or closing bracket at this level. */
  skipExpr(): typeof SKIP {
    while (this.i < this.src.length) {
      const c = this.src[this.i]!;
      if (c === "," || c === "}" || c === "]" || c === ")") break;
      if (c === '"' || c === "'" || c === "`") this.i = skipString(this.src, this.i);
      else if (OPEN[c]) this.i = skipBalanced(this.src, this.i);
      else this.i++;
    }
    return SKIP;
  }

  /** Parses a value; if anything follows it before the separator the whole value is skipped. */
  value(): Parsed {
    this.ws();
    const start = this.i;
    const v = this.atom();
    this.ws();
    const c = this.src[this.i];
    if (v !== SKIP && c !== undefined && c !== "," && c !== "}" && c !== "]" && c !== ")") {
      this.i = start;
      return this.skipExpr();
    }
    return v === SKIP ? this.skipExpr() : v;
  }

  atom(): Parsed {
    const s = this.src;
    const c = s[this.i];
    if (c === '"' || c === "'") {
      const end = skipString(s, this.i);
      const raw = s.slice(this.i + 1, end - 1);
      this.i = end;
      return raw.replace(/\\(.)/g, (_, ch: string) => (ch === "n" ? "\n" : ch === "t" ? "\t" : ch));
    }
    if (c === "`") {
      const end = skipString(s, this.i);
      const raw = s.slice(this.i + 1, end - 1);
      if (raw.includes("${")) return SKIP;
      this.i = end;
      return raw;
    }
    if (c === "[") return this.array();
    if (c === "{") return this.object();
    const m = /^(-?\d[\d_]*(\.\d+)?(e[+-]?\d+)?|true|false|null)(?![\w$])/.exec(s.slice(this.i));
    if (m) {
      this.i += m[0].length;
      return m[0] === "true"
        ? true
        : m[0] === "false"
          ? false
          : m[0] === "null"
            ? null
            : Number(m[0].replace(/_/g, ""));
    }
    return SKIP;
  }

  array(): unknown[] {
    this.i++; // [
    const out: unknown[] = [];
    for (;;) {
      this.ws();
      if (this.src[this.i] === "]" || this.i >= this.src.length) break;
      if (this.src.startsWith("...", this.i)) this.skipExpr();
      else {
        const v = this.value();
        if (v !== SKIP) out.push(v);
      }
      this.ws();
      if (this.src[this.i] === ",") this.i++;
      else if (this.src[this.i] !== "]") this.skipExpr();
      if (this.src[this.i] === ")" || this.src[this.i] === "}") return out;
    }
    this.i++; // ]
    return out;
  }

  object(): Record<string, unknown> {
    this.i++; // {
    const out: Record<string, unknown> = {};
    for (;;) {
      this.ws();
      if (this.src[this.i] === "}" || this.i >= this.src.length) break;
      const key = this.key();
      this.ws();
      if (key !== null && this.src[this.i] === ":") {
        this.i++;
        this.ws();
        // A helper call (`history(...)`, `rows.map(...)`) almost always builds a data list the
        // component iterates, so an empty array keeps it safe; JSX and callbacks are dropped.
        const isCall = /^(?!function\b)[A-Za-z_$][\w$.]*\s*\(/.test(this.src.slice(this.i));
        const v = this.value();
        if (v !== SKIP) out[key] = v;
        else if (isCall) out[key] = [];
      } else this.skipExpr(); // shorthand, spread, method
      this.ws();
      if (this.src[this.i] === ",") this.i++;
      else if (this.src[this.i] !== "}") {
        this.skipExpr();
        if (this.src[this.i] === ",") this.i++;
        else if (this.src[this.i] !== "}") return out;
      }
    }
    this.i++; // }
    return out;
  }

  key(): string | null {
    const c = this.src[this.i];
    if (c === '"' || c === "'") {
      const v = this.atom();
      return typeof v === "string" ? v : null;
    }
    const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(this.src.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return m[0];
  }
}

/** Parses a literal expression; SKIP when it is not (fully or partly) JSON-expressible. */
export function parseLiteral(src: string): unknown {
  const p = new LiteralParser(src.trim());
  const v = p.value();
  return v === SKIP ? undefined : v;
}

/** Source of `const|let name = <expr>` in `code`, stopping at the end of the expression. */
function constSource(code: string, name: string): string | null {
  const re = new RegExp(`(?:const|let|var)\\s+${name.replace(/\$/g, "\\$")}\\s*(?::[^=]+)?=\\s*`);
  const m = re.exec(code);
  if (!m) return null;
  const start = m.index + m[0].length;
  const c = code[start];
  if (c && OPEN[c]) return code.slice(start, skipBalanced(code, start));
  const end = code.slice(start).search(/[;\n]/);
  return code.slice(start, end < 0 ? undefined : start + end);
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
const SKIP_ATTRS = new Set(["className", "style", "key", "ref"]);

/**
 * Literal props of the first `<exportName ...>` element in an example. Identifiers are
 * resolved against top-level `const` declarations; JSX children that are plain text become
 * `children`.
 */
export function propsFromExample(code: string, exportName: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const tag = new RegExp(`<${exportName}(?![\\w$.])`).exec(code);
  if (!tag) return out;
  let i = tag.index + tag[0].length;
  let selfClosing = false;
  while (i < code.length) {
    while (/\s/.test(code[i] ?? "")) i++;
    if (code.startsWith("/>", i)) {
      selfClosing = true;
      i += 2;
      break;
    }
    if (code[i] === ">") {
      i++;
      break;
    }
    if (code[i] === "{") {
      i = skipBalanced(code, i); // {...spread}
      continue;
    }
    const m = /^[A-Za-z_$][\w$-]*/.exec(code.slice(i));
    if (!m) break;
    const name = m[0];
    i += name.length;
    while (/\s/.test(code[i] ?? "")) i++;
    let value: unknown = true;
    if (code[i] === "=") {
      i++;
      while (/\s/.test(code[i] ?? "")) i++;
      const c = code[i];
      if (c === '"' || c === "'") {
        const end = skipString(code, i);
        value = code.slice(i + 1, end - 1);
        i = end;
      } else if (c === "{") {
        const end = skipBalanced(code, i);
        const expr = code.slice(i + 1, end - 1).trim();
        i = end;
        const src = IDENT.test(expr) ? constSource(code, expr) : expr;
        value = src === null ? undefined : parseLiteral(src);
      } else break;
    }
    if (SKIP_ATTRS.has(name) || /^on[A-Z]/.test(name) || !IDENT.test(name)) continue;
    if (value !== undefined) out[name] = value;
  }
  if (!selfClosing) {
    const close = code.indexOf(`</${exportName}>`, i);
    const text = close < 0 ? "" : code.slice(i, close).trim();
    if (text && !/[<{}]/.test(text)) out.children = text.replace(/\s+/g, " ");
  }
  return out;
}

/** Placeholder for a required prop from its documented type; undefined when none fits. */
export function placeholderFor(prop: PropDoc, componentName: string): unknown {
  const t = prop.type
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*\|\s*(undefined|null)$/, "");
  if (t.includes("=>")) return undefined; // callbacks cannot be expressed in JSON
  if (/\[\]$|^(readonly )?Array<|^ReadonlyArray</.test(t)) return [];
  if (/^boolean$/.test(t)) return false;
  if (/^number$/.test(t)) return 0;
  const options = literalOptions(t);
  if (options?.length) return options[0];
  if (/^(Date|string \| Date|Date \| string)$/.test(t)) return new Date(0).toISOString();
  if (
    /^(string|React\.?ReactNode|ReactNode|React\.ReactElement|ReactElement|string \| number|number \| string)$/.test(
      t,
    )
  )
    return prop.name === "children" ? componentName : prop.name;
  if (/^Record<|^\{/.test(t)) return {};
  return undefined;
}

/** Documented default as a value, when it is plain JSON-ish (e.g. `"md"`, `0`, `[]`). */
function documentedDefault(raw: string | undefined): unknown {
  if (raw === undefined || raw === "" || raw === "undefined") return undefined;
  return parseLiteral(raw);
}

/** Starting props for a newly added node of this component. */
export function defaultProps(detail: ComponentDetail, exportName: string): Record<string, unknown> {
  const code = detail.examples?.[0]?.code ?? "";
  const props = code ? propsFromExample(code, exportName) : {};
  for (const p of detail.props ?? []) {
    if (!p.required || p.name in props || !IDENT.test(p.name)) continue;
    const v = documentedDefault(p.default) ?? placeholderFor(p, detail.name);
    if (v !== undefined) props[p.name] = v;
  }
  return props;
}
