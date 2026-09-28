import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary line under the label. */
  description?: string;
  /** Optional leading node (avatar, icon, swatch). */
  icon?: React.ReactNode;
  /** Extra text matched by the search, e.g. an email. */
  keywords?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Show an x in the trigger to clear the selection. */
  clearable?: boolean;
  /** Custom filter; defaults to case-insensitive substring over label + keywords. */
  filter?: (option: ComboboxOption, query: string) => boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Start with the option list open (uncontrolled). */
  defaultOpen?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

export const defaultComboboxFilter = (o: ComboboxOption, q: string) =>
  `${o.label} ${o.keywords ?? ""} ${o.description ?? ""}`.toLowerCase().includes(q.toLowerCase());

/** Searchable single select. Trigger opens a popover with a filter box and a listbox; arrows move, Enter picks, Esc closes. */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results",
  clearable,
  filter = defaultComboboxFilter,
  disabled,
  invalid,
  defaultOpen = false,
  id,
  "aria-label": ariaLabel,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);
  const baseId = React.useId();
  const listId = `${baseId}-list`;
  const selected = options.find((o) => o.value === value);
  const shown = query ? options.filter((o) => filter(o, query)) : options;

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (o: ComboboxOption) => {
    if (o.disabled) return;
    onChange?.(o.value === value ? null : o.value);
    setOpen(false);
  };

  const moveTo = (start: number, dir: 1 | -1) => {
    if (!shown.length) return;
    let i = start;
    for (let n = 0; n < shown.length; n++) {
      i = (i + shown.length) % shown.length;
      if (!shown[i]?.disabled) return setActive(i);
      i += dir;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveTo(active + 1, 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveTo(active - 1, -1);
        break;
      case "Home":
        e.preventDefault();
        moveTo(0, 1);
        break;
      case "End":
        e.preventDefault();
        moveTo(shown.length - 1, -1);
        break;
      case "Enter":
        e.preventDefault();
        if (shown[active]) pick(shown[active]);
        break;
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={cn("relative w-full", className)}>
        <Popover.Trigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? listId : undefined}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full cursor-pointer items-center gap-2 rounded-crm border border-crm-input/60 bg-crm-raised px-3 text-left font-crm text-sm",
              "outline-none transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
              "focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40",
              "aria-[invalid=true]:border-crm-danger disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {selected?.icon ? <span className="shrink-0">{selected.icon}</span> : null}
            <span className={cn("flex-1 truncate", selected ? "text-crm-fg" : "text-crm-subtle")}>
              {selected?.label ?? placeholder}
            </span>
            {clearable && selected ? <span aria-hidden className="w-5 shrink-0" /> : null}
            <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-crm-subtle" />
          </button>
        </Popover.Trigger>
        {clearable && selected && !disabled ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => onChange?.(null)}
            className="absolute top-1/2 right-[34px] grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3"
          >
            <X />
          </button>
        ) : null}
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector("input")?.focus();
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[220px] overflow-hidden rounded-xl border border-crm-border bg-crm-popover font-crm shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
        >
          <div className="flex items-center gap-2 border-b border-crm-border px-3">
            <Search aria-hidden className="size-3.5 shrink-0 text-crm-subtle" />
            <input
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={shown[active] ? `${baseId}-opt-${active}` : undefined}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-9 min-w-0 flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-subtle"
            />
          </div>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel ?? placeholder}
            className="max-h-64 overflow-y-auto p-1"
          >
            {shown.length === 0 ? (
              <li role="presentation" className="px-2 py-6 text-center text-xs text-crm-subtle">
                {emptyText}
              </li>
            ) : (
              shown.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <li
                    key={o.value}
                    id={`${baseId}-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled || undefined}
                    onMouseMove={() => !o.disabled && setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm text-crm-fg",
                      i === active && "bg-crm-muted",
                      o.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {o.icon ? <span className="shrink-0">{o.icon}</span> : null}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{o.label}</span>
                      {o.description ? (
                        <span className="truncate text-xs text-crm-subtle">{o.description}</span>
                      ) : null}
                    </span>
                    <Check
                      aria-hidden
                      className={cn("size-3.5 shrink-0 text-crm-primary", !isSel && "invisible")}
                    />
                  </li>
                );
              })
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
