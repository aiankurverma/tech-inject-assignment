// Pure model for the Pro RBAC Permission Matrix: grant indexes, role inheritance, grouping,
// tri-state maths and a jsondiffpatch-based dirty diff. No React here.
import { create as createDiffPatcher } from "jsondiffpatch";

export interface RbacRole {
  id: string;
  name: string;
  description?: string;
  /** Parent role ids; their grants flow down (transitively) as "inherited". */
  inherits?: string[];
  /** Locked roles (e.g. Owner) render read-only. */
  locked?: boolean;
  members?: number;
}

export interface RbacPermission {
  id: string;
  resource: string;
  action: string;
  description?: string;
  risk?: "low" | "medium" | "high";
}

/** Serialisable grants: role id -> explicitly granted permission ids. */
export type RbacGrants = Record<string, string[]>;
/** O(1) lookup form used internally (and diffed). */
export type GrantIndex = Record<string, Record<string, true>>;

export function toIndex(grants: RbacGrants): GrantIndex {
  const out: GrantIndex = {};
  for (const role of Object.keys(grants)) {
    const set: Record<string, true> = {};
    for (const p of grants[role] ?? []) set[p] = true;
    out[role] = set;
  }
  return out;
}

export function fromIndex(index: GrantIndex): RbacGrants {
  const out: RbacGrants = {};
  for (const role of Object.keys(index)) out[role] = Object.keys(index[role] ?? {}).sort();
  return out;
}

/** role id -> ordered transitive ancestors (cycle-safe, nearest first). */
export function resolveAncestors(roles: RbacRole[]): Map<string, RbacRole[]> {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const out = new Map<string, RbacRole[]>();
  for (const role of roles) {
    const seen = new Set<string>([role.id]);
    const list: RbacRole[] = [];
    const queue = [...(role.inherits ?? [])];
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const parent = byId.get(id);
      if (!parent) continue;
      list.push(parent);
      queue.push(...(parent.inherits ?? []));
    }
    out.set(role.id, list);
  }
  return out;
}

export type CellState =
  | { kind: "none" }
  | { kind: "explicit"; alsoInherited?: string }
  | { kind: "inherited"; from: string };

export function cellState(
  index: GrantIndex,
  ancestors: Map<string, RbacRole[]>,
  roleId: string,
  permId: string,
): CellState {
  const from = ancestors.get(roleId)?.find((a) => index[a.id]?.[permId]);
  if (index[roleId]?.[permId]) return { kind: "explicit", alsoInherited: from?.name };
  return from ? { kind: "inherited", from: from.name } : { kind: "none" };
}

export const isOn = (s: CellState) => s.kind !== "none";

export type MatrixRow =
  | { kind: "group"; id: string; resource: string; permIds: string[]; collapsed: boolean }
  | { kind: "perm"; id: string; perm: RbacPermission; group: string };

/** Group permissions by resource (stable order of first appearance), honouring collapse + filter. */
export function buildRows(
  perms: RbacPermission[],
  collapsed: ReadonlySet<string>,
  filter: (p: RbacPermission) => boolean,
): MatrixRow[] {
  const groups = new Map<string, RbacPermission[]>();
  for (const p of perms) {
    if (!filter(p)) continue;
    const g = groups.get(p.resource);
    if (g) g.push(p);
    else groups.set(p.resource, [p]);
  }
  const rows: MatrixRow[] = [];
  for (const [resource, list] of groups) {
    const isCollapsed = collapsed.has(resource);
    rows.push({
      kind: "group",
      id: `g:${resource}`,
      resource,
      permIds: list.map((p) => p.id),
      collapsed: isCollapsed,
    });
    if (!isCollapsed)
      for (const perm of list) rows.push({ kind: "perm", id: perm.id, perm, group: resource });
  }
  return rows;
}

export type TriState = boolean | "mixed";
export function groupState(
  index: GrantIndex,
  ancestors: Map<string, RbacRole[]>,
  roleId: string,
  permIds: string[],
): TriState {
  let on = 0;
  for (const p of permIds) if (isOn(cellState(index, ancestors, roleId, p))) on++;
  return on === 0 ? false : on === permIds.length ? true : "mixed";
}

export interface GrantChange {
  roleId: string;
  permId: string;
  change: "granted" | "revoked";
}

const differ = createDiffPatcher();

/** Dirty diff between a saved baseline and the working copy, via jsondiffpatch. */
export function diffGrants(before: GrantIndex, after: GrantIndex): GrantChange[] {
  const delta = differ.diff(before, after) as Record<string, unknown> | undefined;
  if (!delta) return [];
  const out: GrantChange[] = [];
  for (const roleId of Object.keys(delta)) {
    const d = delta[roleId];
    if (Array.isArray(d)) {
      // Whole role added ([obj]) or removed ([obj, 0, 0]).
      const added = d.length === 1;
      const obj = (added ? d[0] : d[0]) as Record<string, true>;
      for (const permId of Object.keys(obj))
        out.push({ roleId, permId, change: added ? "granted" : "revoked" });
      continue;
    }
    for (const permId of Object.keys(d as object)) {
      const pd = (d as Record<string, unknown[]>)[permId];
      if (!pd) continue;
      if (pd.length === 1) out.push({ roleId, permId, change: "granted" });
      else if (pd.length === 3 && pd[2] === 0) out.push({ roleId, permId, change: "revoked" });
    }
  }
  return out;
}
