import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-crm-primary text-crm-primary-fg shadow-crm-primary hover:bg-[#5237ff]",
  secondary: "bg-crm-raised text-crm-fg shadow-crm-raised hover:bg-crm-muted",
  muted: "bg-crm-muted text-crm-fg shadow-crm-raised hover:bg-[#333]",
  ghost: "bg-transparent text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg",
  danger: "bg-crm-danger/15 text-crm-danger shadow-crm-raised hover:bg-crm-danger/25",
} as const;

const sizes = {
  sm: "h-7 px-2.5 text-xs gap-1",
  md: "h-[30px] px-[9px] text-xs gap-1.5",
  lg: "h-9 px-3.5 text-sm gap-2",
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  /** Render the child element (e.g. a link) with button styles. */
  asChild?: boolean;
  loading?: boolean;
}

/** Pill button with the CRM raised look. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", asChild, loading, className, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      data-variant={variant}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-crm font-medium whitespace-nowrap select-none",
        "outline-none transition-[background-color,color,box-shadow] duration-150 ease-crm",
        "focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? (
            <span
              className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden
            />
          ) : null}
          {children}
        </>
      )}
    </Comp>
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; required because the button has no text. */
  label: string;
  /** Show a small red dot (e.g. unread notifications). */
  dot?: boolean;
}

/** Round 30px icon-only button. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, dot, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "relative inline-flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-crm-raised text-crm-fg shadow-crm-raised",
        "outline-none transition-[background-color,box-shadow] duration-150 ease-crm hover:bg-crm-muted",
        "focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {children}
      {dot ? (
        <span
          className="absolute top-1 right-1 size-1.5 rounded-full bg-crm-danger ring-2 ring-crm-raised"
          aria-hidden
        />
      ) : null}
    </button>
  );
});
