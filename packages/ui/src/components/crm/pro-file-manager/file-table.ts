import * as React from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  extension,
  fileCategory,
  type FileKindFilter,
  type FileNode,
  type FileSort,
} from "@/components/crm/pro-file-manager/types";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const helper = createColumnHelper<typeof features, FileNode>();

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const columns = helper.columns([
  helper.accessor("name", {
    id: "name",
    header: "Name",
    sortFn: (a, b) => collator.compare(a.original.name, b.original.name),
  }),
  helper.accessor("modifiedAt", {
    id: "modifiedAt",
    header: "Modified",
    sortFn: (a, b) => a.original.modifiedAt - b.original.modifiedAt,
  }),
  helper.accessor((n) => n.size ?? -1, {
    id: "size",
    header: "Size",
    sortFn: (a, b) => (a.original.size ?? -1) - (b.original.size ?? -1),
  }),
  helper.accessor((n) => (n.kind === "folder" ? "" : extension(n.name)), {
    id: "type",
    header: "Type",
    sortFn: (a, b) =>
      collator.compare(extension(a.original.name), extension(b.original.name)) ||
      collator.compare(a.original.name, b.original.name),
  }),
]);

/**
 * TanStack Table (v9) model for the visible items: search and kind filtering (O(n) pre-pass),
 * then the table's sorted row model. Folders always come before files via a stable partition.
 */
export function useFileTable(
  items: FileNode[],
  sort: FileSort,
  query: string,
  kind: FileKindFilter,
) {
  const data = React.useMemo(() => {
    const q = query.toLowerCase();
    if (!q && kind === "all") return items;
    return items.filter(
      (n) =>
        (kind === "all" || fileCategory(n) === kind) && (!q || n.name.toLowerCase().includes(q)),
    );
  }, [items, query, kind]);

  const sorting = React.useMemo(() => [{ id: sort.key, desc: sort.desc }], [sort]);
  const table = useTable({
    features,
    columns,
    data,
    state: { sorting },
    getRowId: (n) => n.id,
  });
  const model = table.getRowModel();
  const rows = React.useMemo(() => {
    const folders: FileNode[] = [];
    const files: FileNode[] = [];
    for (const r of model.rows) (r.original.kind === "folder" ? folders : files).push(r.original);
    return folders.concat(files);
  }, [model]);
  return { table, rows };
}
