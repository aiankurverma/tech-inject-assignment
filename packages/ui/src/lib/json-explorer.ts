// Pure helpers for the Pro JSON Explorer: pointers, display paths, lazy flattening, in-house
// path search and a jsondiffpatch delta walker. No React in here so it stays unit-testable.
import type { Delta } from "jsondiffpatch";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonType = "object" | "array" | "string" | "number" | "boolean" | "null";
export type Segment = string | number;

export function typeOf(value: unknown): JsonType {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "object") return "object";
  if (t === "number" || t === "string" || t === "boolean") return t;
  return "null";
}

export const isContainer = (v: unknown): v is JsonValue[] | Record<string, JsonValue> =>
  v !== null && typeof v === "object";

/** RFC 6901 JSON pointer, "" is the root. Used as the stable row id. */
export function toPointer(path: readonly Segment[]): string {
  let out = "";
  for (const s of path) out += "/" + String(s).replace(/~/g, "~0").replace(/\//g, "~1");
  return out;
}

export function fromPointer(pointer: string): string[] {
  if (!pointer) return [];
  return pointer
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
/** JSONPath-style display path: $.data.items[3]["content-type"] */
export function toDisplayPath(path: readonly Segment[]): string {
  let out = "$";
  for (const s of path) {
    if (typeof s === "number") out += `[${s}]`;
    else out += IDENT.test(s) ? `.${s}` : `[${JSON.stringify(s)}]`;
  }
  return out;
}

export function getAt(root: unknown, path: readonly Segment[]): unknown {
  let cur: unknown = root;
  for (const s of path) {
    if (!isContainer(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[s as string];
  }
  return cur;
}

/** Structural-sharing immutable set; only the spine to `path` is copied. */
export function setAt(root: JsonValue, path: readonly Segment[], value: JsonValue): JsonValue {
  if (!path.length) return value;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = root.slice();
    copy[head as number] = setAt(copy[head as number] ?? null, rest, value);
    return copy;
  }
  const obj = (isContainer(root) ? root : {}) as Record<string, JsonValue>;
  return { ...obj, [head as string]: setAt(obj[head as string] ?? null, rest, value) };
}

export function removeAt(root: JsonValue, path: readonly Segment[]): JsonValue {
  if (!path.length) return null;
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1];
  const parent = getAt(root, parentPath);
  if (!isContainer(parent)) return root;
  let next: JsonValue;
  if (Array.isArray(parent)) next = parent.filter((_, i) => i !== last);
  else {
    const keep = { ...(parent as Record<string, JsonValue>) };
    delete keep[last as string];
    next = keep;
  }
  return parentPath.length ? setAt(root, parentPath, next) : next;
}

export interface FlatRow {
  id: string;
  path: Segment[];
  key: Segment | null;
  depth: number;
  value: unknown;
  type: JsonType;
  size: number;
  expanded: boolean;
  /** 1-based position and set size among siblings, for aria-posinset / aria-setsize. */
  pos: number;
  setSize: number;
  parentId: string | null;
}

/**
 * Flatten only expanded containers. Cost is O(visible rows), never O(document), so a 20MB
 * payload with a handful of expanded nodes flattens in microseconds.
 */
export function flatten(root: unknown, expanded: ReadonlySet<string>, rootLabel = true): FlatRow[] {
  const rows: FlatRow[] = [];
  const visit = (
    value: unknown,
    path: Segment[],
    key: Segment | null,
    depth: number,
    pos: number,
    setSize: number,
    parentId: string | null,
  ) => {
    const id = toPointer(path);
    const type = typeOf(value);
    const container = type === "object" || type === "array";
    const size = container
      ? Array.isArray(value)
        ? value.length
        : Object.keys(value as object).length
      : 0;
    const isOpen = container && expanded.has(id);
    rows.push({
      id,
      path,
      key,
      depth,
      value,
      type,
      size,
      expanded: isOpen,
      pos,
      setSize,
      parentId,
    });
    if (!isOpen) return;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++)
        visit(value[i], [...path, i], i, depth + 1, i + 1, value.length, id);
    } else {
      const keys = Object.keys(value as object);
      for (let i = 0; i < keys.length; i++)
        visit(
          (value as Record<string, unknown>)[keys[i] as string],
          [...path, keys[i] as string],
          keys[i] as string,
          depth + 1,
          i + 1,
          keys.length,
          id,
        );
    }
  };
  if (rootLabel) visit(root, [], null, 0, 1, 1, null);
  return rows;
}

/** Every container pointer down to `maxDepth` (for "expand all" on sane depths). */
export function containerIds(root: unknown, maxDepth: number, limit = 5000): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown, path: Segment[], depth: number) => {
    if (!isContainer(v) || depth > maxDepth || out.size >= limit) return;
    out.add(toPointer(path));
    if (Array.isArray(v)) v.forEach((c, i) => walk(c, [...path, i], depth + 1));
    else
      for (const k of Object.keys(v))
        walk((v as Record<string, unknown>)[k], [...path, k], depth + 1);
  };
  walk(root, [], 0);
  return out;
}

/** Pointers of every ancestor container of `pointer` (so a match can be revealed). */
export function ancestorIds(pointer: string): string[] {
  const parts = fromPointer(pointer);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++)
    out.push(
      parts
        .slice(0, i)
        .reduce((acc, p) => acc + "/" + p.replace(/~/g, "~0").replace(/\//g, "~1"), ""),
    );
  return out;
}

// ---------- in-house path search ----------
// Supported syntax (a pragmatic JSONPath subset, written in-house because jsonpath-plus is not
// on the approved list for this component):
//   $.a.b        child      $.a[0]    index      $.a[*] / $.a.*   wildcard
//   $..id        recursive descent               $.a["x-y"]       quoted key
// Anything not starting with "$" is a case-insensitive text search over keys and primitive values.

type Step = { kind: "child"; key: Segment | "*" } | { kind: "descend"; key: Segment | "*" };

export function parsePathQuery(q: string): Step[] | null {
  if (!q.startsWith("$")) return null;
  const steps: Step[] = [];
  let i = 1;
  while (i < q.length) {
    let descend = false;
    if (q.startsWith("..", i)) {
      descend = true;
      i += 2;
    } else if (q[i] === ".") i += 1;
    let key: Segment | "*";
    if (q[i] === "[") {
      const end = q.indexOf("]", i);
      if (end < 0) return null;
      const inner = q.slice(i + 1, end).trim();
      i = end + 1;
      if (inner === "*") key = "*";
      else if (/^\d+$/.test(inner)) key = Number(inner);
      else if (/^(".*"|'.*')$/.test(inner)) key = inner.slice(1, -1);
      else return null;
    } else {
      const m = /^[^.[\]]+/.exec(q.slice(i));
      if (!m) return null;
      key = m[0] === "*" ? "*" : m[0];
      i += m[0].length;
    }
    steps.push({ kind: descend ? "descend" : "child", key });
  }
  return steps;
}

const keyMatches = (k: Segment, want: Segment | "*") => want === "*" || String(k) === String(want);

export interface SearchResult {
  ids: string[];
  truncated: boolean;
  mode: "path" | "text" | "invalid";
}

export function searchJson(root: unknown, query: string, limit = 2000): SearchResult {
  const q = query.trim();
  if (!q) return { ids: [], truncated: false, mode: "text" };
  const ids: string[] = [];
  let truncated = false;
  const steps = parsePathQuery(q);
  if (q.startsWith("$")) {
    if (!steps) return { ids: [], truncated: false, mode: "invalid" };
    const run = (v: unknown, path: Segment[], si: number) => {
      if (truncated) return;
      if (si === steps.length) {
        if (ids.length >= limit) truncated = true;
        else ids.push(toPointer(path));
        return;
      }
      if (!isContainer(v)) return;
      const step = steps[si];
      if (!step) return;
      const entries: [Segment, unknown][] = Array.isArray(v)
        ? v.map((c, i) => [i, c])
        : Object.keys(v).map((k) => [k, (v as Record<string, unknown>)[k]]);
      for (const [k, child] of entries) {
        if (keyMatches(k, step.key)) run(child, [...path, k], si + 1);
        if (step.kind === "descend") run(child, [...path, k], si);
      }
    };
    run(root, [], 0);
    return { ids, truncated, mode: "path" };
  }
  const needle = q.toLowerCase();
  const walk = (v: unknown, path: Segment[]) => {
    if (truncated) return;
    const key = path[path.length - 1];
    const hit =
      (typeof key === "string" && key.toLowerCase().includes(needle)) ||
      (!isContainer(v) && String(v).toLowerCase().includes(needle));
    if (hit) {
      if (ids.length >= limit) {
        truncated = true;
        return;
      }
      ids.push(toPointer(path));
    }
    if (Array.isArray(v)) for (let i = 0; i < v.length; i++) walk(v[i], [...path, i]);
    else if (isContainer(v))
      for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k], [...path, k]);
  };
  walk(root, []);
  return { ids, truncated, mode: "text" };
}

// ---------- jsondiffpatch delta walker ----------
export type ChangeKind = "added" | "removed" | "modified" | "moved";
export interface Change {
  id: string;
  path: Segment[];
  kind: ChangeKind;
  before?: unknown;
  after?: unknown;
  to?: number;
}

/** Turn a jsondiffpatch delta into a flat, path-addressed change list. */
export function deltaToChanges(delta: Delta | undefined, base: Segment[] = []): Change[] {
  const out: Change[] = [];
  const walk = (d: unknown, path: Segment[]) => {
    if (d === undefined) return;
    if (Array.isArray(d)) {
      const id = toPointer(path);
      if (d.length === 1) out.push({ id, path, kind: "added", after: d[0] });
      else if (d.length === 2) out.push({ id, path, kind: "modified", before: d[0], after: d[1] });
      else if (d.length === 3 && d[2] === 0) out.push({ id, path, kind: "removed", before: d[0] });
      else if (d.length === 3 && d[2] === 3)
        out.push({ id, path, kind: "moved", to: d[1] as number });
      else if (d.length === 3 && d[2] === 2)
        out.push({ id, path, kind: "modified", before: "(text diff)", after: d[0] });
      return;
    }
    if (!isContainer(d)) return;
    const obj = d as Record<string, unknown>;
    const isArr = obj._t === "a";
    for (const k of Object.keys(obj)) {
      if (k === "_t") continue;
      if (isArr) {
        const removed = k.startsWith("_");
        const idx = Number(removed ? k.slice(1) : k);
        walk(obj[k], [...path, idx]);
      } else walk(obj[k], [...path, k]);
    }
  };
  walk(delta, base);
  return out;
}

export function preview(value: unknown, max = 80): string {
  const t = typeOf(value);
  if (t === "string") {
    const s = JSON.stringify(value);
    return s.length > max ? s.slice(0, max - 1) + '…"' : s;
  }
  if (t === "array") return `Array(${(value as unknown[]).length})`;
  if (t === "object") return `{${Object.keys(value as object).length} keys}`;
  return String(value);
}

/** Parse what a user typed into an edit box: JSON literal first, then fall back to a string. */
export function parseLiteral(text: string): JsonValue {
  const t = text.trim();
  if (t === "") return "";
  try {
    return JSON.parse(t) as JsonValue;
  } catch {
    return text;
  }
}
