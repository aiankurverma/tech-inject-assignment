import * as React from "react";
import { cn } from "@/lib/utils";

const gaps = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
  8: "gap-8",
} as const;
const aligns = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;
const justifies = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;

// Literal class maps so Tailwind can see every responsive variant.
const directions = {
  base: { row: "flex-row", column: "flex-col" },
  sm: { row: "sm:flex-row", column: "sm:flex-col" },
  md: { row: "md:flex-row", column: "md:flex-col" },
  lg: { row: "lg:flex-row", column: "lg:flex-col" },
} as const;
const dividerDir = {
  base: {
    row: "[&>[data-stack-divider]]:w-px [&>[data-stack-divider]]:h-auto",
    column: "[&>[data-stack-divider]]:h-px [&>[data-stack-divider]]:w-auto",
  },
  sm: {
    row: "sm:[&>[data-stack-divider]]:w-px sm:[&>[data-stack-divider]]:h-auto",
    column: "sm:[&>[data-stack-divider]]:h-px sm:[&>[data-stack-divider]]:w-auto",
  },
  md: {
    row: "md:[&>[data-stack-divider]]:w-px md:[&>[data-stack-divider]]:h-auto",
    column: "md:[&>[data-stack-divider]]:h-px md:[&>[data-stack-divider]]:w-auto",
  },
  lg: {
    row: "lg:[&>[data-stack-divider]]:w-px lg:[&>[data-stack-divider]]:h-auto",
    column: "lg:[&>[data-stack-divider]]:h-px lg:[&>[data-stack-divider]]:w-auto",
  },
} as const;

type Dir = "row" | "column";
type Breakpoint = keyof typeof directions;
/** A direction, or per-breakpoint directions such as `{ base: "column", md: "row" }`. */
export type StackDirection = Dir | Partial<Record<Breakpoint, Dir>>;

export interface StackProps extends React.HTMLAttributes<HTMLElement> {
  direction?: StackDirection;
  gap?: keyof typeof gaps;
  align?: keyof typeof aligns;
  justify?: keyof typeof justifies;
  wrap?: boolean;
  /** Insert a hairline between children; it flips orientation with the direction. */
  divider?: boolean;
  /** Semantic element, e.g. "ul", "nav", "section". Children become `li` when "ul"/"ol". */
  as?: "div" | "section" | "nav" | "ul" | "ol" | "header" | "footer" | "form";
}

/**
 * Flex layout helper with a fixed gap scale, responsive direction, optional dividers
 * and list semantics. Skips null/false children so dividers never double up.
 */
export function Stack({
  direction = "column",
  gap = 2,
  align,
  justify,
  wrap,
  divider,
  as = "div",
  className,
  children,
  ...props
}: StackProps) {
  const dirMap: Partial<Record<Breakpoint, Dir>> =
    typeof direction === "string" ? { base: direction } : direction;
  const dirClasses = (Object.keys(dirMap) as Breakpoint[]).flatMap((bp) => {
    const d = dirMap[bp]!;
    return [directions[bp][d], divider ? dividerDir[bp][d] : ""];
  });
  const list = as === "ul" || as === "ol";
  const items = React.Children.toArray(children);
  const Comp = as as React.ElementType;

  return (
    <Comp
      className={cn(
        "flex min-w-0",
        !dirMap.base && "flex-col",
        dirClasses,
        gaps[gap],
        align && aligns[align],
        justify && justifies[justify],
        wrap && "flex-wrap",
        list && "m-0 list-none p-0",
        className,
      )}
      {...props}
    >
      {items.map((child, i) => {
        const key = React.isValidElement(child) && child.key != null ? child.key : i;
        const node = list ? (
          <li key={key}>{child}</li>
        ) : (
          <React.Fragment key={key}>{child}</React.Fragment>
        );
        if (!divider || i === 0) return node;
        return (
          <React.Fragment key={`d-${key}`}>
            {list ? (
              <li
                role="presentation"
                aria-hidden
                data-stack-divider
                className="shrink-0 self-stretch bg-crm-border"
              />
            ) : (
              <span
                aria-hidden
                data-stack-divider
                className="shrink-0 self-stretch bg-crm-border"
              />
            )}
            {node}
          </React.Fragment>
        );
      })}
    </Comp>
  );
}

/** Horizontal Stack shortcut, centred on the cross axis. */
export function HStack(props: Omit<StackProps, "direction">) {
  return <Stack direction="row" align="center" {...props} />;
}

/** Vertical Stack shortcut. */
export function VStack(props: Omit<StackProps, "direction">) {
  return <Stack direction="column" {...props} />;
}
