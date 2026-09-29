import * as React from "react";
import { produce } from "immer";
import {
  diffGrants,
  fromIndex,
  toIndex,
  type GrantChange,
  type GrantIndex,
  type RbacGrants,
} from "@/lib/rbac-matrix";

export interface UseRbacStateOptions {
  value?: RbacGrants;
  defaultValue?: RbacGrants;
  onChange?: (next: RbacGrants) => void;
  /** Saved state the dirty diff is computed against. Defaults to the first value seen. */
  baseline?: RbacGrants;
}

export interface RbacState {
  index: GrantIndex;
  baseline: GrantIndex;
  changes: GrantChange[];
  changedCells: ReadonlySet<string>;
  /** Set explicit grants for every (role, perm) pair in one immutable update. */
  set: (roleIds: string[], permIds: string[], on: boolean) => void;
  discard: () => void;
  markSaved: () => void;
}

export const cellKey = (roleId: string, permId: string) => `${roleId}\u0000${permId}`;

/**
 * Working copy of the grants (controlled or uncontrolled) with immer-powered bulk updates and a
 * memoised jsondiffpatch dirty diff against the saved baseline.
 */
export function useRbacState(opts: UseRbacStateOptions): RbacState {
  const controlled = opts.value !== undefined;
  const [inner, setInner] = React.useState<GrantIndex>(() =>
    toIndex(opts.value ?? opts.defaultValue ?? {}),
  );
  const [savedInner, setSavedInner] = React.useState<GrantIndex>(() =>
    toIndex(opts.baseline ?? opts.value ?? opts.defaultValue ?? {}),
  );
  const controlledIndex = React.useMemo(
    () => (opts.value ? toIndex(opts.value) : null),
    [opts.value],
  );
  const index = controlled ? controlledIndex! : inner;
  const baselineProp = React.useMemo(
    () => (opts.baseline ? toIndex(opts.baseline) : null),
    [opts.baseline],
  );
  const baseline = baselineProp ?? savedInner;

  const { onChange } = opts;
  const commit = React.useCallback(
    (next: GrantIndex) => {
      if (!controlled) setInner(next);
      onChange?.(fromIndex(next));
    },
    [controlled, onChange],
  );

  const set = React.useCallback(
    (roleIds: string[], permIds: string[], on: boolean) => {
      const next = produce(index, (draft) => {
        for (const r of roleIds) {
          const row = (draft[r] ??= {});
          for (const p of permIds) {
            if (on) row[p] = true;
            else delete row[p];
          }
        }
      });
      if (next !== index) commit(next);
    },
    [index, commit],
  );

  const changes = React.useMemo(() => diffGrants(baseline, index), [baseline, index]);
  const changedCells = React.useMemo(
    () => new Set(changes.map((c) => cellKey(c.roleId, c.permId))),
    [changes],
  );

  return {
    index,
    baseline,
    changes,
    changedCells,
    set,
    discard: React.useCallback(() => commit(baseline), [commit, baseline]),
    markSaved: React.useCallback(() => setSavedInner(index), [index]),
  };
}
