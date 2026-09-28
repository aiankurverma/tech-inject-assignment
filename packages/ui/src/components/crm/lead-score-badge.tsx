import * as React from "react";
import { Flame, Snowflake, Sun, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type LeadTemperature = "hot" | "warm" | "cold";

export interface LeadScoreFactor {
  label: string;
  /** Points added (positive) or removed (negative). */
  points: number;
}

export interface LeadScoreBadgeProps {
  /** 0-100. Values outside are clamped. */
  score: number;
  /** Score change since the last period, e.g. +12. */
  delta?: number;
  /** Lower bounds for warm and hot. Default warm ≥ 40, hot ≥ 70. */
  thresholds?: { warm: number; hot: number };
  /** Scoring breakdown shown in an expandable panel. */
  factors?: LeadScoreFactor[];
  size?: "sm" | "md";
  /** Hide the temperature word and show only icon + number. */
  compact?: boolean;
  className?: string;
}

const styles: Record<LeadTemperature, { cls: string; Icon: typeof Flame; word: string }> = {
  hot: { cls: "border-tag-red-border bg-tag-red-bg text-tag-red-text", Icon: Flame, word: "Hot" },
  warm: {
    cls: "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text",
    Icon: Sun,
    word: "Warm",
  },
  cold: {
    cls: "border-tag-blue-border bg-tag-blue-bg text-tag-blue-text",
    Icon: Snowflake,
    word: "Cold",
  },
};

/** Maps a 0-100 score to hot / warm / cold. */
export function leadTemperature(
  score: number,
  thresholds = { warm: 40, hot: 70 },
): LeadTemperature {
  if (score >= thresholds.hot) return "hot";
  if (score >= thresholds.warm) return "warm";
  return "cold";
}

/**
 * Hot/warm/cold lead score pill with trend delta and an optional "why this score" breakdown that
 * opens on click (Esc closes, focus returns to the badge).
 */
export function LeadScoreBadge({
  score,
  delta,
  thresholds = { warm: 40, hot: 70 },
  factors,
  size = "md",
  compact,
  className,
}: LeadScoreBadgeProps) {
  const s = Math.round(Math.max(0, Math.min(100, score)));
  const temp = leadTemperature(s, thresholds);
  const { cls, Icon, word } = styles[temp];
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const wrapRef = React.useRef<HTMLSpanElement>(null);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const summary = `${word} lead, score ${s} of 100${delta ? `, ${delta > 0 ? "up" : "down"} ${Math.abs(delta)}` : ""}`;
  const pill = (
    <>
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      {!compact ? <span>{word}</span> : null}
      <span className="font-semibold tabular-nums">{s}</span>
      {delta ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 tabular-nums",
            delta > 0 ? "text-crm-success" : "text-crm-danger",
          )}
        >
          {delta > 0 ? (
            <TrendingUp className="size-3" aria-hidden />
          ) : (
            <TrendingDown className="size-3" aria-hidden />
          )}
          {Math.abs(delta)}
        </span>
      ) : null}
    </>
  );
  const base = cn(
    "inline-flex items-center gap-1 rounded-full border font-crm leading-none whitespace-nowrap",
    size === "sm" ? "h-[18px] px-1.5 text-[11px]" : "h-[22px] px-2 text-xs",
    cls,
  );

  if (!factors?.length) {
    return (
      <span role="img" aria-label={summary} className={cn(base, className)}>
        {pill}
      </span>
    );
  }

  const sorted = [...factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const net = factors.reduce((t, f) => t + f.points, 0);

  return (
    <span ref={wrapRef} className={cn("relative inline-flex", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-label={`${summary}. Show scoring factors`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          base,
          "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        )}
      >
        {pill}
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Lead score breakdown"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              btnRef.current?.focus();
            }
          }}
          className="absolute top-full left-0 z-50 mt-1.5 w-64 rounded-crm bg-crm-popover p-3 font-crm text-xs shadow-crm-overlay"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="crm-eyebrow text-crm-subtle">Why {s}?</span>
            <span className="text-crm-subtle">
              Hot ≥ {thresholds.hot} · Warm ≥ {thresholds.warm}
            </span>
          </div>
          <div className="relative mb-3 h-1.5 rounded-full bg-crm-track" aria-hidden>
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-crm-primary"
              style={{ width: `${s}%` }}
            />
            <span
              className="absolute -top-0.5 h-2.5 w-px bg-crm-soft"
              style={{ left: `${thresholds.warm}%` }}
            />
            <span
              className="absolute -top-0.5 h-2.5 w-px bg-crm-soft"
              style={{ left: `${thresholds.hot}%` }}
            />
          </div>
          <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto">
            {sorted.map((f) => (
              <li key={f.label} className="flex justify-between gap-2">
                <span className="truncate text-crm-soft">{f.label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    f.points >= 0 ? "text-crm-success" : "text-crm-danger",
                  )}
                >
                  {f.points > 0 ? "+" : ""}
                  {f.points}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-crm-border pt-2 text-crm-fg">
            <span>Net from factors</span>
            <span className="tabular-nums">{net}</span>
          </p>
        </div>
      ) : null}
    </span>
  );
}
