import * as React from "react";
import { parseAsJson, useQueryState } from "nuqs";
import { gridViewSchema, type GridView } from "@/components/crm/pro-data-grid/types";

const viewParser = parseAsJson<GridView>((value) => {
  const parsed = gridViewSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
});

/**
 * Grid layout state (sort, filters, columns, grouping) mirrored into one URL search param with
 * nuqs, so a view is shareable by link and survives reloads. Invalid or stale URLs fall back to
 * `fallback`. Requires a nuqs adapter (e.g. NuqsAdapter from "nuqs/adapters/react") above the grid.
 */
export function useGridUrlView(key: string, fallback: GridView) {
  const [urlView, setUrlView] = useQueryState(
    key,
    viewParser.withOptions({ history: "replace", clearOnDefault: true }),
  );
  const fallbackJson = React.useMemo(() => JSON.stringify(fallback), [fallback]);
  const view = urlView ?? fallback;
  const setView = React.useCallback(
    (next: GridView) => {
      void setUrlView(JSON.stringify(next) === fallbackJson ? null : next);
    },
    [setUrlView, fallbackJson],
  );
  return [view, setView] as const;
}
