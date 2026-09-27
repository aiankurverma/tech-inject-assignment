import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label: string;
  /** Show the label and current value above the track. */
  showHeader?: boolean;
  formatValue?: (v: number) => string;
  className?: string;
}

/** Single-thumb slider with a white thumb on a dark track. */
export function Slider({
  label,
  showHeader = true,
  formatValue = (v) => `${v}%`,
  className,
  ...props
}: SliderProps) {
  const value = props.value ?? props.defaultValue ?? props.min ?? 0;
  return (
    <div className={cn("flex flex-col gap-3 font-crm", className)}>
      {showHeader ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-crm-soft">{label}</span>
          <span className="font-medium text-crm-fg tabular-nums">{formatValue(value)}</span>
        </div>
      ) : null}
      <SliderPrimitive.Root
        className="relative flex h-4 w-full touch-none items-center select-none data-[disabled]:opacity-50"
        value={props.value !== undefined ? [props.value] : undefined}
        defaultValue={props.defaultValue !== undefined ? [props.defaultValue] : undefined}
        onValueChange={(v) => props.onValueChange?.(v[0] ?? 0)}
        min={props.min ?? 0}
        max={props.max ?? 100}
        step={props.step ?? 1}
        disabled={props.disabled}
      >
        <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-crm-track">
          <SliderPrimitive.Range className="absolute h-full bg-crm-soft" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={label}
          className="block size-4 cursor-grab rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.5)] outline-none focus-visible:ring-4 focus-visible:ring-crm-ring/50 active:cursor-grabbing"
        />
      </SliderPrimitive.Root>
    </div>
  );
}
