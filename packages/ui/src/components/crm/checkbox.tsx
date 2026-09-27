import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

/** 16px checkbox. Checked and indeterminate use the CRM yellow. Pass checked="indeterminate" for a partial selection. */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-[#323232] bg-transparent",
        "outline-none transition-colors duration-150 ease-crm hover:border-crm-input",
        "focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-crm-warning data-[state=checked]:bg-crm-warning data-[state=indeterminate]:border-crm-warning data-[state=indeterminate]:bg-crm-warning",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-[#161616]">
        {props.checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
