import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Bookmark, Check, Lock, Plus, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedView } from "@/components/crm/pro-filter-bar/types";

export interface SavedViewsMenuProps {
  views: SavedView[];
  activeId: string | null;
  /** Current filters differ from the active view. */
  modified: boolean;
  canSave: boolean;
  onApply: (view: SavedView) => void;
  onSaveNew: (name: string) => void;
  onUpdate: (view: SavedView) => void;
  onDelete: (view: SavedView) => void;
  disabled?: boolean;
}

const itemCls =
  "group flex h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[13px] text-crm-chip data-[selected=true]:bg-crm-muted data-[selected=true]:text-crm-fg";

/** Views dropdown: switch, save current as new, overwrite the active one, delete. */
export function SavedViewsMenu({
  views,
  activeId,
  modified,
  canSave,
  onApply,
  onSaveNew,
  onUpdate,
  onDelete,
  disabled,
}: SavedViewsMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");
  const active = views.find((v) => v.id === activeId) ?? null;
  const duplicate = views.some((v) => v.name.toLowerCase() === name.trim().toLowerCase());

  const close = () => {
    setOpen(false);
    setNaming(false);
    setName("");
  };

  return (
    <Popover.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <Popover.Trigger
        disabled={disabled}
        className={cn(
          "flex h-7 max-w-52 shrink-0 items-center gap-1.5 rounded-crm border border-crm-border bg-crm-raised px-2 text-[13px] text-crm-chip shadow-crm-raised outline-none",
          "hover:text-crm-fg focus-visible:ring-1 focus-visible:ring-crm-ring disabled:opacity-50",
        )}
      >
        <Bookmark className="size-3.5 text-crm-soft" />
        <span className="truncate">{active?.name ?? "All records"}</span>
        {modified && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-crm-warning"
            aria-label="(unsaved changes)"
            role="img"
          />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 overflow-hidden rounded-crm border border-crm-border bg-crm-popover shadow-crm-overlay animate-crm-in"
        >
          {naming ? (
            <form
              className="p-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim() || duplicate) return;
                onSaveNew(name.trim());
                close();
              }}
            >
              <label className="mb-1.5 block text-[11px] text-crm-subtle" htmlFor="kb-view-name">
                Name this view
              </label>
              <input
                id="kb-view-name"
                autoFocus
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setNaming(false))}
                aria-invalid={duplicate}
                placeholder="e.g. Enterprise renewals Q3"
                className="h-8 w-full rounded-crm border border-crm-border bg-crm-bg px-2.5 text-[13px] text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:border-crm-ring aria-invalid:border-crm-danger"
              />
              {duplicate && (
                <p className="mt-1 text-[11px] text-crm-danger">A view with this name exists.</p>
              )}
              <div className="mt-2 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setNaming(false)}
                  className="h-7 rounded-crm px-2.5 text-xs text-crm-soft hover:bg-crm-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || duplicate}
                  className="h-7 rounded-crm bg-crm-primary px-2.5 text-xs font-medium text-crm-primary-fg shadow-crm-primary disabled:opacity-50"
                >
                  Save view
                </button>
              </div>
            </form>
          ) : (
            <Command loop label="Saved views">
              {views.length > 6 && (
                <div className="border-b border-crm-border p-1.5">
                  <Command.Input
                    autoFocus
                    placeholder="Find a view…"
                    className="h-8 w-full bg-transparent px-2 text-[13px] text-crm-fg outline-none placeholder:text-crm-subtle"
                  />
                </div>
              )}
              <Command.List className="max-h-72 overflow-y-auto p-1">
                <Command.Empty className="px-2 py-3 text-center text-xs text-crm-muted-fg">
                  No views
                </Command.Empty>
                {views.map((view) => (
                  <Command.Item
                    key={view.id}
                    value={`${view.name} ${view.id}`}
                    onSelect={() => {
                      onApply(view);
                      close();
                    }}
                    className={itemCls}
                  >
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        view.id === activeId ? "text-crm-fg" : "text-transparent",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{view.name}</span>
                    <span className="text-[11px] tabular-nums text-crm-subtle">
                      {view.filters.length || ""}
                    </span>
                    {view.locked ? (
                      <Lock className="size-3 text-crm-faint" aria-label="Built-in view" />
                    ) : (
                      <button
                        type="button"
                        aria-label={`Delete view ${view.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(view);
                        }}
                        className="rounded p-0.5 text-crm-subtle opacity-0 hover:text-crm-danger focus-visible:opacity-100 group-hover:opacity-100 group-data-[selected=true]:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </Command.Item>
                ))}
              </Command.List>
              <div className="flex flex-col gap-0.5 border-t border-crm-border p-1">
                {active && modified && !active.locked && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdate(active);
                      close();
                    }}
                    className="flex h-8 items-center gap-2 rounded-[6px] px-2 text-[13px] text-crm-chip hover:bg-crm-muted"
                  >
                    <Save className="size-3.5" /> Update “{active.name}”
                  </button>
                )}
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => setNaming(true)}
                  className="flex h-8 items-center gap-2 rounded-[6px] px-2 text-[13px] text-crm-chip hover:bg-crm-muted disabled:opacity-40"
                >
                  <Plus className="size-3.5" /> Save current filters as view…
                </button>
              </div>
            </Command>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
