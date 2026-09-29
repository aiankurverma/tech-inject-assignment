import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Bookmark,
  Check,
  Columns3,
  Download,
  Filter,
  Group,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ColumnFilter,
  FilterChip,
  type GridColumnInstance,
} from "@/components/crm/pro-data-grid/filters";
import type { SavedGridView } from "@/components/crm/pro-data-grid/types";

export const toolbarButton =
  "inline-flex h-8 items-center gap-1.5 rounded-crm border border-crm-border bg-crm-raised px-2.5 text-sm text-crm-fg shadow-crm-raised outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring disabled:pointer-events-none disabled:opacity-50";
const panel =
  "z-50 rounded-crm border border-crm-border bg-crm-popover p-3 font-crm text-crm-fg shadow-crm-overlay";
const menuItem =
  "flex cursor-default items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm text-crm-fg outline-none data-[highlighted]:bg-crm-muted";

export interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchRef: React.Ref<HTMLInputElement>;
  columns: GridColumnInstance[];
  grouping: string[];
  views: SavedGridView[];
  activeViewId: string | null;
  onApplyView: (view: SavedGridView) => void;
  onSaveView: (name: string) => void;
  onDeleteView: (id: string) => void;
  onResetLayout: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  children?: React.ReactNode;
}

export function Toolbar({
  search,
  onSearchChange,
  searchRef,
  columns,
  grouping,
  views,
  activeViewId,
  onApplyView,
  onSaveView,
  onDeleteView,
  onResetLayout,
  onExport,
  exportDisabled,
  children,
}: ToolbarProps) {
  const filterable = columns.filter((c) => c.getCanFilter());
  const active = columns.filter((c) => c.getIsFiltered());
  const [draft, setDraft] = React.useState(search);
  React.useEffect(() => setDraft(search), [search]);
  // Debounce global search so typing stays responsive on 100k rows.
  React.useEffect(() => {
    if (draft === search) return;
    const t = setTimeout(() => onSearchChange(draft), 180);
    return () => clearTimeout(t);
  }, [draft, search, onSearchChange]);

  return (
    <div className="flex flex-col gap-2 border-b border-crm-border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1 sm:max-w-72">
          <Search
            className="pointer-events-none absolute top-2 left-2.5 size-4 text-crm-muted-fg"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearchChange(draft);
            }}
            placeholder="Search all columns"
            aria-label="Search all columns"
            className="h-8 w-full rounded-crm border border-crm-input bg-crm-bg pr-2 pl-8 text-sm text-crm-fg outline-none placeholder:text-crm-muted-fg focus-visible:border-crm-ring"
          />
        </div>

        <Popover.Root>
          <Popover.Trigger className={toolbarButton}>
            <Filter className="size-4" aria-hidden /> Filters
            {active.length > 0 && (
              <span className="rounded-full bg-crm-primary px-1.5 text-[11px] text-crm-primary-fg tabular-nums">
                {active.length}
              </span>
            )}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              className={cn(panel, "max-h-[70vh] w-80 overflow-auto")}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Filters</p>
                {active.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-crm-muted-fg hover:text-crm-fg"
                    onClick={() => active.forEach((c) => c.setFilterValue(undefined))}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="grid gap-3">
                {filterable.map((c) => (
                  <details key={c.id} open={c.getIsFiltered()} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between rounded-[6px] px-1 py-1 text-sm text-crm-soft hover:text-crm-fg">
                      {c.columnDef.meta?.spec.header ?? c.id}
                      {c.getIsFiltered() && (
                        <span
                          className="size-1.5 rounded-full bg-crm-primary"
                          aria-label="active"
                        />
                      )}
                    </summary>
                    <div className="pt-1.5">
                      <ColumnFilter column={c} />
                    </div>
                  </details>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <Popover.Root>
          <Popover.Trigger className={toolbarButton}>
            <Columns3 className="size-4" aria-hidden /> Columns
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" sideOffset={6} className={cn(panel, "w-64 p-1.5")}>
              <ul className="max-h-80 overflow-auto" aria-label="Visible columns">
                {columns.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm hover:bg-crm-muted">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-crm-primary"
                        checked={c.getIsVisible()}
                        disabled={!c.getCanHide()}
                        onChange={(e) => c.toggleVisibility(e.target.checked)}
                      />
                      <span className="flex-1 truncate">
                        {c.columnDef.meta?.spec.header ?? c.id}
                      </span>
                      {c.getIsPinned() && (
                        <span className="text-[11px] text-crm-muted-fg">pinned</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onResetLayout}
                className="mt-1 flex w-full items-center gap-2 rounded-[6px] border-t border-crm-border px-2 py-1.5 text-sm text-crm-soft hover:bg-crm-muted hover:text-crm-fg"
              >
                <RotateCcw className="size-4" aria-hidden /> Reset layout
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <ViewsMenu
          views={views}
          activeViewId={activeViewId}
          onApply={onApplyView}
          onSave={onSaveView}
          onDelete={onDeleteView}
        />

        <div className="ml-auto flex items-center gap-2">
          {children}
          <button
            type="button"
            className={toolbarButton}
            onClick={onExport}
            disabled={exportDisabled}
            title="Export CSV (Ctrl/⌘+Shift+E)"
          >
            <Download className="size-4" aria-hidden /> Export
          </button>
        </div>
      </div>

      {(active.length > 0 || grouping.length > 0) && (
        <div
          className="flex flex-wrap items-center gap-1.5"
          aria-label="Active filters and grouping"
        >
          {grouping.map((id) => {
            const c = columns.find((x) => x.id === id);
            if (!c) return null;
            return (
              <span
                key={id}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-crm-primary/40 bg-crm-primary/15 pr-1 pl-2.5 text-xs text-crm-fg"
              >
                <Group className="size-3" aria-hidden /> {c.columnDef.meta?.spec.header ?? id}
                <button
                  type="button"
                  onClick={() => c.toggleGrouping()}
                  aria-label={`Stop grouping by ${c.columnDef.meta?.spec.header ?? id}`}
                  className="grid size-5 place-items-center rounded-full hover:bg-crm-muted"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            );
          })}
          {active.map((c) => (
            <FilterChip key={c.id} column={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewsMenu({
  views,
  activeViewId,
  onApply,
  onSave,
  onDelete,
}: {
  views: SavedGridView[];
  activeViewId: string | null;
  onApply: (view: SavedGridView) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");
  const active = views.find((v) => v.id === activeViewId);
  const save = () => {
    const n = name.trim();
    if (!n) return;
    onSave(n);
    setName("");
    setNaming(false);
  };

  return (
    <Popover.Root onOpenChange={(o) => !o && setNaming(false)}>
      <Popover.Trigger className={toolbarButton}>
        <Bookmark className="size-4" aria-hidden />
        <span className="max-w-32 truncate">{active ? active.name : "Views"}</span>
        {!active && views.length > 0 && <span className="text-crm-muted-fg">· unsaved</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className={cn(panel, "w-64 p-1.5")}>
          <ul aria-label="Saved views" className="max-h-72 overflow-auto">
            {views.map((v) => (
              <li key={v.id} className="group flex items-center">
                <Popover.Close asChild>
                  <button
                    type="button"
                    onClick={() => onApply(v)}
                    className={cn(menuItem, "flex-1 hover:bg-crm-muted")}
                  >
                    <Check
                      className={cn("size-4", v.id === activeViewId ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="truncate">{v.name}</span>
                  </button>
                </Popover.Close>
                {!v.builtIn && (
                  <button
                    type="button"
                    onClick={() => onDelete(v.id)}
                    aria-label={`Delete view ${v.name}`}
                    className="grid size-7 place-items-center rounded-[6px] text-crm-muted-fg opacity-0 group-hover:opacity-100 hover:bg-crm-muted hover:text-crm-danger focus-visible:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-crm-border pt-1">
            {naming ? (
              <form
                className="flex gap-1 p-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
              >
                <input
                  autoFocus
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="View name"
                  aria-label="View name"
                  className="h-8 min-w-0 flex-1 rounded-[6px] border border-crm-input bg-crm-bg px-2 text-sm outline-none focus-visible:border-crm-ring"
                />
                <button type="submit" className={toolbarButton} disabled={!name.trim()}>
                  Save
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setNaming(true)}
                className={cn(menuItem, "w-full hover:bg-crm-muted")}
              >
                <Plus className="size-4" aria-hidden /> Save current view…
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
