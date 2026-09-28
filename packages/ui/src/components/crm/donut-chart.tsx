import * as React from "react";
import { cn } from "@/lib/utils";

const palette = [
  "#7c6bff",
  "#22c55e",
  "#fbbf24",
  "#60a5fa",
  "#f97373",
  "#eeb390",
  "#b7aee9",
  "#2dd4bf",
];

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: DonutSegment[];
  /** Segments beyond this count are merged into "Other". */
  maxSegments?: number;
  size?: number;
  /** Ring thickness in px (at size 180). */
  thickness?: number;
  formatValue?: (value: number) => string;
  /** Label under the centre total. */
  centerLabel?: string;
  /** Controlled selected segment key; null clears. */
  selected?: string | null;
  onSelectedChange?: (key: string | null) => void;
  loading?: boolean;
  emptyMessage?: string;
  label: string;
  className?: string;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0},${y0}A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

/**
 * Share breakdown ring with a live centre total, "Other" roll-up, selectable segments and a legend
 * with values and percentages. Legend rows are keyboard focusable and drive the selection.
 */
export function DonutChart({
  data,
  maxSegments = 6,
  size = 180,
  thickness = 22,
  formatValue = (v) => compact.format(v),
  centerLabel = "Total",
  selected: selectedProp,
  onSelectedChange,
  loading,
  emptyMessage = "Nothing to show yet",
  label,
  className,
}: DonutChartProps) {
  const [inner, setInner] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);
  const selected = selectedProp !== undefined ? selectedProp : inner;
  const select = (k: string | null) => {
    const next = k === selected ? null : k;
    if (selectedProp === undefined) setInner(next);
    onSelectedChange?.(next);
  };

  const segments = React.useMemo(() => {
    const positive = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    const withColor = positive.map((d, i) => ({
      ...d,
      color: d.color ?? palette[i % palette.length],
    }));
    if (withColor.length <= maxSegments) return withColor;
    const head = withColor.slice(0, maxSegments - 1);
    const rest = withColor.slice(maxSegments - 1);
    return [
      ...head,
      {
        key: "__other",
        label: `Other (${rest.length})`,
        value: rest.reduce((s, d) => s + d.value, 0),
        color: "#5c5c5c",
      },
    ];
  }, [data, maxSegments]);

  const total = segments.reduce((s, d) => s + d.value, 0);
  const focus = hover ?? selected;
  const focused = segments.find((s) => s.key === focus);

  const C = 90;
  const r = C - thickness / 2 - 2;
  const gap = segments.length > 1 ? 0.02 : 0;
  let angle = -Math.PI / 2;

  if (loading) {
    return (
      <div role="status" className={cn("flex items-center gap-6 font-crm", className)}>
        <span
          className="animate-pulse rounded-full border-[22px] border-crm-muted"
          style={{ width: size, height: size }}
        />
        <span className="sr-only">Loading chart</span>
      </div>
    );
  }

  return (
    <figure
      className={cn(
        "flex flex-col items-center gap-5 font-crm text-crm-fg sm:flex-row sm:items-start",
        className,
      )}
    >
      <figcaption className="sr-only">{label}</figcaption>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 180 180"
          className="size-full"
          role="img"
          aria-label={`${label}: total ${formatValue(total)}`}
        >
          <circle
            cx={C}
            cy={C}
            r={r}
            fill="none"
            className="stroke-crm-muted"
            strokeWidth={thickness}
          />
          {total > 0
            ? segments.map((s) => {
                const sweep = (s.value / total) * Math.PI * 2;
                const a0 = angle + gap / 2;
                const a1 = angle + sweep - gap / 2;
                angle += sweep;
                const dim = focus !== null && focus !== s.key;
                const d =
                  segments.length === 1
                    ? `M${C},${C - r}A${r},${r} 0 1 1 ${C - 0.01},${C - r}`
                    : arc(C, C, r, a0, Math.max(a0 + 0.001, a1));
                return (
                  <path
                    key={s.key}
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={focus === s.key ? thickness + 4 : thickness}
                    opacity={dim ? 0.3 : 1}
                    className="cursor-pointer transition-[opacity,stroke-width] duration-150"
                    onMouseEnter={() => setHover(s.key)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => select(s.key)}
                  />
                );
              })
            : null}
        </svg>
        <div
          className="pointer-events-none absolute inset-0 grid place-content-center text-center"
          aria-live="polite"
        >
          {total === 0 ? (
            <span className="text-xs text-crm-subtle">{emptyMessage}</span>
          ) : (
            <>
              <span className="text-xl font-semibold tabular-nums">
                {formatValue(focused ? focused.value : total)}
              </span>
              <span className="crm-caption text-crm-subtle">
                {focused
                  ? `${((focused.value / total) * 100).toFixed(1)}% · ${focused.label}`
                  : centerLabel}
              </span>
            </>
          )}
        </div>
      </div>
      {total > 0 ? (
        <ul className="flex w-full min-w-0 flex-col gap-0.5" aria-label={`${label} legend`}>
          {segments.map((s) => {
            const pct = (s.value / total) * 100;
            const isSel = selected === s.key;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  aria-pressed={isSel}
                  onClick={() => select(s.key)}
                  onMouseEnter={() => setHover(s.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(s.key)}
                  onBlur={() => setHover(null)}
                  className={cn(
                    "grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none transition-colors hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                    isSel && "bg-crm-muted",
                  )}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: s.color }}
                    aria-hidden
                  />
                  <span className="truncate text-crm-soft">{s.label}</span>
                  <span className="tabular-nums text-crm-fg">{formatValue(s.value)}</span>
                  <span className="w-12 text-right tabular-nums text-crm-subtle">
                    {pct.toFixed(1)}%
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </figure>
  );
}
