import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export interface VerticalTabsProps extends Omit<
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>,
  "orientation"
> {
  /** Stack the list above the panel below this width (container is responsive via flex-wrap). */
  stackOnMobile?: boolean;
}

/** Settings-style layout: tab list on the left, panel on the right. Up/Down arrows move between tabs. */
export const VerticalTabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  VerticalTabsProps
>(function VerticalTabs({ className, stackOnMobile = true, ...props }, ref) {
  return (
    <TabsPrimitive.Root
      ref={ref}
      orientation="vertical"
      className={cn(
        "flex gap-6 font-crm text-crm-fg",
        stackOnMobile ? "flex-col sm:flex-row" : "flex-row",
        className,
      )}
      {...props}
    />
  );
});

export const VerticalTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function VerticalTabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("flex w-full shrink-0 flex-col gap-0.5 sm:w-[200px]", className)}
      {...props}
    />
  );
});

/** Uppercase heading that groups tabs inside the list. */
export function VerticalTabsLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="presentation"
      className={cn("crm-eyebrow px-2.5 pt-3 pb-1.5 text-crm-subtle first:pt-0", className)}
    >
      {children}
    </div>
  );
}

export interface VerticalTabsTriggerProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> {
  icon?: React.ReactNode;
  /** Trailing badge or count. */
  badge?: React.ReactNode;
}

export const VerticalTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  VerticalTabsTriggerProps
>(function VerticalTabsTrigger({ icon, badge, className, children, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "group relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-sm text-crm-soft outline-none select-none",
        "transition-[background-color,color] duration-150 ease-crm hover:bg-crm-raised hover:text-crm-fg",
        "focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-40",
        "data-[state=active]:bg-crm-muted data-[state=active]:text-crm-fg [&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="text-crm-subtle group-data-[state=active]:text-crm-fg">{icon}</span>
      ) : null}
      <span className="flex-1 truncate">{children}</span>
      {badge !== undefined ? <span className="text-xs text-crm-subtle">{badge}</span> : null}
    </TabsPrimitive.Trigger>
  );
});

export const VerticalTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function VerticalTabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "min-w-0 flex-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        className,
      )}
      {...props}
    />
  );
});
