import * as React from "react";
import { deriveOptions, runFilters } from "@/components/crm/pro-filter-bar/operators";
import type {
  FacetCounts,
  FilterCondition,
  FilterField,
  FilterOption,
} from "@/components/crm/pro-filter-bar/types";

export interface FilteredRows<TRow> {
  rows: TRow[];
  facets: FacetCounts;
  /** Enum options per field (declared, or derived from the data by frequency). */
  options: Record<string, FilterOption[]>;
  /** True while a deferred re-filter of a large list is still pending. */
  stale: boolean;
}

/**
 * Client-side filtering for lists that live in memory. One pass per filter change computes
 * both the matching rows and every facet count; the work is deferred so typing in a chip
 * never blocks input on 100k-row lists. For server-side lists, skip this hook and pass
 * `facets`/`options` from your API to <ProFilterBar /> instead.
 */
export function useFilteredRows<TRow>(
  rows: readonly TRow[],
  fields: readonly FilterField<TRow>[],
  filters: FilterCondition[],
): FilteredRows<TRow> {
  const deferred = React.useDeferredValue(filters);
  const options = React.useMemo(() => {
    const out: Record<string, FilterOption[]> = {};
    for (const f of fields)
      if (f.type === "enum" || f.type === "boolean") out[f.id] = deriveOptions(rows, f);
    return out;
  }, [rows, fields]);
  const result = React.useMemo(() => runFilters(rows, fields, deferred), [rows, fields, deferred]);
  return { ...result, options, stale: deferred !== filters };
}
