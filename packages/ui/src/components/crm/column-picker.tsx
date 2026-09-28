import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, ChevronUp, Columns3, Lock, Search } from "lucide-react";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { cn } from "@/lib/utils";

export interface PickerColumn {
  id: string;
  label: string;
  visible: boolean;
  /** Locked columns are always visible and cannot be moved (e.g. the record name). */
  locked?: boolean;
}

export interface ColumnPickerProps {
  /** Columns in display order. */
  columns: PickerColumn[];
  onChange: (columns: PickerColumn[]) => void;
  /** Called by "Reset"; hides the button when omitted. */
  onReset?: () => void;
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  defaultOpen?: boolean;
}

const iconBtn =
  "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5";

/**
 * Show/hide and reorder table columns. Search filters the list; Alt+ArrowUp/Down on a row
 * moves the column. Locked columns stay visible and in place.
 */
export function ColumnPicker({
  columns,
  onChange,
  onReset,
  trigger,
  align = "end",
  defaultOpen,
}: ColumnPickerProps) {
  const [query, setQuery] = React.useState("");
  const [announce, setAnnounce] = React.useState("");
  const listRef = React.useRef<HTMLUListElement>(null);
  const uid = React.useId();
  const q = query.trim().toLowerCase();
  const shown = q ? columns.filter((c) => c.label.toLowerCase().includes(q)) : columns;
  const visibleCount = columns.filter((c) => c.visible).length;

  const toggle = (id: string, visible: boolean) =>
    onChange(columns.map((c) => (c.id === id && !c.locked ? { ...c, visible } : c)));
  const setAll = (visible: boolean) =>
    onChange(columns.map((c) => (c.locked ? c : { ...c, visible })));
  const canMove = (i: number, d: -1 | 1) => {
    const t = columns[i + d];
    return !!t && !t.locked && !columns[i]?.locked;
  };
  const move = (id: string, d: -1 | 1) => {
    const i = columns.findIndex((c) => c.id === id);
    if (!canMove(i, d)) return;
    const next = [...columns];
    const [c] = next.splice(i, 1);
    next.splice(i + d, 0, c!);
    onChange(next);
    setAnnounce(`${c!.label} moved to position ${i + d + 1} of ${columns.length}`);
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelector<HTMLElement>(`[data-col="${CSS.escape(id)}"] button[role="checkbox"]`)
        ?.focus(),
    );
  };

  return (
    <Popover.Root defaultOpen={defaultOpen} onOpenChange={(o) => !o && setQuery("")}>
      <Popover.Trigger asChild>
        {trigger ?? (
          <Button>
            <Columns3 aria-hidden />
            Columns
            <span className="text-crm-subtle tabular-nums">
              {visibleCount}/{columns.length}
            </span>
          </Button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          aria-label="Choose columns"
          className="z-50 w-[min(300px,calc(100vw-2rem))] rounded-xl border border-crm-border bg-crm-popover font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
        >
          <div className="relative border-b border-crm-border p-2">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-crm-subtle"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search columns"
              aria-label="Search columns"
              className="h-8 w-full rounded-lg bg-crm-raised pr-2 pl-7 text-sm text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:ring-2 focus-visible:ring-crm-ring/40 [color-scheme:dark]"
            />
          </div>
          <ul
            ref={listRef}
            aria-label="Columns"
            aria-describedby={`${uid}-hint`}
            className="max-h-72 overflow-y-auto p-1"
          >
            {shown.length === 0 ? (
              <li className="px-2 py-6 text-center text-xs text-crm-subtle">No columns match</li>
            ) : (
              shown.map((c) => {
                const i = columns.indexOf(c);
                const cbId = `${uid}-${c.id}`;
                return (
                  <li
                    key={c.id}
                    data-col={c.id}
                    onKeyDown={(e) => {
                      if (!e.altKey || q) return;
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        move(c.id, e.key === "ArrowUp" ? -1 : 1);
                      }
                    }}
                    className="group flex h-8 items-center gap-2 rounded-lg px-2 hover:bg-crm-muted"
                  >
                    <Checkbox
                      id={cbId}
                      checked={c.visible}
                      disabled={c.locked}
                      onCheckedChange={(v) => toggle(c.id, v === true)}
                    />
                    <label
                      htmlFor={cbId}
                      className={cn(
                        "flex-1 cursor-pointer truncate text-sm select-none",
                        c.visible ? "text-crm-fg" : "text-crm-soft",
                      )}
                    >
                      {c.label}
                    </label>
                    {c.locked ? (
                      <Lock className="size-3 text-crm-faint" aria-label="Locked" />
                    ) : q ? null : (
                      <span className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={`Move ${c.label} up`}
                          disabled={!canMove(i, -1)}
                          onClick={() => move(c.id, -1)}
                          className={iconBtn}
                        >
                          <ChevronUp />
                        </button>
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={`Move ${c.label} down`}
                          disabled={!canMove(i, 1)}
                          onClick={() => move(c.id, 1)}
                          className={iconBtn}
                        >
                          <ChevronDown />
                        </button>
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
          <p id={`${uid}-hint`} className="sr-only">
            Press Alt plus Arrow Up or Arrow Down on a column to reorder it.
          </p>
          <span aria-live="polite" className="sr-only">
            {announce}
          </span>
          <div className="flex items-center gap-1 border-t border-crm-border p-2">
            <Button variant="ghost" size="sm" onClick={() => setAll(true)}>
              Show all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAll(false)}>
              Hide all
            </Button>
            {onReset ? (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={onReset}>
                Reset
              </Button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
