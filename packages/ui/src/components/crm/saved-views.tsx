import * as React from "react";
import { Copy, MoreHorizontal, Pencil, Pin, Plus, Save, Trash2, Users } from "lucide-react";
import { Button } from "@/components/crm/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/crm/dropdown-menu";
import { cn } from "@/lib/utils";

export interface SavedView {
  id: string;
  name: string;
  /** Record count shown next to the name. */
  count?: number;
  /** Shared with the team (shows a people icon). */
  shared?: boolean;
  pinned?: boolean;
  /** Built-in views cannot be renamed or deleted. */
  system?: boolean;
}

export interface SavedViewsProps {
  views: SavedView[];
  activeId: string;
  onSelect: (id: string) => void;
  /** The active view has unsaved filter/sort changes. Shows "Save" and "Save as new". */
  dirty?: boolean;
  /** Save changes into the active view. */
  onUpdate?: (id: string) => void;
  /** Create a view from the current filters. */
  onCreate?: (name: string) => void;
  onRename?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  className?: string;
}

function NameInput({
  initial,
  label,
  onSubmit,
  onCancel,
}: {
  initial: string;
  label: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(initial);
  const submit = () => {
    const n = name.trim();
    if (n) onSubmit(n);
    else onCancel();
  };
  return (
    <input
      autoFocus
      aria-label={label}
      value={name}
      maxLength={60}
      onChange={(e) => setName(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="h-8 w-40 rounded-lg border border-crm-ring bg-crm-raised px-2.5 font-crm text-sm text-crm-fg ring-2 ring-crm-ring/40 outline-none [color-scheme:dark]"
    />
  );
}

/**
 * Named filter presets as a horizontal view switcher. Arrow keys move between views;
 * each view has a menu to rename, duplicate, pin or delete. Unsaved changes show Save / Save as new.
 */
export function SavedViews({
  views,
  activeId,
  onSelect,
  dirty,
  onUpdate,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onTogglePin,
  className,
}: SavedViewsProps) {
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const ordered = [...views].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  const active = views.find((v) => v.id === activeId);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.focus();
  };

  return (
    <div className={cn("flex min-w-0 items-center gap-2 font-crm", className)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label="Saved views"
        onKeyDown={onKeyDown}
        className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
      >
        {ordered.map((v, idx) => {
          const on = v.id === activeId;
          // Roving tabindex: fall back to the first tab when activeId matches no view.
          const tabbable = on || (!active && idx === 0);
          if (renaming === v.id)
            return (
              <NameInput
                key={v.id}
                initial={v.name}
                label={`Rename ${v.name}`}
                onSubmit={(n) => {
                  if (n !== v.name) onRename?.(v.id, n);
                  setRenaming(null);
                }}
                onCancel={() => setRenaming(null)}
              />
            );
          const hasMenu = onDuplicate || onTogglePin || (!v.system && (onRename || onDelete));
          return (
            <div
              key={v.id}
              className={cn(
                "group flex h-8 shrink-0 items-center rounded-lg transition-colors duration-150 ease-crm",
                on ? "bg-crm-muted shadow-crm-raised" : "hover:bg-crm-raised",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={on}
                tabIndex={tabbable ? 0 : -1}
                onClick={() => onSelect(v.id)}
                onDoubleClick={() => !v.system && onRename && setRenaming(v.id)}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3",
                  on ? "text-crm-fg" : "text-crm-soft hover:text-crm-fg",
                )}
              >
                {v.pinned ? <Pin className="text-crm-subtle" aria-label="Pinned" /> : null}
                <span className="max-w-40 truncate">{v.name}</span>
                {v.shared ? <Users className="text-crm-subtle" aria-label="Shared" /> : null}
                {v.count !== undefined ? (
                  <span className="text-xs text-crm-subtle tabular-nums">
                    {v.count.toLocaleString()}
                  </span>
                ) : null}
                {on && dirty ? (
                  <span
                    className="size-1.5 rounded-full bg-crm-warning"
                    aria-label="Unsaved changes"
                  />
                ) : null}
              </button>
              {hasMenu ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${v.name} options`}
                      className={cn(
                        "mr-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-crm-subtle outline-none hover:bg-crm-track hover:text-crm-fg focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crm-ring/60 data-[state=open]:opacity-100 [&_svg]:size-3.5",
                        on ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                      )}
                    >
                      <MoreHorizontal />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    onCloseAutoFocus={(e) => {
                      if (renaming) e.preventDefault();
                    }}
                  >
                    {!v.system && onRename ? (
                      <DropdownMenuItem icon={<Pencil />} onSelect={() => setRenaming(v.id)}>
                        Rename
                      </DropdownMenuItem>
                    ) : null}
                    {onDuplicate ? (
                      <DropdownMenuItem icon={<Copy />} onSelect={() => onDuplicate(v.id)}>
                        Duplicate
                      </DropdownMenuItem>
                    ) : null}
                    {onTogglePin ? (
                      <DropdownMenuItem icon={<Pin />} onSelect={() => onTogglePin(v.id)}>
                        {v.pinned ? "Unpin" : "Pin to front"}
                      </DropdownMenuItem>
                    ) : null}
                    {!v.system && onDelete ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          icon={<Trash2 />}
                          destructive
                          onSelect={() => onDelete(v.id)}
                        >
                          Delete view
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        })}
      </div>
      {creating ? (
        <NameInput
          initial=""
          label="New view name"
          onSubmit={(n) => {
            onCreate?.(n);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {dirty && active && !active.system && onUpdate ? (
          <Button variant="primary" size="sm" onClick={() => onUpdate(active.id)}>
            <Save aria-hidden />
            Save
          </Button>
        ) : null}
        {onCreate && !creating ? (
          <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            {dirty ? "Save as new view" : "New view"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
