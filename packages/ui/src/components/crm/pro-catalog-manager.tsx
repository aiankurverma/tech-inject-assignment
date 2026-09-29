import * as React from "react";
import {
  useTable,
  type ColumnDef,
  type ExpandedState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  AlertCircle,
  ChevronsDownUp,
  ChevronsUpDown,
  Loader2,
  Redo2,
  Search,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCatalogHistory } from "@/hooks/use-catalog-history";
import {
  applyEdits,
  bulkPrice,
  diffCatalog,
  indexCatalog,
  matchesQuery,
  planVariants,
  toRow,
  validateCatalog,
  type BulkPriceOptions,
} from "@/components/crm/pro-catalog-manager/catalog";
import { CatalogGrid } from "@/components/crm/pro-catalog-manager/grid";
import { tableFeatureSet as features } from "@/components/crm/pro-catalog-manager/columns";
import { OptionEditor } from "@/components/crm/pro-catalog-manager/option-editor";
import { BulkPrice } from "@/components/crm/pro-catalog-manager/bulk-price";
import type {
  CatalogChanges,
  CatalogRow,
  CellEdit,
  Product,
  ProductOption,
} from "@/components/crm/pro-catalog-manager/types";

export type {
  Product,
  Variant,
  ProductOption,
  CatalogChanges,
  CatalogStatus,
} from "@/components/crm/pro-catalog-manager/types";
export { planVariants, cartesian } from "@/components/crm/pro-catalog-manager/catalog";

export interface ProCatalogManagerProps {
  /** Saved catalog. Changing the reference resets the editor (e.g. after a refetch). */
  products: Product[];
  /** Persists edits. Resolve to accept them as the new saved state; reject to keep them dirty. */
  onSave?: (changes: CatalogChanges, next: Product[]) => void | Promise<void>;
  /** Fires with the working copy after every edit, undo or redo. */
  onChange?: (next: Product[]) => void;
  readOnly?: boolean;
  loading?: boolean;
  /** Error from loading the catalog; replaces the grid. */
  error?: string | null;
  /** Expand every product on first render (default: collapsed). */
  defaultExpanded?: boolean;
  className?: string;
  height?: number | string;
}

const columns: ColumnDef<typeof features, CatalogRow>[] = [{ id: "row", accessorFn: (r) => r.id }];

const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-crm-border bg-crm-raised px-2.5 text-[12.5px] text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:pointer-events-none disabled:opacity-40";

export function ProCatalogManager({
  products,
  onSave,
  onChange,
  readOnly = false,
  loading = false,
  error = null,
  defaultExpanded = false,
  className,
  height = 640,
}: ProCatalogManagerProps) {
  const gridId = React.useId();
  const h = useCatalogHistory(products);
  const { doc, saved, apply, undo, redo, reset, markSaved } = h;

  const lastProducts = React.useRef(products);
  React.useEffect(() => {
    if (products !== lastProducts.current) {
      lastProducts.current = products;
      reset(products);
    }
  }, [products, reset]);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const firstDoc = React.useRef(doc);
  React.useEffect(() => {
    if (doc !== firstDoc.current) onChangeRef.current?.(doc);
  }, [doc]);

  const idx = React.useMemo(() => indexCatalog(doc), [doc]);
  const { dirty, changes } = React.useMemo(() => diffCatalog(saved, doc), [saved, doc]);
  const { errors, dupes } = React.useMemo(() => validateCatalog(doc), [doc]);
  const variantCount = React.useMemo(() => doc.reduce((a, p) => a + p.variants.length, 0), [doc]);

  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());
  const [onlyChanged, setOnlyChanged] = React.useState(false);
  const data = React.useMemo(() => {
    const changed = onlyChanged ? new Set(changes.updated.map((p) => p.id)) : null;
    const out: CatalogRow[] = [];
    for (const p of doc)
      if ((!changed || changed.has(p.id)) && matchesQuery(p, deferredQuery)) out.push(toRow(p));
    return out;
  }, [doc, deferredQuery, onlyChanged, changes]);

  const [expanded, setExpanded] = React.useState<ExpandedState>(defaultExpanded ? true : {});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const table = useTable({
    features,
    columns,
    data,
    getSubRows: (r) => (r.kind === "product" ? r.subRows : undefined),
    getRowId: (r) => r.id,
    state: { expanded, rowSelection },
    onExpandedChange: setExpanded,
    onRowSelectionChange: setRowSelection,
    enableSubRowSelection: true,
    autoResetExpanded: false,
  });
  const rows = table.getRowModel().rows;

  const [rangeIds, setRangeIds] = React.useState<string[]>([]);
  const target = React.useMemo(() => {
    const picked = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    const source = picked.length ? picked : rangeIds;
    const ids = new Set<string>();
    for (const id of source) {
      if (idx.variants.has(id)) ids.add(id);
      else {
        const pi = idx.products.get(id);
        if (pi !== undefined) for (const v of doc[pi]!.variants) ids.add(v.id);
      }
    }
    return { ids, label: picked.length ? "checked rows" : "selected cells" };
  }, [rowSelection, rangeIds, idx, doc]);

  const onEdits = React.useCallback(
    (edits: CellEdit[], label: string) => apply(label, (d) => applyEdits(d, edits, idx)),
    [apply, idx],
  );
  const onBulk = (o: BulkPriceOptions) =>
    apply(`Bulk ${o.field} change`, (d) => {
      for (const id of target.ids) {
        const pos = idx.variants.get(id);
        const v = pos && d[pos[0]]?.variants[pos[1]];
        if (!v) continue;
        const next = bulkPrice(v[o.field], o);
        if (next === null) continue;
        if (o.field === "price") v.price = next;
        else v[o.field] = next;
      }
    });

  const [optionsFor, setOptionsFor] = React.useState<string | null>(null);
  const optionsProduct =
    optionsFor !== null ? (doc[idx.products.get(optionsFor) ?? -1] ?? null) : null;
  const onApplyOptions = (productId: string, options: ProductOption[]) => {
    const pi = idx.products.get(productId);
    const p = pi !== undefined ? doc[pi] : undefined;
    if (!p || pi === undefined) return;
    const plan = planVariants(p, options);
    apply("Generate variants", (d) => {
      d[pi]!.options = options;
      d[pi]!.variants = plan.variants;
    });
    setExpanded((e) => (e === true ? e : { ...e, [productId]: true }));
  };

  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const isDirty = changes.updated.length > 0;
  const save = async () => {
    if (!onSave || errors > 0) return;
    setSaving(true);
    setSaveError(null);
    const snapshot = doc;
    try {
      await onSave(changes, snapshot);
      markSaved(snapshot);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };
  React.useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const allSelected = table.getIsAllRowsSelected();
  const someSelected = table.getIsSomeRowsSelected();

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised",
        className,
      )}
      style={{ height }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2">
        <div className="relative min-w-48 flex-1 sm:max-w-72">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-crm-muted-fg" />
          <input
            type="search"
            aria-label="Search products, vendors or SKUs"
            placeholder="Search products, vendors, SKUs…"
            className="h-8 w-full rounded-md border border-crm-input bg-crm-bg pl-7 pr-2 text-[13px] outline-none focus-visible:border-crm-primary"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={btn}
          onClick={() => table.toggleAllRowsExpanded(!table.getIsAllRowsExpanded())}
        >
          {table.getIsAllRowsExpanded() ? (
            <ChevronsDownUp className="size-3.5" />
          ) : (
            <ChevronsUpDown className="size-3.5" />
          )}
          {table.getIsAllRowsExpanded() ? "Collapse" : "Expand"} all
        </button>
        <label className="flex items-center gap-1.5 text-[12.5px] text-crm-soft">
          <input
            type="checkbox"
            className="size-3.5 accent-[var(--color-crm-primary)]"
            checked={onlyChanged}
            onChange={(e) => setOnlyChanged(e.target.checked)}
          />
          Changed only
        </label>
        <div className="ml-auto flex items-center gap-2">
          {!readOnly && (
            <>
              <BulkPrice
                targetCount={target.ids.size}
                targetLabel={target.label}
                onApply={onBulk}
              />
              <button
                type="button"
                className={btn}
                onClick={undo}
                disabled={!h.canUndo}
                title={h.undoLabel ? `Undo ${h.undoLabel} (Ctrl+Z)` : "Undo"}
              >
                <Undo2 className="size-3.5" />
                <span className="sr-only">Undo</span>
              </button>
              <button
                type="button"
                className={btn}
                onClick={redo}
                disabled={!h.canRedo}
                title={h.redoLabel ? `Redo ${h.redoLabel} (Ctrl+Y)` : "Redo"}
              >
                <Redo2 className="size-3.5" />
                <span className="sr-only">Redo</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center"
        >
          <AlertCircle className="size-6 text-crm-danger" />
          <p className="text-[13px] text-crm-fg">Couldn’t load the catalog</p>
          <p className="text-[12.5px] text-crm-muted-fg">{error}</p>
        </div>
      ) : loading ? (
        <div
          className="flex flex-1 flex-col gap-2 p-3"
          aria-busy="true"
          aria-label="Loading catalog"
        >
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="h-7 animate-pulse rounded bg-crm-muted" />
          ))}
        </div>
      ) : doc.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-crm-muted-fg">
          No products yet.
        </div>
      ) : (
        <CatalogGrid
          gridId={gridId}
          rows={rows}
          dirty={dirty}
          dupes={dupes}
          readOnly={readOnly}
          onEdits={onEdits}
          onEditOptions={setOptionsFor}
          onUndo={undo}
          onRedo={redo}
          allSelected={allSelected}
          someSelected={someSelected}
          onToggleAll={() => table.toggleAllRowsSelected(!allSelected)}
          onRangeChange={setRangeIds}
        />
      )}

      <div
        className={cn(
          "flex flex-wrap items-center gap-3 border-t border-crm-border px-3 py-2 text-[12px]",
          isDirty ? "bg-crm-raised" : "bg-crm-card",
        )}
        aria-live="polite"
      >
        <span className="text-crm-muted-fg">
          {doc.length.toLocaleString()} products · {variantCount.toLocaleString()} variants
        </span>
        <span className="hidden text-crm-faint lg:inline">
          Enter edit · Ctrl+D fill down · Ctrl+V paste from Excel · Shift+arrows select
        </span>
        {errors > 0 && (
          <span className="flex items-center gap-1 text-crm-danger">
            <AlertCircle className="size-3.5" /> {errors} invalid cell{errors === 1 ? "" : "s"}
          </span>
        )}
        {saveError && <span className="text-crm-danger">{saveError}</span>}
        {isDirty && !readOnly && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-crm-soft">
              {changes.changedCells.toLocaleString()} unsaved change
              {changes.changedCells === 1 ? "" : "s"} in {changes.updated.length} product
              {changes.updated.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className={btn}
              disabled={saving}
              onClick={() => apply("Discard changes", () => saved)}
            >
              Discard
            </button>
            {onSave && (
              <button
                type="button"
                disabled={saving || errors > 0}
                title={errors > 0 ? "Fix invalid cells before saving" : undefined}
                onClick={save}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-crm-primary px-3 text-[12.5px] font-medium text-crm-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-50"
              >
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>
        )}
      </div>

      <OptionEditor
        product={optionsProduct}
        onOpenChange={(o) => !o && setOptionsFor(null)}
        onApply={onApplyOptions}
      />
    </div>
  );
}
