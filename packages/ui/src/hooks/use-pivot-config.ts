import * as React from "react";
import { produce } from "immer";
import type { PivotAggregator, PivotConfig } from "@/lib/pro-pivot";

export type PivotZone = "rows" | "cols" | "values" | "filters";

export type PivotAction =
  | {
      type: "move";
      field: string;
      from: PivotZone | null;
      to: PivotZone;
      index?: number;
      fromIndex?: number;
    }
  | { type: "remove"; zone: PivotZone; index: number }
  | { type: "reorder"; zone: PivotZone; from: number; to: number }
  | { type: "setAgg"; index: number; agg: PivotAggregator }
  | { type: "setFilter"; field: string; excluded: string[] }
  | { type: "swapAxes" }
  | { type: "reset"; config: PivotConfig };

/** Fields shown in the Filters shelf (kept separately from the filter state itself). */
export interface PivotLayout extends PivotConfig {
  filterFields: string[];
}

function zoneList(d: PivotLayout, zone: PivotZone): string[] {
  if (zone === "values") return d.values.map((v) => v.field);
  if (zone === "filters") return d.filterFields;
  return d[zone];
}

/** Pure immer reducer: every edit is a structural-sharing patch of the layout. */
export const pivotReducer = (state: PivotLayout, action: PivotAction): PivotLayout =>
  produce(state, (d) => {
    switch (action.type) {
      case "move": {
        const { field, from, to } = action;
        if (from && from !== "values") {
          const list = from === "filters" ? d.filterFields : d[from];
          const i = action.fromIndex ?? list.indexOf(field);
          if (i >= 0) list.splice(i, 1);
        } else if (from === "values") {
          const i = action.fromIndex ?? d.values.findIndex((v) => v.field === field);
          if (i >= 0) d.values.splice(i, 1);
        }
        // A dimension may live on only one axis at a time.
        if (to === "rows" || to === "cols") {
          const other = to === "rows" ? d.cols : d.rows;
          const j = other.indexOf(field);
          if (j >= 0) other.splice(j, 1);
          if (d[to].includes(field)) return;
          d[to].splice(action.index ?? d[to].length, 0, field);
        } else if (to === "values") {
          d.values.splice(action.index ?? d.values.length, 0, { field, agg: "sum" });
        } else {
          if (!d.filterFields.includes(field))
            d.filterFields.splice(action.index ?? d.filterFields.length, 0, field);
        }
        return;
      }
      case "remove": {
        if (action.zone === "values") d.values.splice(action.index, 1);
        else if (action.zone === "filters") {
          const [f] = d.filterFields.splice(action.index, 1);
          if (f) delete d.filters[f];
        } else d[action.zone].splice(action.index, 1);
        return;
      }
      case "reorder": {
        const list: unknown[] =
          action.zone === "values"
            ? d.values
            : action.zone === "filters"
              ? d.filterFields
              : d[action.zone];
        if (action.to < 0 || action.to >= list.length) return;
        const [item] = list.splice(action.from, 1);
        list.splice(action.to, 0, item);
        return;
      }
      case "setAgg":
        {
          const v = d.values[action.index];
          if (v) v.agg = action.agg;
        }
        return;
      case "setFilter":
        if (action.excluded.length) d.filters[action.field] = action.excluded;
        else delete d.filters[action.field];
        return;
      case "swapAxes": {
        const r = d.rows;
        d.rows = d.cols;
        d.cols = r;
        return;
      }
      case "reset":
        return { ...action.config, filterFields: Object.keys(action.config.filters) };
    }
  });

export { zoneList };

/** Controlled-or-uncontrolled pivot layout. */
export function usePivotConfig(
  value: PivotConfig | undefined,
  defaultValue: PivotConfig,
  onChange?: (c: PivotConfig) => void,
) {
  const toLayout = (c: PivotConfig, prev?: PivotLayout): PivotLayout => ({
    ...c,
    filterFields: [...new Set([...(prev?.filterFields ?? []), ...Object.keys(c.filters)])],
  });
  const [inner, setInner] = React.useState<PivotLayout>(() => toLayout(value ?? defaultValue));
  const layout = React.useMemo(() => (value ? toLayout(value, inner) : inner), [value, inner]);
  const layoutRef = React.useRef(layout);
  React.useLayoutEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  const dispatch = React.useCallback(
    (action: PivotAction) => {
      const next = pivotReducer(layoutRef.current, action);
      if (next === layoutRef.current) return;
      layoutRef.current = next;
      setInner(next);
      onChange?.({ rows: next.rows, cols: next.cols, values: next.values, filters: next.filters });
    },
    [onChange],
  );
  return [layout, dispatch] as const;
}
