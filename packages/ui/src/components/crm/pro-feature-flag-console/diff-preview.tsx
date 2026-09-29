import * as React from "react";
import { create, type Delta } from "jsondiffpatch";
import { cn } from "@/lib/utils";

/** jsondiffpatch instance: array items are matched by id so reordered rules diff as moves. */
const differ = create({
  objectHash: (obj: object, index?: number) => {
    const o = obj as { id?: string; key?: string };
    return o.id ?? o.key ?? `$$index:${index}`;
  },
  arrays: { detectMove: true, includeValueOnMove: false },
});

export type ChangeKind = "added" | "removed" | "changed" | "moved";
export interface Change {
  path: string;
  kind: ChangeKind;
  before?: unknown;
  after?: unknown;
}

/**
 * Flattens a jsondiffpatch delta into readable change rows.
 * Delta encoding: [new] added, [old, new] changed, [old, 0, 0] removed, ["", to, 3] moved,
 * objects with `_t: "a"` are array deltas (keys "n" = new index, "_n" = old index).
 */
function walk(delta: Delta, path: string[], out: Change[], left: unknown) {
  if (delta === undefined) return;
  if (Array.isArray(delta)) {
    const p = path.join(".") || "(root)";
    if (delta.length === 1) out.push({ path: p, kind: "added", after: delta[0] });
    else if (delta.length === 2)
      out.push({ path: p, kind: "changed", before: delta[0], after: delta[1] });
    else if (delta[2] === 0) out.push({ path: p, kind: "removed", before: delta[0] });
    else if (delta[2] === 3)
      out.push({ path: p, kind: "moved", after: `index ${String(delta[1])}` });
    return;
  }
  if (typeof delta !== "object" || delta === null) return;
  const d = delta as Record<string, Delta>;
  const isArray = (d as Record<string, unknown>)._t === "a";
  const leftObj = (left ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(d)) {
    if (k === "_t") continue;
    let seg = k;
    let child: unknown;
    if (isArray) {
      const idx = Number(k.startsWith("_") ? k.slice(1) : k);
      const arr = Array.isArray(left) ? left : [];
      child = arr[idx];
      const named = child as { name?: string; id?: string } | undefined;
      seg = named?.name ? `[${named.name}]` : `[${idx}]`;
    } else {
      child = leftObj[k];
    }
    walk(d[k], [...path, seg], out, child);
  }
}

export function computeChanges(before: unknown, after: unknown): Change[] {
  const delta = differ.diff(before, after);
  const out: Change[] = [];
  if (delta) walk(delta, [], out, before);
  return out;
}

const fmt = (v: unknown) => {
  if (v === undefined) return "";
  const s = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v);
  return s && s.length > 160 ? s.slice(0, 157) + "..." : (s ?? String(v));
};

export function summarizeChanges(changes: Change[]): string[] {
  return changes.map((c) =>
    c.kind === "changed"
      ? `${c.path}: ${fmt(c.before)} → ${fmt(c.after)}`
      : c.kind === "added"
        ? `+ ${c.path}`
        : c.kind === "removed"
          ? `- ${c.path}`
          : `${c.path} moved to ${String(c.after)}`,
  );
}

export function DiffPreview({ before, after }: { before: unknown; after: unknown }) {
  const changes = React.useMemo(() => computeChanges(before, after), [before, after]);
  if (!changes.length) {
    return <p className="text-[13px] text-crm-muted-fg">No changes to save.</p>;
  }
  return (
    <ul
      aria-label="Pending changes"
      className="divide-y divide-crm-border overflow-hidden rounded-md border border-crm-border font-mono text-[12px]"
    >
      {changes.map((c, i) => (
        <li key={i} className="grid grid-cols-[18px_1fr] gap-x-2 px-3 py-2">
          <span
            aria-label={c.kind}
            className={cn(
              "font-semibold",
              c.kind === "added" && "text-crm-success",
              c.kind === "removed" && "text-crm-danger",
              c.kind === "changed" && "text-crm-warning",
              c.kind === "moved" && "text-crm-soft",
            )}
          >
            {c.kind === "added" ? "+" : c.kind === "removed" ? "−" : c.kind === "moved" ? "↕" : "~"}
          </span>
          <div className="min-w-0 space-y-1">
            <div className="text-crm-soft">{c.path}</div>
            {c.kind === "changed" || c.kind === "removed" ? (
              <div className="break-all rounded bg-crm-danger/10 px-1.5 py-0.5 text-crm-danger line-through decoration-crm-danger/40">
                {fmt(c.before)}
              </div>
            ) : null}
            {c.kind === "changed" || c.kind === "added" ? (
              <div className="break-all rounded bg-crm-success/10 px-1.5 py-0.5 text-crm-success">
                {fmt(c.after)}
              </div>
            ) : null}
            {c.kind === "moved" ? <div className="text-crm-muted-fg">{String(c.after)}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
