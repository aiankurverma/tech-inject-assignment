import * as React from "react";
import { cn } from "@/lib/utils";

export const tagColors = {
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
} as const;

export type TagColor = keyof typeof tagColors;

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: TagColor;
  size?: "sm" | "md";
}

/** Coloured pill for segments and stages. */
export function Tag({ color = "neutral", size = "md", className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border font-crm leading-none whitespace-nowrap",
        size === "md" ? "h-[22px] px-1.5 text-[14px]" : "h-[18px] px-1 text-[12px]",
        tagColors[color],
        className,
      )}
      {...props}
    />
  );
}

export interface TagListProps {
  tags: { label: string; color: TagColor }[];
  /** How many tags to show before collapsing the rest into "+N". */
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

/** Row of tags with a neutral "+N" overflow tag. */
export function TagList({ tags, max = 2, size = "md", className }: TagListProps) {
  const shown = tags.slice(0, max);
  const hidden = tags.slice(max);
  return (
    <span className={cn("flex items-center gap-[3px]", className)}>
      {shown.map((t) => (
        <Tag key={t.label} color={t.color} size={size}>
          {t.label}
        </Tag>
      ))}
      {hidden.length ? (
        <Tag color="neutral" size={size} title={hidden.map((t) => t.label).join(", ")}>
          +{hidden.length}
        </Tag>
      ) : null}
    </span>
  );
}
