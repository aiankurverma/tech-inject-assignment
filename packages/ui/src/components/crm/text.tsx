import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  body: "text-sm leading-relaxed",
  lead: "crm-lead leading-relaxed",
  small: "text-xs leading-normal",
  caption: "crm-caption leading-normal",
  eyebrow: "crm-eyebrow",
  mono: "font-mono text-xs leading-normal",
} as const;

const tones = {
  default: "text-crm-fg",
  muted: "text-crm-soft",
  subtle: "text-crm-subtle",
  success: "text-crm-success",
  warning: "text-crm-warning",
  danger: "text-crm-danger",
  primary: "text-crm-primary",
} as const;

const weights = {
  regular: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
} as const;

type TextElement = "p" | "span" | "div" | "label" | "strong" | "em" | "small" | "code";

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: TextElement;
  variant?: keyof typeof variants;
  tone?: keyof typeof tones;
  weight?: keyof typeof weights;
  /** Tabular figures for numbers that line up in columns. */
  numeric?: boolean;
  /** 1 = single-line ellipsis; >1 = multi-line clamp. Full text goes in a title tooltip when it is a string. */
  lines?: number;
  /** Case-insensitive terms to highlight (search results, filtered lists). */
  highlight?: string | string[];
  htmlFor?: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Split `text` around matches of `terms` and wrap matches in <mark>. */
export function highlightText(text: string, terms: string | string[]): React.ReactNode {
  const list = (Array.isArray(terms) ? terms : [terms]).map((t) => t.trim()).filter(Boolean);
  if (!list.length) return text;
  const re = new RegExp(`(${list.map(escape).join("|")})`, "gi");
  const lower = list.map((t) => t.toLowerCase());
  return text.split(re).map((part, i) =>
    lower.includes(part.toLowerCase()) ? (
      <mark key={i} className="rounded-[3px] bg-crm-primary/30 px-px text-crm-fg">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

/**
 * Body copy primitive: variant (body/lead/small/caption/eyebrow/mono), tone, weight, tabular
 * numbers, line clamping and search-term highlighting, rendered as any inline or block element.
 */
export const Text = React.forwardRef<HTMLElement, TextProps>(function Text(
  {
    as: Tag = "p",
    variant = "body",
    tone,
    weight,
    numeric,
    lines,
    highlight,
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  const content =
    highlight && typeof children === "string" ? highlightText(children, highlight) : children;
  const clamp = lines && lines > 1;
  return React.createElement(
    Tag,
    {
      ref,
      title: lines && typeof children === "string" ? children : undefined,
      className: cn(
        "font-crm",
        variants[variant],
        tones[tone ?? (variant === "eyebrow" || variant === "caption" ? "subtle" : "default")],
        weight && weights[weight],
        numeric && "tabular-nums",
        lines === 1 && "block truncate",
        clamp && "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical]",
        className,
      ),
      style: clamp ? { WebkitLineClamp: lines, ...style } : style,
      ...props,
    },
    content,
  );
});
