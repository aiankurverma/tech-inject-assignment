import * as React from "react";
import { cn } from "@/lib/utils";

export interface HealthSignal {
  key: string;
  label: string;
  /** 0-100 sub-score. */
  score: number;
  /** Relative weight; weights are normalised. Default 1. */
  weight?: number;
  /** Short context, e.g. "42 of 60 seats active". */
  detail?: string;
}

export interface HealthScoreProps {
  /** Overall score 0-100. When omitted it is computed as the weighted mean of `signals`. */
  score?: number;
  signals?: HealthSignal[];
  /** Score 30 days ago; shows the trend. */
  previousScore?: number;
  /** Lower bounds for "At risk" → "Needs attention" → "Healthy". */
  bands?: { attention: number; healthy: number };
  size?: "sm" | "md";
  label?: string;
  className?: string;
}

export type HealthBand = "healthy" | "attention" | "risk";

const bandMeta: Record<HealthBand, { word: string; color: string; text: string }> = {
  healthy: { word: "Healthy", color: "#22c55e", text: "text-crm-success" },
  attention: { word: "Needs attention", color: "#fbbf24", text: "text-crm-warning" },
  risk: { word: "At risk", color: "#f97373", text: "text-crm-danger" },
};

export function healthBand(score: number, bands = { attention: 40, healthy: 70 }): HealthBand {
  return score >= bands.healthy ? "healthy" : score >= bands.attention ? "attention" : "risk";
}

/** Weighted mean of signal scores, 0-100. */
export function computeHealth(signals: HealthSignal[]): number {
  const w = signals.reduce((t, s) => t + (s.weight ?? 1), 0);
  if (!w) return 0;
  return signals.reduce((t, s) => t + Math.max(0, Math.min(100, s.score)) * (s.weight ?? 1), 0) / w;
}

/**
 * Customer health gauge: a semicircle dial coloured by band with threshold ticks, 30-day trend and
 * a weighted signal breakdown that shows each signal's contribution and flags the weakest one.
 */
export function HealthScore({
  score: scoreProp,
  signals = [],
  previousScore,
  bands = { attention: 40, healthy: 70 },
  size = "md",
  label = "Customer health",
  className,
}: HealthScoreProps) {
  const score = Math.round(Math.max(0, Math.min(100, scoreProp ?? computeHealth(signals))));
  const band = healthBand(score, bands);
  const meta = bandMeta[band];
  const delta = previousScore != null ? score - Math.round(previousScore) : null;
  const totalW = signals.reduce((t, s) => t + (s.weight ?? 1), 0) || 1;
  const weakest = signals.length ? signals.reduce((a, b) => (b.score < a.score ? b : a)) : null;

  const R = 70;
  const cx = 90;
  const cy = 86;
  const pt = (v: number, r = R) => {
    const a = Math.PI * (1 - v / 100);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const [ex, ey] = pt(score);
  const [sx, sy] = pt(0);
  const w = size === "sm" ? 140 : 180;

  return (
    <div className={cn("flex flex-col gap-4 font-crm text-crm-fg", className)}>
      <div className="relative mx-auto" style={{ width: w }}>
        <svg
          viewBox="0 0 180 100"
          className="w-full"
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          aria-valuetext={`${score} of 100, ${meta.word}`}
        >
          <path
            d={`M${sx},${sy}A${R},${R} 0 0 1 ${pt(100)[0]},${pt(100)[1]}`}
            fill="none"
            className="stroke-crm-track"
            strokeWidth={12}
            strokeLinecap="round"
          />
          {score > 0 ? (
            <path
              d={`M${sx},${sy}A${R},${R} 0 0 1 ${ex},${ey}`}
              fill="none"
              stroke={meta.color}
              strokeWidth={12}
              strokeLinecap="round"
            />
          ) : null}
          {[bands.attention, bands.healthy].map((b) => {
            const [x1, y1] = pt(b, R - 9);
            const [x2, y2] = pt(b, R + 9);
            return (
              <line
                key={b}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="stroke-crm-bg"
                strokeWidth={2}
              />
            );
          })}
          <circle cx={ex} cy={ey} r={4} className="fill-crm-fg" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span
            className={cn(
              "font-semibold tabular-nums leading-none",
              size === "sm" ? "text-2xl" : "text-3xl",
            )}
          >
            {score}
          </span>
          <span className={cn("mt-1 text-xs font-medium", meta.text)}>{meta.word}</span>
        </div>
      </div>
      {delta != null ? (
        <p className="text-center text-xs text-crm-subtle">
          <span
            className={cn(
              "font-medium tabular-nums",
              delta > 0 ? "text-crm-success" : delta < 0 ? "text-crm-danger" : "text-crm-soft",
            )}
          >
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} {Math.abs(delta)} pts
          </span>{" "}
          vs 30 days ago
        </p>
      ) : null}
      {signals.length ? (
        <ul className="flex flex-col gap-2.5" aria-label={`${label} signals`}>
          {signals.map((s) => {
            const sb = bandMeta[healthBand(s.score, bands)];
            const contrib = (s.score * (s.weight ?? 1)) / totalW;
            return (
              <li key={s.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-crm-soft">
                    <span className="truncate">{s.label}</span>
                    {weakest?.key === s.key && signals.length > 1 ? (
                      <span className="rounded-full border border-tag-red-border bg-tag-red-bg px-1.5 text-[10px] text-tag-red-text">
                        Weakest
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {Math.round(s.score)}
                    <span className="text-crm-subtle">
                      {" "}
                      · {Math.round(((s.weight ?? 1) / totalW) * 100)}% wt · +{contrib.toFixed(1)}
                    </span>
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-crm-track"
                  role="progressbar"
                  aria-label={s.label}
                  aria-valuenow={Math.round(s.score)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, s.score))}%`,
                      background: sb.color,
                    }}
                  />
                </div>
                {s.detail ? <span className="text-[11px] text-crm-subtle">{s.detail}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
