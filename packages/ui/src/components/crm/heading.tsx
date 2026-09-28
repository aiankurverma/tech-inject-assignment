import * as React from "react";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = {
  display: "text-[32px] leading-[1.1] font-semibold tracking-[-0.02em]",
  xl: "text-2xl leading-tight font-semibold tracking-[-0.015em]",
  lg: "text-xl leading-snug font-semibold tracking-[-0.01em]",
  md: "text-base leading-snug font-semibold",
  sm: "text-sm leading-snug font-medium",
  xs: "text-xs leading-snug font-medium",
} as const;

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
const defaultSize: Record<HeadingLevel, keyof typeof sizes> = {
  1: "xl",
  2: "lg",
  3: "md",
  4: "sm",
  5: "xs",
  6: "xs",
};

/** URL-safe id from heading text: "Q3 Pipeline & Forecast" → "q3-pipeline-forecast". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const textOf = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node))
    return textOf(node.props.children);
  return "";
};

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Semantic level (h1–h6). Visual size is independent so outline stays correct. */
  level?: HeadingLevel;
  size?: keyof typeof sizes;
  tone?: "default" | "muted";
  /** Small uppercase label above the heading. */
  eyebrow?: React.ReactNode;
  /** Supporting line under the heading. */
  description?: React.ReactNode;
  /** Right-aligned slot (buttons, filters). Wraps under the title on narrow screens. */
  actions?: React.ReactNode;
  /** Adds an id (slugified text when `id` is not given) and a hover "copy link to section" anchor. */
  anchor?: boolean;
  /** Single-line truncate with a title tooltip. */
  truncate?: boolean;
  /** Count or badge placed right after the title text. */
  meta?: React.ReactNode;
}

/**
 * Typographic heading with decoupled semantic level and visual size, plus optional eyebrow,
 * description, meta, actions and a deep-link anchor for long settings / docs pages.
 */
export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  {
    level = 2,
    size,
    tone = "default",
    eyebrow,
    description,
    actions,
    anchor,
    truncate,
    meta,
    id,
    className,
    children,
    ...props
  },
  ref,
) {
  const Tag = `h${level}` as const;
  const plain = textOf(children);
  const hid = id ?? (anchor ? slugify(plain) : undefined);
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(resetTimer.current), []);

  const copyLink = async (e: React.MouseEvent) => {
    if (!hid || typeof window === "undefined") return;
    e.preventDefault();
    const url = `${window.location.href.split("#")[0]}#${hid}`;
    window.history.replaceState(null, "", `#${hid}`);
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the hash is still updated */
    }
  };

  const title = (
    <Tag
      ref={ref}
      id={hid}
      title={truncate && plain ? plain : undefined}
      className={cn(
        "group/heading flex min-w-0 items-center gap-2 font-crm scroll-mt-20",
        sizes[size ?? defaultSize[level]],
        tone === "muted" ? "text-crm-soft" : "text-crm-fg",
        !eyebrow && !description && !actions && className,
      )}
      {...props}
    >
      <span className={cn(truncate && "truncate")}>{children}</span>
      {meta ? (
        <span className="shrink-0 text-[0.7em] font-normal text-crm-subtle">{meta}</span>
      ) : null}
      {anchor && hid ? (
        <a
          href={`#${hid}`}
          onClick={copyLink}
          aria-label={copied ? "Link copied" : `Copy link to ${plain || "section"}`}
          className="shrink-0 rounded text-crm-subtle opacity-0 outline-none transition-opacity group-hover/heading:opacity-100 hover:text-crm-fg focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <Link2 aria-hidden className="size-[0.8em]" />
        </a>
      ) : null}
      {copied ? (
        <span role="status" className="shrink-0 text-[11px] font-normal text-crm-success">
          Copied
        </span>
      ) : null}
    </Tag>
  );

  if (!eyebrow && !description && !actions) return title;

  return (
    <div
      className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2 font-crm", className)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {eyebrow ? <p className="crm-eyebrow text-crm-subtle">{eyebrow}</p> : null}
        {title}
        {description ? <p className="max-w-prose text-sm text-crm-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
});
