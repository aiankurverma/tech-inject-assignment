import * as React from "react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: { track: "h-4 w-7", thumb: "size-3 data-[on=true]:translate-x-3" },
  md: { track: "h-5 w-9", thumb: "size-4 data-[on=true]:translate-x-4" },
} as const;

export interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "value"
> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: keyof typeof sizes;
  /** Visible label rendered to the right; also used as the accessible name. */
  label?: React.ReactNode;
  description?: React.ReactNode;
}

/** On/off toggle (role="switch"). Controlled via `checked` or uncontrolled via `defaultChecked`. Space/Enter toggle. */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    checked,
    defaultChecked = false,
    onCheckedChange,
    size = "md",
    label,
    description,
    disabled,
    className,
    id,
    ...props
  },
  ref,
) {
  const [inner, setInner] = React.useState(defaultChecked);
  const on = checked ?? inner;
  const autoId = React.useId();
  const labelId = `${id ?? autoId}-label`;
  const descId = `${id ?? autoId}-desc`;
  const toggle = () => {
    if (disabled) return;
    if (checked === undefined) setInner(!on);
    onCheckedChange?.(!on);
  };
  const control = (
    <button
      ref={ref}
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      data-state={on ? "checked" : "unchecked"}
      onClick={toggle}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none",
        "transition-colors duration-150 ease-crm focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        on ? "bg-crm-primary shadow-crm-primary" : "bg-crm-track shadow-crm-raised",
        sizes[size].track,
        !label && className,
      )}
      {...props}
    >
      <span
        data-on={on}
        className={cn(
          "block rounded-full bg-white shadow transition-transform duration-150 ease-crm",
          sizes[size].thumb,
        )}
      />
    </button>
  );
  if (!label) return control;
  return (
    <div className={cn("flex items-start gap-2.5 font-crm", className)}>
      {control}
      <div className="flex flex-col gap-1">
        <span
          id={labelId}
          onClick={toggle}
          className={cn("cursor-pointer text-sm text-crm-fg select-none", disabled && "opacity-50")}
        >
          {label}
        </span>
        {description ? (
          <span id={descId} className="text-xs text-crm-soft">
            {description}
          </span>
        ) : null}
      </div>
    </div>
  );
});
