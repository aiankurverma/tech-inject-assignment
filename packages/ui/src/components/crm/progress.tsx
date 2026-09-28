import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  primary: "bg-crm-primary",
  success: "bg-crm-success",
  warning: "bg-crm-warning",
  danger: "bg-crm-danger",
} as const;

export type ProgressTone = keyof typeof tones;

export interface ProgressProps {
  /** 0..max. Omit for an indeterminate (loading) bar. */
  value?: number;
  max?: number;
  tone?: ProgressTone;
  size?: "sm" | "md";
  label?: string;
  /** Show the percentage to the right of the label. */
  showValue?: boolean;
  className?: string;
}

/** Linear progress bar (role="progressbar") with determinate and indeterminate modes. */
export function Progress({
  value,
  max = 100,
  tone = "primary",
  size = "md",
  label,
  showValue,
  className,
}: ProgressProps) {
  const pct = value === undefined ? undefined : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("flex w-full flex-col gap-1.5 font-crm", className)}>
      {label || showValue ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-crm-soft">{label}</span>
          {showValue && pct !== undefined ? (
            <span className="text-crm-fg tabular-nums">{Math.round(pct)}%</span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-crm-track",
          size === "sm" ? "h-1" : "h-1.5",
        )}
      >
        {pct === undefined ? (
          <>
            <style>{`@keyframes crm-indeterminate{0%{left:-35%}100%{left:100%}}`}</style>
            <div
              className={cn("absolute h-full w-1/3 rounded-full", tones[tone])}
              style={{ animation: "crm-indeterminate 1.2s ease-in-out infinite" }}
            />
          </>
        ) : (
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300 ease-crm",
              tones[tone],
            )}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: ProgressTone;
  label: string;
  className?: string;
}

const ringColors: Record<ProgressTone, string> = {
  primary: "stroke-crm-primary",
  success: "stroke-crm-success",
  warning: "stroke-crm-warning",
  danger: "stroke-crm-danger",
};

/** Circular progress with the percentage in the middle (quota attainment, onboarding). */
export function ProgressRing({
  value,
  max = 100,
  size = 56,
  stroke = 5,
  tone = "primary",
  label,
  className,
}: ProgressRingProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("relative inline-grid place-items-center font-crm", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-crm-track"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className={cn("transition-[stroke-dashoffset] duration-500 ease-crm", ringColors[tone])}
        />
      </svg>
      <span className="absolute text-xs font-medium text-crm-fg tabular-nums">
        {Math.round(pct)}%
      </span>
    </div>
  );
}
