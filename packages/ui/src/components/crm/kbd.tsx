import * as React from "react";
import { cn } from "@/lib/utils";

/** Keyboard key hint, e.g. <Kbd>Esc</Kbd>. */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-crm-input bg-crm-muted px-1 font-crm text-[11px] font-medium text-crm-soft shadow-[0_1px_0_#0e0e0e] [&_svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}
