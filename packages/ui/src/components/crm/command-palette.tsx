import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/crm/kbd";

export interface CommandItem {
  id: string;
  /** Text used for filtering. */
  keywords: string;
  render: React.ReactNode;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  onSelect: (id: string) => void;
  placeholder?: string;
  /** Optional column headings row. */
  header?: React.ReactNode;
}

/** Search dialog with a filtered, keyboard-navigable result list (Up/Down, Enter, Esc). */
export function CommandPalette({
  open,
  onOpenChange,
  items,
  onSelect,
  placeholder = "Search...",
  header,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.keywords.toLowerCase().includes(q)) : items;
  }, [items, query]);

  React.useEffect(() => setActive(0), [query, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      onSelect(results[active].id);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-[960px] -translate-x-1/2 overflow-hidden rounded-xl border border-crm-border bg-crm-sidebar font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-crm-border px-4 py-3">
            <Search className="size-4 text-crm-subtle" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={
                results[active] ? `${listId}-${results[active].id}` : undefined
              }
              className="flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-subtle"
            />
            <Kbd>Esc</Kbd>
          </div>
          {header ? (
            <div className="border-b border-crm-border px-4 py-2.5 text-xs text-crm-subtle">
              {header}
            </div>
          ) : null}
          <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-crm-subtle">
                No results for "{query}"
              </li>
            ) : null}
            {results.map((item, i) => (
              <li
                key={item.id}
                id={`${listId}-${item.id}`}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "cursor-pointer rounded-crm px-2.5 py-2 text-sm",
                  i === active && "bg-crm-muted",
                )}
              >
                {item.render}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4 border-t border-crm-border px-4 py-2.5 text-xs text-crm-subtle">
            <span className="flex items-center gap-1">
              <Kbd>
                <ArrowUp />
              </Kbd>
              <Kbd>
                <ArrowDown />
              </Kbd>{" "}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>
                <CornerDownLeft />
              </Kbd>{" "}
              Open
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
