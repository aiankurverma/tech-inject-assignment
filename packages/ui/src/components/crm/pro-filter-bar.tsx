import * as React from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Loader2, Redo2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddFilterMenu } from "@/components/crm/pro-filter-bar/add-filter-menu";
import { FilterChip } from "@/components/crm/pro-filter-bar/filter-chip";
import {
  createCondition,
  isActive,
  newConditionId,
  sameFilters,
} from "@/components/crm/pro-filter-bar/operators";
import { SavedViewsMenu } from "@/components/crm/pro-filter-bar/saved-views";
import type {
  FacetCounts,
  FilterCondition,
  FilterField,
  FilterOption,
  SavedView,
} from "@/components/crm/pro-filter-bar/types";
import { useFilterState } from "@/hooks/use-filter-state";

export type * from "@/components/crm/pro-filter-bar/types";
export {
  OPERATORS,
  OPERATORS_BY_TYPE,
  compileCondition,
  parseFilters,
  runFilters,
  serializeFilters,
} from "@/components/crm/pro-filter-bar/operators";
export { useFilterState, useUrlFilters } from "@/hooks/use-filter-state";
export { useFilteredRows } from "@/hooks/use-filtered-rows";

export interface ProFilterBarProps<TRow = unknown> {
  /** Filterable fields. Keep the array stable (module scope or useMemo). */
  fields: readonly FilterField<TRow>[];
  /** Controlled filters. Pair with `onChange`; `useUrlFilters()` gives a URL-backed pair. */
  value?: FilterCondition[];
  defaultValue?: FilterCondition[];
  onChange?: (filters: FilterCondition[]) => void;
  /** Enum options per field id. Fields may also declare `options` themselves. */
  options?: Record<string, FilterOption[]>;
  /** Live counts per enum value, shown in pickers and the typeahead. */
  facets?: FacetCounts;
  /** Saved views. Controlled with `onViewsChange`, or uncontrolled via `defaultViews`. */
  views?: SavedView[];
  defaultViews?: SavedView[];
  onViewsChange?: (views: SavedView[]) => void;
  /** Hide the saved views menu entirely. */
  hideViews?: boolean;
  /** "1,204 of 10,000" summary. Omit to hide. */
  resultCount?: number;
  totalCount?: number;
  loading?: boolean;
  disabled?: boolean;
  /** F opens the typeahead, ⌘/Ctrl+Z / ⇧⌘Z undo and redo. Default true. */
  hotkeys?: boolean;
  /** Extra controls at the right end (sort, display options, export). */
  actions?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

const nf = new Intl.NumberFormat();

const iconBtn =
  "flex size-7 items-center justify-center rounded-crm text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-1 focus-visible:ring-crm-ring disabled:pointer-events-none disabled:opacity-35";

/**
 * Linear/Notion-style faceted filter bar: typed chips with operator and value popovers,
 * typeahead entry across fields and values, facet counts, saved views, clear and undo.
 */
export function ProFilterBar<TRow = unknown>({
  fields: fieldsProp,
  value,
  defaultValue,
  onChange,
  options: optionsProp,
  facets,
  views: viewsProp,
  defaultViews = [],
  onViewsChange,
  hideViews,
  resultCount,
  totalCount,
  loading,
  disabled,
  hotkeys = true,
  actions,
  className,
  "aria-label": ariaLabel = "Filters",
}: ProFilterBarProps<TRow>) {
  // Chips never call accessors, so the row type is erased here.
  const fields = fieldsProp as unknown as FilterField<never>[];
  const { filters, setFilters, undo, redo, canUndo, canRedo } = useFilterState({
    value,
    defaultValue,
    onChange,
  });
  const [innerViews, setInnerViews] = React.useState(defaultViews);
  const views = viewsProp ?? innerViews;
  const setViews = (next: SavedView[]) => {
    if (!viewsProp) setInnerViews(next);
    onViewsChange?.(next);
  };
  const [activeViewId, setActiveViewId] = React.useState<string | null>(
    () => views.find((v) => sameFilters(v.filters, filters))?.id ?? null,
  );
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [autoOpenId, setAutoOpenId] = React.useState<string | null>(null);
  const [cleared, setCleared] = React.useState<number | null>(null);
  const groupRef = React.useRef<HTMLDivElement>(null);

  const fieldById = React.useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);
  const options = React.useMemo(() => {
    const out: Record<string, FilterOption[]> = { ...optionsProp };
    for (const f of fields) {
      if (f.options) out[f.id] = f.options;
      else if (f.type === "boolean" && !out[f.id])
        out[f.id] = [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ];
    }
    return out;
  }, [fields, optionsProp]);

  const activeView = views.find((v) => v.id === activeViewId) ?? null;
  const modified = activeView ? !sameFilters(activeView.filters, filters) : filters.length > 0;
  const activeCount = filters.filter(isActive).length;

  // Clear-notice auto-dismisses; any later change hides it too.
  React.useEffect(() => {
    if (cleared === null) return;
    const t = setTimeout(() => setCleared(null), 6000);
    return () => clearTimeout(t);
  }, [cleared]);

  const hotkeyOpts = { enabled: hotkeys && !disabled, preventDefault: true };
  useHotkeys("f", () => setMenuOpen(true), hotkeyOpts);
  useHotkeys("mod+z", undo, hotkeyOpts, [undo]);
  useHotkeys("mod+shift+z", redo, hotkeyOpts, [redo]);

  const update = React.useCallback(
    (next: FilterCondition) => setFilters((all) => all.map((c) => (c.id === next.id ? next : c))),
    [setFilters],
  );

  const remove = React.useCallback(
    (id: string) => {
      // Keep keyboard users in the bar: focus the neighbouring chip, else the add button.
      const focusables = [
        ...(groupRef.current?.querySelectorAll<HTMLElement>("[data-filter-focusable]") ?? []),
      ];
      const chip = groupRef.current?.querySelector(`[data-chip-id="${id}"]`);
      const idx = focusables.findIndex((el) => chip?.contains(el));
      setFilters((all) => all.filter((c) => c.id !== id));
      requestAnimationFrame(() => {
        const left = [
          ...(groupRef.current?.querySelectorAll<HTMLElement>("[data-filter-focusable]") ?? []),
        ];
        (
          left[Math.max(0, idx - 1)] ?? groupRef.current?.querySelector<HTMLElement>("button")
        )?.focus();
      });
    },
    [setFilters],
  );

  const addField = (field: FilterField<never>) => {
    const c = createCondition(field);
    setMenuOpen(false);
    setCleared(null);
    setAutoOpenId(c.id);
    setFilters((all) => [...all, c]);
  };

  const addValue = (field: FilterField<never>, v: string) => {
    setMenuOpen(false);
    setCleared(null);
    setFilters((all) => {
      // Merge into an existing "is" chip for the field instead of stacking duplicates.
      const existing = all.find((c) => c.field === field.id && c.operator === "is");
      if (existing)
        return all.map((c) =>
          c === existing && !c.values.includes(v) ? { ...c, values: [...c.values, v] } : c,
        );
      return [...all, createCondition(field, [v])];
    });
  };

  const clearAll = () => {
    setCleared(filters.length);
    setActiveViewId(null);
    setFilters([]);
  };

  const onArrowKeys = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const target = e.target as HTMLElement;
    if (!target.matches("[data-filter-focusable]")) return;
    const all = [
      ...(groupRef.current?.querySelectorAll<HTMLElement>("[data-filter-focusable]") ?? []),
    ].filter((el) => !(el as HTMLButtonElement).disabled);
    const i = all.indexOf(target);
    const next = all[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-11 w-full flex-wrap items-center gap-1.5 border-b border-crm-border bg-crm-bg px-3 py-2",
        disabled && "opacity-60",
        className,
      )}
    >
      {!hideViews && (
        <SavedViewsMenu
          views={views}
          activeId={activeViewId}
          modified={modified && activeView !== null}
          canSave={filters.length > 0}
          disabled={disabled}
          onApply={(v) => {
            setActiveViewId(v.id);
            setCleared(null);
            setFilters(v.filters.map((c) => ({ ...c, id: newConditionId() })));
          }}
          onSaveNew={(name) => {
            const view: SavedView = { id: newConditionId(), name, filters };
            setViews([...views, view]);
            setActiveViewId(view.id);
          }}
          onUpdate={(v) => setViews(views.map((x) => (x.id === v.id ? { ...x, filters } : x)))}
          onDelete={(v) => {
            setViews(views.filter((x) => x.id !== v.id));
            if (v.id === activeViewId) setActiveViewId(null);
          }}
        />
      )}
      {!hideViews && <span aria-hidden className="mx-0.5 h-4 w-px bg-crm-border" />}

      <div
        ref={groupRef}
        role="group"
        aria-label={ariaLabel}
        onKeyDown={onArrowKeys}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
      >
        {filters.map((c) => {
          const field = fieldById.get(c.field);
          if (!field) return null;
          return (
            <div key={c.id} data-chip-id={c.id} className="contents">
              <FilterChip
                field={field}
                condition={c}
                options={options[field.id] ?? []}
                counts={facets?.[field.id]}
                onChange={update}
                onRemove={() => remove(c.id)}
                autoOpen={c.id === autoOpenId}
                disabled={disabled}
              />
            </div>
          );
        })}
        <AddFilterMenu
          fields={fields}
          options={options}
          facets={facets}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onPickField={addField}
          onPickValue={addValue}
          disabled={disabled}
          compact={filters.length > 0}
          shortcut={hotkeys ? "f" : undefined}
        />
        {cleared !== null && filters.length === 0 && (
          <span
            role="status"
            className="flex h-7 items-center gap-2 rounded-crm bg-crm-raised px-2.5 text-xs text-crm-soft animate-crm-in"
          >
            Cleared {cleared} filter{cleared === 1 ? "" : "s"}
            <button
              type="button"
              onClick={() => {
                undo();
                setCleared(null);
              }}
              className="font-medium text-crm-fg underline-offset-2 hover:underline"
            >
              Undo
            </button>
          </span>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {loading && (
          <Loader2
            className="size-3.5 animate-spin text-crm-subtle"
            aria-label="Updating results"
          />
        )}
        {resultCount !== undefined && (
          <span className="px-1 text-xs tabular-nums text-crm-muted-fg" aria-live="polite">
            {totalCount !== undefined && activeCount > 0
              ? `${nf.format(resultCount)} of ${nf.format(totalCount)}`
              : `${nf.format(resultCount)} records`}
          </span>
        )}
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo || disabled}
          aria-label="Undo filter change"
          aria-keyshortcuts={hotkeys ? "Control+Z Meta+Z" : undefined}
          className={iconBtn}
        >
          <Undo2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo || disabled}
          aria-label="Redo filter change"
          className={iconBtn}
        >
          <Redo2 className="size-3.5" />
        </button>
        {filters.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="flex h-7 items-center gap-1 rounded-crm px-2 text-xs text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-1 focus-visible:ring-crm-ring"
          >
            <X className="size-3.5" /> Clear
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}
