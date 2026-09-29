import * as React from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";
import type { RangePreset, TimeSeries } from "@/components/crm/pro-time-series-explorer/types";

const itemCls =
  "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-xs text-crm-muted-fg transition-colors hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring data-[state=on]:bg-crm-card data-[state=on]:text-crm-fg data-[state=on]:shadow-crm-raised disabled:opacity-50";

interface ToolbarProps {
  presets: RangePreset[];
  activePreset: string;
  onPreset: (id: string) => void;
  series: (TimeSeries & { color: string })[];
  visible: string[];
  onVisible: (ids: string[]) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export function ExplorerToolbar({
  presets,
  activePreset,
  onPreset,
  series,
  visible,
  onVisible,
  onZoomIn,
  onZoomOut,
  onReset,
  disabled,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2">
      <ToggleGroup.Root
        type="single"
        value={activePreset}
        onValueChange={(v) => v && onPreset(v)}
        aria-label="Time range"
        disabled={disabled}
        className="inline-flex rounded-crm bg-crm-soft p-0.5"
      >
        {presets.map((p) => (
          <ToggleGroup.Item key={p.id} value={p.id} className={itemCls}>
            {p.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <div className="inline-flex rounded-crm bg-crm-soft p-0.5" role="group" aria-label="Zoom">
        <button
          type="button"
          className={itemCls}
          onClick={onZoomIn}
          disabled={disabled}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className={itemCls}
          onClick={onZoomOut}
          disabled={disabled}
          aria-label="Zoom out"
        >
          −
        </button>
        <button type="button" className={itemCls} onClick={onReset} disabled={disabled}>
          Reset
        </button>
      </div>
      <ToggleGroup.Root
        type="multiple"
        value={visible}
        onValueChange={onVisible}
        aria-label="Visible series"
        disabled={disabled}
        className="ml-auto flex flex-wrap gap-1"
      >
        {series.map((s) => (
          <ToggleGroup.Item
            key={s.id}
            value={s.id}
            className={cn(itemCls, "border border-crm-border data-[state=off]:opacity-60")}
          >
            <span
              className="size-2 rounded-full"
              style={{
                background: visible.includes(s.id) ? s.color : "transparent",
                boxShadow: `inset 0 0 0 1.5px ${s.color}`,
              }}
            />
            {s.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
