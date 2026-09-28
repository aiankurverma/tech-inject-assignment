import * as React from "react";
import { cn } from "@/lib/utils";

interface ToggleGroupContextValue {
  isOn: (value: string) => boolean;
  toggle: (value: string) => void;
  single: boolean;
  size: "sm" | "md";
  disabled?: boolean;
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null);

interface BaseProps {
  size?: "sm" | "md";
  disabled?: boolean;
  /** Accessible name for the group. */
  label?: string;
  className?: string;
  children: React.ReactNode;
}

export interface ToggleGroupSingleProps extends BaseProps {
  type: "single";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Allow clicking the active item to clear the selection. */
  allowEmpty?: boolean;
}

export interface ToggleGroupMultipleProps extends BaseProps {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

const toArray = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : v ? [v] : [];

/** Row of toggle buttons. Single mode behaves like a radio group, multiple mode like checkboxes.
 *  Arrow keys / Home / End move focus between items; Space or Enter toggles. */
export function ToggleGroup(props: ToggleGroupProps) {
  const { size = "md", disabled, label, className, children } = props;
  const single = props.type === "single";
  const [inner, setInner] = React.useState<string[]>(() => toArray(props.defaultValue));
  const controlled = props.value !== undefined;
  const current = controlled ? toArray(props.value) : inner;

  const toggle = (v: string) => {
    const on = current.includes(v);
    if (props.type === "single") {
      if (on && !props.allowEmpty) return;
      const next = on ? [] : [v];
      if (!controlled) setInner(next);
      props.onValueChange?.(next[0] ?? "");
    } else {
      const next = on ? current.filter((x) => x !== v) : [...current, v];
      if (!controlled) setInner(next);
      props.onValueChange?.(next);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button[data-toggle-item]:not(:disabled)",
      ),
    );
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const n =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    items[n]?.focus();
  };

  return (
    <ToggleGroupContext.Provider
      value={{ isOn: (v) => current.includes(v), toggle, single, size, disabled }}
    >
      <div
        role={single ? "radiogroup" : "group"}
        aria-label={label}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-crm-raised p-0.5 font-crm shadow-crm-raised",
          className,
        )}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

export interface ToggleGroupItemProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value"
> {
  value: string;
  icon?: React.ReactNode;
  /** Accessible name; required when the item shows only an icon. */
  label?: string;
}

export const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  function ToggleGroupItem({ value, icon, label, className, children, disabled, ...props }, ref) {
    const ctx = React.useContext(ToggleGroupContext);
    if (!ctx) throw new Error("ToggleGroupItem must be used inside ToggleGroup");
    const on = ctx.isOn(value);
    return (
      <button
        ref={ref}
        type="button"
        data-toggle-item=""
        data-state={on ? "on" : "off"}
        role={ctx.single ? "radio" : undefined}
        aria-checked={ctx.single ? on : undefined}
        aria-pressed={ctx.single ? undefined : on}
        aria-label={label}
        title={label}
        disabled={disabled || ctx.disabled}
        onClick={() => ctx.toggle(value)}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full text-xs font-medium whitespace-nowrap outline-none select-none",
          "transition-[background-color,color] duration-150 ease-crm focus-visible:ring-2 focus-visible:ring-crm-ring/60",
          "disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0",
          ctx.size === "sm" ? "h-6" : "h-[26px]",
          children
            ? ctx.size === "sm"
              ? "px-2"
              : "px-2.5"
            : ctx.size === "sm"
              ? "w-6"
              : "w-[26px]",
          on ? "bg-crm-muted text-crm-fg shadow-crm-raised" : "text-crm-muted-fg hover:text-crm-fg",
          className,
        )}
        {...props}
      >
        {icon}
        {children}
      </button>
    );
  },
);
