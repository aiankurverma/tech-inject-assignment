import * as React from "react";
import * as Slider from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import type { FlagVariant } from "@/components/crm/pro-feature-flag-console/types";

export const VARIANT_COLORS = ["#4124fb", "#16c89e", "#fbbf24", "#f97373", "#60a5fa", "#c084fc"];

const thumbCls =
  "block size-4 rounded-full border-2 border-crm-fg bg-crm-bg shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crm-ring disabled:opacity-50";

export function RolloutSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Slider.Root
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? 0)}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        className="relative flex h-5 flex-1 touch-none select-none items-center"
      >
        <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-crm-track">
          <Slider.Range className="absolute h-full bg-crm-primary" />
        </Slider.Track>
        <Slider.Thumb aria-label="Rollout percentage" className={thumbCls} />
      </Slider.Root>
      <div className="flex items-center rounded-md border border-crm-input bg-crm-bg">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          disabled={disabled}
          aria-label="Rollout percentage value"
          onChange={(e) =>
            onChange(Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))
          }
          className="h-8 w-14 bg-transparent pl-2 text-right text-[13px] tabular-nums focus:outline-none"
        />
        <span className="pr-2 text-xs text-crm-muted-fg">%</span>
      </div>
    </div>
  );
}

/** Converts weights → cumulative boundaries (n-1 thumbs) and back. */
function toBounds(ids: string[], split: Record<string, number>) {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < ids.length - 1; i++) {
    acc += split[ids[i]!] ?? 0;
    out.push(Math.min(100, acc));
  }
  return out;
}
function fromBounds(ids: string[], bounds: number[]) {
  const split: Record<string, number> = {};
  let prev = 0;
  ids.forEach((id, i) => {
    const b = i < bounds.length ? bounds[i]! : 100;
    split[id] = b - prev;
    prev = b;
  });
  return split;
}

/**
 * Variant split on one Radix multi-thumb slider: each thumb is the boundary between two adjacent
 * variants, so weights always sum to exactly 100 and can never go negative.
 */
export function VariantSplit({
  variants,
  split,
  onChange,
  disabled,
}: {
  variants: FlagVariant[];
  split: Record<string, number>;
  onChange: (split: Record<string, number>) => void;
  disabled?: boolean;
}) {
  const ids = React.useMemo(() => variants.map((v) => v.id), [variants]);
  const bounds = React.useMemo(() => toBounds(ids, split), [ids, split]);

  const even = () => {
    const base = Math.floor(100 / ids.length);
    const next: Record<string, number> = {};
    ids.forEach((id, i) => (next[id] = base + (i < 100 - base * ids.length ? 1 : 0)));
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex h-7 overflow-hidden rounded-md border border-crm-border" aria-hidden>
        {variants.map((v, i) => {
          const w = split[v.id] ?? 0;
          return w > 0 ? (
            <div
              key={v.id}
              className="flex items-center justify-center overflow-hidden text-[11px] font-medium text-white"
              style={{ width: `${w}%`, background: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
            >
              {w >= 8 ? `${w}%` : null}
            </div>
          ) : null;
        })}
      </div>
      {ids.length > 1 ? (
        <Slider.Root
          value={bounds}
          onValueChange={(b) => onChange(fromBounds(ids, b))}
          min={0}
          max={100}
          step={1}
          minStepsBetweenThumbs={0}
          disabled={disabled}
          className="relative flex h-5 touch-none select-none items-center"
        >
          <Slider.Track className="relative h-1.5 grow rounded-full bg-crm-track" />
          {bounds.map((_, i) => (
            <Slider.Thumb
              key={i}
              className={thumbCls}
              aria-label={`Boundary between ${variants[i]?.name} and ${variants[i + 1]?.name}`}
              aria-valuetext={`${variants[i]?.name} ${split[ids[i]!] ?? 0}%, ${variants[i + 1]?.name} ${split[ids[i + 1]!] ?? 0}%`}
            />
          ))}
        </Slider.Root>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {variants.map((v, i) => (
          <span key={v.id} className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
            />
            {v.name}
            <span className="tabular-nums text-crm-muted-fg">{split[v.id] ?? 0}%</span>
          </span>
        ))}
        {ids.length > 1 && !disabled ? (
          <button
            type="button"
            onClick={even}
            className={cn("ml-auto text-crm-soft hover:text-crm-fg")}
          >
            Split evenly
          </button>
        ) : null}
      </div>
    </div>
  );
}
