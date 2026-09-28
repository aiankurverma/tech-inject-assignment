import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tag, tagColors, type TagColor } from "@/components/crm/tag";

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
  /** Chip colour when selected. */
  color?: TagColor;
  keywords?: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Chips shown in the trigger before collapsing into "+N". */
  maxChips?: number;
  /** Maximum number of selections. */
  max?: number;
  /** Show "Select all" / "Clear" actions in the popover. */
  showActions?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

const match = (o: MultiSelectOption, q: string) =>
  `${o.label} ${o.keywords ?? ""} ${o.description ?? ""}`.toLowerCase().includes(q.toLowerCase());

/** Searchable multi select. Selections render as removable Tag chips in the trigger; the popover keeps open while toggling. Space/Enter toggles, arrows move. */
export function MultiSelect({
  options,
  value: valueProp,
  defaultValue = [],
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results",
  maxChips = 3,
  max,
  showActions,
  disabled,
  invalid,
  id,
  "aria-label": ariaLabel,
  className,
}: MultiSelectProps) {
  const [inner, setInner] = React.useState<string[]>(defaultValue);
  const value = valueProp ?? inner;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);
  const baseId = React.useId();
  const listId = `${baseId}-list`;
  const shown = query ? options.filter((o) => match(o, query)) : options;
  const selected = value
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is MultiSelectOption => !!o);
  const full = max != null && value.length >= max;

  const set = (next: string[]) => {
    if (valueProp === undefined) setInner(next);
    onChange?.(next);
  };
  const toggle = (o: MultiSelectOption) => {
    if (o.disabled) return;
    if (value.includes(o.value)) set(value.filter((v) => v !== o.value));
    else if (!full) set([...value, o.value]);
  };

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const last = shown.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => (a >= last ? 0 : a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => (a <= 0 ? last : a - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(last);
        break;
      case "Enter":
        e.preventDefault();
        if (shown[active]) toggle(shown[active]);
        break;
      case " ":
        if (!query && shown[active]) {
          e.preventDefault();
          toggle(shown[active]);
        }
        break;
      case "Backspace":
        if (!query && value.length) set(value.slice(0, -1));
        break;
    }
  };

  const visibleChips = selected.slice(0, maxChips);
  const hidden = selected.length - visibleChips.length;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <div
          id={id}
          role="combobox"
          tabIndex={disabled ? -1 : 0}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-disabled={disabled || undefined}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          onPointerDown={(e) => {
            if (disabled) e.preventDefault();
          }}
          className={cn(
            "flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-crm border border-crm-input/60 bg-crm-raised py-1.5 pr-2.5 pl-2 font-crm text-sm",
            "outline-none transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
            "focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40",
            invalid && "border-crm-danger",
            disabled && "pointer-events-none cursor-not-allowed opacity-50",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {selected.length === 0 ? (
              <span className="px-1 text-crm-subtle">{placeholder}</span>
            ) : (
              visibleChips.map((o) => (
                <Tag
                  key={o.value}
                  color={o.color ?? "neutral"}
                  className="gap-0.5 pr-0.5 text-[13px]"
                >
                  {o.label}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Remove ${o.label}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      set(value.filter((v) => v !== o.value));
                    }}
                    className="grid size-4 cursor-pointer place-items-center rounded-full opacity-70 hover:bg-black/20 hover:opacity-100 [&_svg]:size-2.5"
                  >
                    <X />
                  </button>
                </Tag>
              ))
            )}
            {hidden > 0 ? (
              <Tag
                color="neutral"
                className="text-[13px]"
                title={selected
                  .slice(maxChips)
                  .map((o) => o.label)
                  .join(", ")}
              >
                +{hidden}
              </Tag>
            ) : null}
          </span>
          <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-crm-subtle" />
        </div>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector("input")?.focus();
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[240px] overflow-hidden rounded-xl border border-crm-border bg-crm-popover font-crm shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
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
            aria-multiselectable
            aria-label={ariaLabel ?? placeholder}
            className="max-h-64 overflow-y-auto p-1"
          >
            {shown.length === 0 ? (
              <li role="presentation" className="px-2 py-6 text-center text-xs text-crm-subtle">
                {emptyText}
              </li>
            ) : (
              shown.map((o, i) => {
                const isSel = value.includes(o.value);
                const off = o.disabled || (full && !isSel);
                return (
                  <li
                    key={o.value}
                    id={`${baseId}-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={off || undefined}
                    onMouseMove={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => !off && toggle(o)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm text-crm-fg",
                      i === active && "bg-crm-muted",
                      off && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-[4px] border",
                        isSel
                          ? "border-crm-primary bg-crm-primary text-crm-primary-fg"
                          : "border-crm-input",
                      )}
                    >
                      {isSel ? <Check className="size-3" /> : null}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{o.label}</span>
                      {o.description ? (
                        <span className="truncate text-xs text-crm-subtle">{o.description}</span>
                      ) : null}
                    </span>
                    {o.color ? (
                      <span
                        aria-hidden
                        className={cn("size-2.5 shrink-0 rounded-full border", tagColors[o.color])}
                      />
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
          {showActions ? (
            <div className="flex items-center justify-between border-t border-crm-border px-2 py-1.5 text-xs">
              <button
                type="button"
                onClick={() =>
                  set(
                    Array.from(
                      new Set([...value, ...shown.filter((o) => !o.disabled).map((o) => o.value)]),
                    ).slice(0, max ?? Infinity),
                  )
                }
                className="cursor-pointer rounded-[6px] px-2 py-1 text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                Select all
              </button>
              <span className="text-crm-subtle tabular-nums">
                {value.length}
                {max != null ? `/${max}` : ""} selected
              </span>
              <button
                type="button"
                onClick={() => set([])}
                className="cursor-pointer rounded-[6px] px-2 py-1 text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                Clear
              </button>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
