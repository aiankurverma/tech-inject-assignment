import * as React from "react";
import { create, type Delta } from "jsondiffpatch";
import { cn } from "@/lib/utils";

export type DiffKind = "added" | "removed" | "changed" | "moved";

export interface DiffLine {
  path: string;
  kind: DiffKind;
  from?: unknown;
  to?: unknown;
}

// Array items are matched by id/key when present so reorders are not reported as full rewrites.
const differ = create({
  objectHash: (obj: object, index?: number) => {
    const o = obj as Record<string, unknown>;
    const key = o.id ?? o.key ?? o.name;
    return key !== undefined ? String(key) : `$$index:${index}`;
  },
  arrays: { detectMove: true, includeValueOnMove: false },
});

/** Flattens a jsondiffpatch delta (see its delta format docs) into path-addressed lines. */
export function diffLines(before: unknown, after: unknown): DiffLine[] {
  const delta = differ.diff(before ?? null, after ?? null);
  const out: DiffLine[] = [];
  walk(delta, "", out);
  return out;
}

function walk(delta: Delta, path: string, out: DiffLine[]) {
  if (delta === undefined) return;
  if (Array.isArray(delta)) {
    if (delta.length === 1) out.push({ path, kind: "added", to: delta[0] });
    else if (delta.length === 2) out.push({ path, kind: "changed", from: delta[0], to: delta[1] });
    else if (delta[2] === 0) out.push({ path, kind: "removed", from: delta[0] });
    else if (delta[2] === 3) out.push({ path, kind: "moved", to: `index ${delta[1]}` });
    return;
  }
  const obj = delta as Record<string, Delta | "a">;
  const isArray = obj._t === "a";
  for (const key of Object.keys(obj)) {
    if (key === "_t") continue;
    const child = isArray
      ? `${path}[${key.startsWith("_") ? key.slice(1) : key}]`
      : path
        ? `${path}.${key}`
        : key;
    walk(obj[key] as Delta, child, out);
  }
}

export function stringifyValue(v: unknown): string {
  if (v === undefined) return "undefined";
  if (typeof v === "string") return JSON.stringify(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const kindStyle: Record<DiffKind, { label: string; cls: string; sign: string }> = {
  added: { label: "Added", cls: "text-crm-success", sign: "+" },
  removed: { label: "Removed", cls: "text-crm-danger", sign: "-" },
  changed: { label: "Changed", cls: "text-crm-warning", sign: "~" },
  moved: { label: "Moved", cls: "text-crm-soft", sign: "→" },
};

export interface JsonDiffViewProps {
  before: unknown;
  after: unknown;
  className?: string;
}

/** Field-level change list for an audit event's before/after snapshots. */
export function JsonDiffView({ before, after, className }: JsonDiffViewProps) {
  const lines = React.useMemo(() => diffLines(before, after), [before, after]);
  if (before === undefined && after === undefined)
    return <p className="text-sm text-crm-muted-fg">This event has no state snapshot.</p>;
  if (lines.length === 0)
    return <p className="text-sm text-crm-muted-fg">No field changes between snapshots.</p>;
  return (
    <ul
      aria-label={`${lines.length} field changes`}
      className={cn("divide-y divide-crm-border rounded-crm border border-crm-border", className)}
    >
      {lines.map((l, i) => {
        const k = kindStyle[l.kind];
        return (
          <li key={`${l.path}-${i}`} className="grid gap-1 px-3 py-2 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span aria-hidden className={cn("w-3 text-center font-semibold", k.cls)}>
                {k.sign}
              </span>
              <span className="truncate text-crm-fg" title={l.path || "(root)"}>
                {l.path || "(root)"}
              </span>
              <span className={cn("ml-auto text-[10px] uppercase tracking-wide", k.cls)}>
                {k.label}
              </span>
            </div>
            {l.kind !== "added" && l.kind !== "moved" && (
              <div className="break-all rounded bg-crm-danger/10 px-2 py-1 text-crm-danger">
                <span className="sr-only">Before: </span>- {stringifyValue(l.from)}
              </div>
            )}
            {l.kind !== "removed" && (
              <div
                className={cn(
                  "break-all rounded px-2 py-1",
                  l.kind === "moved"
                    ? "bg-crm-muted text-crm-soft"
                    : "bg-crm-success/10 text-crm-success",
                )}
              >
                <span className="sr-only">After: </span>+ {stringifyValue(l.to)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
