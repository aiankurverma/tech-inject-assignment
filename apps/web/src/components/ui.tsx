import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

/** Shared class strings so every button in the catalogue looks the same. */
export const btn = {
  primary:
    "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium whitespace-nowrap text-foreground shadow-xs transition-colors hover:border-foreground/20 hover:bg-muted/50",
  ghost:
    "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
};

export const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/20 focus:border-primary focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-ring/30";

/** Inline error box. */
export const alertClass =
  "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300";

export function PlanBadge({ plan }: { plan: "free" | "premium" }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium ${
        plan === "premium"
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground/80"
      }`}
    >
      {plan === "premium" ? "Premium" : "Free"}
    </span>
  );
}

/** Access pill for a component: "Free", "Premium", or "Premium" with a lock when not available. */
export function AccessBadge({ access, locked }: { access: "free" | "premium"; locked: boolean }) {
  if (access === "free")
    return (
      <span className="inline-flex h-5 items-center rounded-full border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground">
        Free
      </span>
    );
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-full border border-primary bg-primary px-2 text-[11px] font-medium text-primary-foreground">
      {locked ? <Lock className="size-2.5" aria-label="Locked" /> : null}
      Premium
    </span>
  );
}

/** "Private · @team" pill for team components. */
export function TeamBadge({ team }: { team: string }) {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-full border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground">
      <Lock className="size-2.5" aria-hidden />
      Private · @{team}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

/** Centered message block for empty, error and not-found states. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full border border-border bg-background text-foreground/80 shadow-xs">
        {icon}
      </span>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      {children ? (
        <div className="mt-1.5 max-w-sm text-sm text-muted-foreground">{children}</div>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-10">
      {eyebrow ? <div className="mb-3 text-sm text-muted-foreground">{eyebrow}</div> : null}
      <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
        {title}
      </h1>
      {children ? (
        <div className="mt-3 max-w-2xl text-base leading-7 text-pretty text-muted-foreground sm:text-lg">
          {children}
        </div>
      ) : null}
    </header>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span aria-hidden className="text-muted-foreground/70">
                /
              </span>
            ) : null}
            {item.to ? (
              <Link to={item.to} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : i === items.length - 1 ? (
              <span aria-current="page" className="font-medium text-foreground">
                {item.label}
              </span>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Segmented tab list with arrow-key navigation. Panels use id `${idPrefix}-panel-${value}`. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
  idPrefix,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string }[];
  label: string;
  idPrefix: string;
}) {
  const move = (dir: 1 | -1) => {
    const i = items.findIndex((t) => t.value === value);
    const next = items[(i + dir + items.length) % items.length];
    if (!next) return;
    onChange(next.value);
    document.getElementById(`${idPrefix}-tab-${next.value}`)?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted p-1"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") move(1);
        if (e.key === "ArrowLeft") move(-1);
      }}
    >
      {items.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            id={`${idPrefix}-tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={`inline-flex h-7 items-center rounded-md px-3 text-sm font-medium transition-all ${
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
