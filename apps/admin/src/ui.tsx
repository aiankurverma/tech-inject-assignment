import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  MoreHorizontal,
  Search,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ComponentStatus } from "./types";

export const cn = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success";
type ButtonSize = "sm" | "md" | "icon";

const variantCls: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/80",
  secondary:
    "border border-border bg-background text-foreground shadow-xs hover:bg-muted/50 active:bg-muted",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800",
  ghost: "text-foreground/80 hover:bg-muted hover:text-foreground",
};
const sizeCls: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-9 gap-2 px-3.5 text-sm",
  icon: "size-9 justify-center",
};

/** Shared class string so links can look like buttons. */
export const buttonClass = (variant: ButtonVariant = "secondary", size: ButtonSize = "md") =>
  cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50",
    focusRing,
    variantCls[variant],
    sizeCls[size],
  );

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
}) {
  const iconCls = size === "sm" ? "size-3.5" : "size-4";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClass(variant, size), className)}
      {...rest}
    >
      {loading ? (
        <Loader2 className={cn(iconCls, "animate-spin")} aria-hidden />
      ) : Icon ? (
        <Icon className={iconCls} aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Badge */

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "dark" | "outline" | "info";
const badgeCls: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-foreground/80 ring-border",
  success:
    "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-500/25",
  warning:
    "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-amber-200 dark:ring-amber-500/25",
  danger:
    "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-red-200 dark:ring-red-500/25",
  info: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-200 dark:ring-sky-500/25",
  dark: "bg-primary text-primary-foreground ring-primary",
  outline: "bg-background text-foreground/80 ring-border",
};
const dotCls: Record<BadgeVariant, string> = {
  neutral: "bg-muted-foreground/70",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  dark: "bg-primary-foreground",
  outline: "bg-muted-foreground/70",
};

export function Badge({
  variant = "neutral",
  dot = false,
  className,
  children,
}: {
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        badgeCls[variant],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dotCls[variant])} aria-hidden /> : null}
      {children}
    </span>
  );
}

const statusVariant: Record<ComponentStatus, BadgeVariant> = {
  published: "success",
  draft: "warning",
  unpublished: "neutral",
};
const statusLabel: Record<ComponentStatus, string> = {
  published: "Published",
  draft: "Draft",
  unpublished: "Unpublished",
};

export const StatusBadge = ({ status }: { status: ComponentStatus }) => (
  <Badge variant={statusVariant[status]} dot>
    {statusLabel[status]}
  </Badge>
);

export const AccessBadge = ({ access }: { access: "free" | "premium" }) =>
  access === "premium" ? (
    <Badge variant="dark">Premium</Badge>
  ) : (
    <Badge variant="outline">Free</Badge>
  );

/* -------------------------------------------------------------------- Card */

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-background shadow-xs", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------- PageHeader */

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {meta}
        </div>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------- Empty / Error */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border bg-background shadow-xs">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 ring-1 ring-red-200 dark:ring-red-500/25">
        <AlertTriangle className="size-5 text-red-600 dark:text-red-400" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">Could not load this data</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Alert({
  variant = "danger",
  title,
  children,
  className,
}: {
  variant?: "danger" | "warning" | "success" | "info";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const styles = {
    danger: [
      "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-200",
      XCircle,
      "text-red-600 dark:text-red-400",
    ],
    warning: [
      "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200",
      AlertTriangle,
      "text-amber-600 dark:text-amber-400",
    ],
    success: [
      "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
      CheckCircle2,
      "text-emerald-600 dark:text-emerald-400",
    ],
    info: [
      "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sky-900 dark:text-sky-200",
      Info,
      "text-sky-600 dark:text-sky-400",
    ],
  } as const;
  const [box, Icon, iconCls] = styles[variant];
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", box, className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconCls)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-md bg-foreground/10", className)} aria-hidden />
);

/** Mirrors a list row: thumbnail, name + slug (+ status badge on phones), then badge columns. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-border/60">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-[2] space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-1 h-5 w-20 sm:hidden" />
          </div>
          {Array.from({ length: Math.max(0, cols - 1) }, (_, c) => (
            <div key={c} className={cn("flex-1", c === 0 ? "hidden sm:block" : "hidden md:block")}>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/* ------------------------------------------------------------------- Table */

export function Table({
  children,
  label,
  className = "min-w-[640px]",
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-left text-sm", className)}
        aria-label={label}
      >
        {children}
      </table>
    </div>
  );
}

export const THead = ({ children }: { children: ReactNode }) => (
  <thead className="border-b border-border bg-subtle/70 text-xs text-muted-foreground">
    {children}
  </thead>
);

export const Th = ({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    scope="col"
    className={cn("px-4 py-2.5 font-medium first:pl-5 last:pr-5", className)}
    {...rest}
  >
    {children}
  </th>
);

export const Td = ({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("px-4 py-3 align-middle first:pl-5 last:pr-5", className)} {...rest}>
    {children}
  </td>
);

/* ------------------------------------------------------------- SearchInput */

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(
          "h-9 w-full rounded-lg border border-border bg-background pr-8 pl-9 text-sm shadow-xs placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:hidden",
          focusRing,
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={cn(
            "absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/70 hover:text-foreground/80",
            focusRing,
          )}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- Segmented */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: ReactKeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + options.length) % options.length;
    const opt = options[next];
    if (opt) onChange(opt.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex h-9 w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-muted/70 p-0.5 [scrollbar-width:none] sm:inline-flex sm:w-auto sm:max-w-full"
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "inline-flex h-full shrink-0 grow items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors sm:grow-0",
              focusRing,
              "focus-visible:ring-offset-0",
              active
                ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cn(
                  "rounded px-1 text-[10px] tabular-nums",
                  active ? "bg-muted text-foreground/80" : "text-muted-foreground/70",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- RowMenu */

export type RowMenuItem = {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
} & ({ onSelect: () => void } | { href: string });

/**
 * Kebab button with a small action menu. The menu is fixed-positioned so table
 * scroll containers never clip it. Esc, outside click, scroll or picking an item
 * closes it; arrow keys move between items.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const open = pos !== null;

  const close = useCallback((refocus: boolean) => {
    setPos(null);
    if (refocus) button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    const onMove = () => close(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) return close(false);
    const r = button.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  const onMenuKey = (e: ReactKeyboardEvent) => {
    const list = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = list.indexOf(document.activeElement as HTMLElement);
    const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      close(e.key === "Escape");
    } else if (e.key in step) {
      e.preventDefault();
      list[(i + step[e.key]! + list.length) % list.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      list[e.key === "Home" ? 0 : list.length - 1]?.focus();
    }
  };

  const itemCls = (danger?: boolean) =>
    cn(
      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm outline-none",
      danger
        ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 focus-visible:bg-red-50 dark:focus-visible:bg-red-500/10"
        : "text-foreground/80 hover:bg-muted focus-visible:bg-muted",
    );

  return (
    <>
      <Button
        ref={button}
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </Button>
      {pos ? (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-40 min-w-44 rounded-lg border border-border bg-background p-1 shadow-lg"
        >
          {items.map((it) => {
            const content = (
              <>
                <it.icon className="size-4 shrink-0" aria-hidden />
                {it.label}
              </>
            );
            return "href" in it ? (
              <a
                key={it.label}
                role="menuitem"
                tabIndex={-1}
                href={it.href}
                target="_blank"
                rel="noreferrer"
                onClick={() => close(false)}
                className={itemCls(it.danger)}
              >
                {content}
              </a>
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  close(true);
                  it.onSelect();
                }}
                className={itemCls(it.danger)}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- Dialogs */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside `node`, closes on Escape, restores focus to the opener on unmount. */
export function useFocusTrap(
  active: boolean,
  node: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = node.current;
    const first =
      el?.querySelector<HTMLElement>("[data-autofocus]") ??
      el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [active, node]);
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(open, ref, () => {
    if (!loading) onCancel();
  });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px] dark:bg-black/60"
        onClick={() => !loading && onCancel()}
        aria-hidden
      />
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="relative w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl"
      >
        <div className="flex gap-4">
          {destructive ? (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10 ring-1 ring-red-100 dark:ring-red-500/20">
              <AlertTriangle className="size-5 text-red-600 dark:text-red-400" aria-hidden />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <div id={descId} className="mt-1.5 text-sm text-foreground/70">
                {description}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onCancel} disabled={loading} data-autofocus>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Toasts */

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}
interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = nextId.current++;
      setItems((l) => [...l.slice(-3), { id, kind, title, description }]);
      setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo<ToastApi>(
    () => ({
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
    }),
    [push],
  );
  const icons = { success: CheckCircle2, error: XCircle, info: Info } as const;
  const iconCls = {
    success: "text-emerald-600 dark:text-emerald-400",
    error: "text-red-600 dark:text-red-400",
    info: "text-sky-600 dark:text-sky-400",
  };
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed right-0 bottom-0 z-[60] flex w-full flex-col items-end gap-2 p-4 sm:max-w-sm"
      >
        {items.map((t) => {
          const Icon = icons[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className="toast-in pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-border bg-background p-3.5 shadow-lg"
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", iconCls[t.kind])} aria-hidden />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-foreground">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 break-words text-muted-foreground">{t.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className={cn(
                  "rounded p-0.5 text-muted-foreground/70 hover:text-foreground/80",
                  focusRing,
                )}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ Field */

export const inputClass = cn(
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-xs placeholder:text-muted-foreground/70",
  focusRing,
);

export const selectClass = cn(
  "h-9 rounded-lg border border-border bg-background pr-8 pl-3 text-sm shadow-xs",
  focusRing,
);
