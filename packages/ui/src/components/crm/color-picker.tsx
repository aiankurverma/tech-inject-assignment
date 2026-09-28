import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagColors, type TagColor } from "@/components/crm/tag";

export interface ColorSwatch {
  value: TagColor;
  label: string;
}

/** The ten CRM tag colours in display order. */
export const DEFAULT_SWATCHES: ColorSwatch[] = [
  { value: "neutral", label: "Gray" },
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "teal", label: "Teal" },
  { value: "green", label: "Green" },
  { value: "moss", label: "Moss" },
  { value: "yellow", label: "Yellow" },
  { value: "amber", label: "Amber" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
];

export interface ColorSwatchesProps {
  value?: TagColor | null;
  onChange?: (color: TagColor) => void;
  swatches?: ColorSwatch[];
  /** Swatches per row; arrow Up/Down jump by this many. */
  columns?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

/** Inline swatch grid (role="radiogroup") with roving focus: arrows move, Home/End jump, Space/Enter selects. */
export function ColorSwatches({
  value,
  onChange,
  swatches = DEFAULT_SWATCHES,
  columns = 5,
  size = "md",
  disabled,
  "aria-label": ariaLabel = "Colour",
  className,
}: ColorSwatchesProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = swatches.findIndex((s) => s.value === value);
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;

  const go = (i: number) => {
    const n = (i + swatches.length) % swatches.length;
    refs.current[n]?.focus();
    const s = swatches[n];
    if (s) onChange?.(s.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn("grid w-max gap-1.5", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {swatches.map((s, i) => {
        const selected = s.value === value;
        return (
          <button
            key={s.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={s.label}
            title={s.label}
            disabled={disabled}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => onChange?.(s.value)}
            onKeyDown={(e) => {
              const map: Record<string, number> = {
                ArrowRight: i + 1,
                ArrowLeft: i - 1,
                ArrowDown: i + columns,
                ArrowUp: i - columns,
                Home: 0,
                End: swatches.length - 1,
              };
              if (e.key in map) {
                e.preventDefault();
                go(map[e.key] ?? i);
              }
            }}
            className={cn(
              "grid cursor-pointer place-items-center rounded-full border outline-none transition-transform duration-150 ease-crm hover:scale-110",
              "focus-visible:ring-2 focus-visible:ring-crm-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-crm-popover",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100",
              size === "md" ? "size-6 [&_svg]:size-3.5" : "size-5 [&_svg]:size-3",
              tagColors[s.value],
              selected && "ring-2 ring-crm-fg/70 ring-offset-2 ring-offset-crm-popover",
            )}
          >
            {selected ? <Check aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

export interface ColorPickerProps extends Omit<ColorSwatchesProps, "size"> {
  /** Text shown next to the chip in the trigger; defaults to the colour name. */
  label?: string;
  /** Show only the dot (icon-sized trigger) instead of dot + name. */
  compact?: boolean;
  /** Title above the swatches in the popover. */
  title?: string;
}

/** Trigger showing the current colour that opens a ColorSwatches popover. Closes and returns focus on pick. */
export function ColorPicker({
  value,
  onChange,
  swatches = DEFAULT_SWATCHES,
  columns = 5,
  label,
  compact,
  title = "Colour",
  disabled,
  "aria-label": ariaLabel = "Choose colour",
  className,
}: ColorPickerProps) {
  const [open, setOpen] = React.useState(false);
  const current = swatches.find((s) => s.value === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={compact ? `${ariaLabel}: ${current?.label ?? "none"}` : ariaLabel}
          aria-haspopup="dialog"
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-crm border border-crm-input/60 bg-crm-raised font-crm text-sm text-crm-fg",
            "outline-none transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
            "focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
            compact ? "size-9 justify-center" : "h-9 px-3",
            className,
          )}
        >
          <span
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 rounded-full border",
              current ? tagColors[current.value] : "border-dashed border-crm-input",
            )}
          />
          {compact ? null : (
            <>
              <span className={cn("flex-1 text-left", !current && "text-crm-subtle")}>
                {label ?? current?.label ?? "No colour"}
              </span>
              <ChevronDown aria-hidden className="size-3.5 text-crm-subtle" />
            </>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement)
              .querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
              ?.focus();
          }}
          className="z-50 rounded-xl border border-crm-border bg-crm-popover p-3 font-crm shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
        >
          <p className="crm-eyebrow mb-2">{title}</p>
          {/* Arrow keys preview a colour; a click, Enter or Space confirms it and closes. */}
          <div
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('[role="radio"]')) setOpen(false);
            }}
          >
            <ColorSwatches
              value={value}
              swatches={swatches}
              columns={columns}
              aria-label={title}
              onChange={onChange}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
