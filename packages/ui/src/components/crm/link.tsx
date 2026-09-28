import * as React from "react";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  default:
    "text-crm-primary hover:text-crm-fg decoration-crm-primary/40 hover:decoration-crm-fg/60",
  muted: "text-crm-soft hover:text-crm-fg decoration-crm-soft/30",
  inherit: "text-inherit decoration-current/40",
} as const;

export type LinkKind = "internal" | "external" | "mailto" | "tel";

/** Classify an href. External = absolute http(s) on a different origin than the current page. */
export function linkKind(href: string, origin?: string): LinkKind {
  if (/^mailto:/i.test(href)) return "mailto";
  if (/^tel:/i.test(href)) return "tel";
  if (/^https?:\/\//i.test(href) || href.startsWith("//")) {
    const here =
      origin ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost");
    try {
      return new URL(href, here).origin === here ? "internal" : "external";
    } catch {
      return "external";
    }
  }
  return "internal";
}

/** Human display for a URL: drops protocol, "www." and trailing slash. */
export function prettyUrl(href: string): string {
  return href
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^(mailto|tel):/i, "")
    .replace(/\/$/, "");
}

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: keyof typeof variants;
  /** Underline style. "hover" shows it on hover/focus only. */
  underline?: "always" | "hover" | "none";
  /** Show the kind icon (external arrow, mail, phone). Defaults to true for non-internal links. */
  showIcon?: boolean;
  /** Force external behaviour (new tab + rel) regardless of detection. */
  external?: boolean;
  /** Render as non-interactive text, e.g. while a record is locked. */
  disabled?: boolean;
  /** Truncate long URLs with an ellipsis inside a max width (CSS value). */
  maxWidth?: string;
}

const icons: Partial<Record<LinkKind, React.ComponentType<{ className?: string }>>> = {
  external: ArrowUpRight,
  mailto: Mail,
  tel: Phone,
};

/**
 * Inline link that knows what it points to. External links open in a new tab with
 * rel="noopener noreferrer" and announce it to screen readers; mailto/tel get icons. When no
 * children are passed, a readable form of the URL is shown.
 */
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    href,
    variant = "default",
    underline = "hover",
    showIcon,
    external,
    disabled,
    maxWidth,
    className,
    children,
    target,
    rel,
    style,
    ...props
  },
  ref,
) {
  const kind: LinkKind = external ? "external" : linkKind(href);
  const isExternal = kind === "external";
  const Icon = icons[kind];
  const withIcon = showIcon ?? kind !== "internal";
  const content = children ?? prettyUrl(href);

  const cls = cn(
    "inline-flex max-w-full items-baseline gap-0.5 font-crm underline-offset-[3px] outline-none transition-colors duration-150 ease-crm",
    "rounded-[3px] focus-visible:ring-2 focus-visible:ring-crm-ring/60",
    underline === "always" && "underline",
    underline === "hover" && "no-underline hover:underline focus-visible:underline",
    underline === "none" && "no-underline",
    variants[variant],
    className,
  );

  const inner = (
    <>
      <span className={cn(maxWidth && "truncate")} style={maxWidth ? { maxWidth } : undefined}>
        {content}
      </span>
      {withIcon && Icon ? (
        <Icon aria-hidden className="size-3 shrink-0 self-center opacity-70" />
      ) : null}
      {isExternal ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </>
  );

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(cls, "cursor-not-allowed opacity-50 hover:no-underline")}
        style={style}
      >
        {inner}
      </span>
    );
  }

  return (
    <a
      ref={ref}
      href={href}
      target={target ?? (isExternal ? "_blank" : undefined)}
      rel={rel ?? (isExternal ? "noopener noreferrer" : undefined)}
      title={maxWidth && typeof content === "string" ? content : undefined}
      className={cls}
      style={style}
      {...props}
    >
      {inner}
    </a>
  );
});
