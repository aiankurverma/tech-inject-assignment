import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  blue: "border-tag-blue-border bg-tag-blue-bg text-tag-blue-text",
  purple: "border-tag-purple-border bg-tag-purple-bg text-tag-purple-text",
  green: "border-tag-green-border bg-tag-green-bg text-tag-green-text",
  moss: "border-tag-moss-border bg-tag-moss-bg text-tag-moss-text",
  red: "border-tag-red-border bg-tag-red-bg text-tag-red-text",
  orange: "border-tag-orange-border bg-tag-orange-bg text-tag-orange-text",
  amber: "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text",
  teal: "border-tag-teal-border bg-tag-teal-bg text-tag-teal-text",
  yellow: "border-tag-yellow-border bg-tag-yellow-bg text-tag-yellow-text",
  neutral: "border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text",
  primary: "border-crm-primary/40 bg-crm-primary/20 text-crm-fg",
} as const;

export type IconTileTone = keyof typeof tones;

const sizes = {
  xs: "size-5 rounded-[5px] [&_svg]:size-3 text-[9px]",
  sm: "size-7 rounded-md [&_svg]:size-3.5 text-[10px]",
  md: "size-9 rounded-crm [&_svg]:size-4 text-xs",
  lg: "size-12 rounded-xl [&_svg]:size-5 text-sm",
} as const;

const AUTO_TONES: IconTileTone[] = [
  "blue",
  "purple",
  "green",
  "orange",
  "teal",
  "red",
  "amber",
  "moss",
];

/** Stable tone for a string (object type, integration, pipeline) so the same key always gets the same colour. */
export function toneFor(key: string): IconTileTone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AUTO_TONES[h % AUTO_TONES.length] ?? "neutral";
}

export interface IconTileProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Icon element; when omitted, the first letters of `label` are shown. */
  icon?: React.ReactNode;
  /** Accessible name. Omit for purely decorative tiles next to visible text. */
  label?: string;
  /** Explicit tone, or "auto" to derive one from `toneKey ?? label`. */
  tone?: IconTileTone | "auto";
  toneKey?: string;
  size?: keyof typeof sizes;
  shape?: "square" | "circle";
  /** Unread / pending count in the corner (99+ overflow). 0 hides it. */
  count?: number;
  /** Small status dot in the corner instead of a count. */
  dot?: "success" | "warning" | "danger";
  /** Muted appearance for disconnected / inactive items. */
  inactive?: boolean;
}

const dotColor = { success: "bg-crm-success", warning: "bg-crm-warning", danger: "bg-crm-danger" };

/**
 * Tinted square (or circle) that holds an icon or monogram, using the tag palette. Supports
 * deterministic auto-colouring by key, a count badge with overflow, a status dot and inactive state.
 */
export function IconTile({
  icon,
  label,
  tone = "neutral",
  toneKey,
  size = "md",
  shape = "square",
  count,
  dot,
  inactive,
  className,
  ...props
}: IconTileProps) {
  const t: IconTileTone = tone === "auto" ? toneFor(toneKey ?? label ?? "") : tone;
  const monogram = (label ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const badge = count && count > 0 ? (count > 99 ? "99+" : String(count)) : null;
  const a11y = label
    ? [label, badge ? `${count} pending` : null, dot ? dot : null, inactive ? "inactive" : null]
        .filter(Boolean)
        .join(", ")
    : undefined;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={a11y}
      aria-hidden={label ? undefined : true}
      className={cn("relative inline-flex shrink-0", className)}
      {...props}
    >
      <span
        className={cn(
          "grid size-full place-items-center border font-crm font-semibold",
          tones[t],
          sizes[size],
          shape === "circle" && "rounded-full",
          inactive && "opacity-45 grayscale",
        )}
      >
        {icon ?? monogram}
      </span>
      {badge ? (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-crm-danger px-1 font-crm text-[9px] font-semibold text-white tabular-nums ring-2 ring-crm-bg"
        >
          {badge}
        </span>
      ) : dot ? (
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-crm-bg",
            dotColor[dot],
          )}
        />
      ) : null}
    </span>
  );
}
