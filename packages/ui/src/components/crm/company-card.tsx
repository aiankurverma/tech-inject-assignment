import * as React from "react";
import { Building2, CalendarClock, ExternalLink, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, LogoTile } from "@/components/crm/avatar";
import { TagList, type TagColor } from "@/components/crm/tag";

export interface CompanyCardData {
  id: string;
  name: string;
  domain?: string;
  logoUrl?: string;
  industry?: string;
  location?: string;
  employees?: number;
  /** Annual recurring revenue in `currency`. */
  arr?: number;
  currency?: string;
  /** ISO date of the next renewal. */
  renewalDate?: string;
  openDeals?: { count: number; amount: number };
  /** 0-100 customer health. */
  health?: number;
  owner?: { name: string; avatarUrl?: string };
  tags?: { label: string; color: TagColor }[];
  lifecycle?: "prospect" | "customer" | "churned" | "partner";
}

export interface CompanyCardProps {
  company: CompanyCardData;
  /** Today's date for renewal countdown (inject for SSR / tests). */
  now?: Date;
  selected?: boolean;
  onOpen?: (id: string) => void;
  /** Right-aligned header slot, e.g. a menu. */
  action?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

const lifecycleCls: Record<NonNullable<CompanyCardData["lifecycle"]>, string> = {
  prospect: "text-tag-blue-text",
  customer: "text-crm-success",
  churned: "text-crm-danger",
  partner: "text-tag-purple-text",
};

const empBand = (n: number) =>
  n >= 10000 ? "10k+" : n >= 1000 ? "1k–10k" : n >= 200 ? "200–1k" : n >= 50 ? "50–200" : "1–50";

const DAY = 86_400_000;

/**
 * Account summary card: logo, domain link, lifecycle, firmographics, ARR, open pipeline, a renewal
 * countdown that turns amber inside 90 days and red inside 30, health meter, owner and tags.
 * Clickable as a whole (Enter/Space) when `onOpen` is set.
 */
export function CompanyCard({
  company: c,
  now,
  selected,
  onOpen,
  action,
  loading,
  className,
}: CompanyCardProps) {
  const money = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: c.currency ?? "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [c.currency],
  );

  if (loading) {
    return (
      <div
        aria-busy
        className={cn(
          "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4",
          className,
        )}
      >
        <div className="flex gap-3">
          <span className="size-8 animate-pulse rounded-crm bg-crm-muted" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3 w-1/2 animate-pulse rounded bg-crm-muted" />
            <span className="h-2.5 w-1/3 animate-pulse rounded bg-crm-muted" />
          </span>
        </div>
        <span className="h-10 animate-pulse rounded bg-crm-muted" />
      </div>
    );
  }

  const today = now ?? new Date();
  const days = c.renewalDate
    ? Math.ceil((new Date(c.renewalDate).getTime() - today.getTime()) / DAY)
    : null;
  const renewalCls =
    days == null
      ? ""
      : days < 0
        ? "text-crm-danger"
        : days <= 30
          ? "text-crm-danger"
          : days <= 90
            ? "text-crm-warning"
            : "text-crm-soft";
  const renewalText =
    days == null
      ? null
      : days < 0
        ? `Renewal overdue ${-days}d`
        : days === 0
          ? "Renews today"
          : `Renews in ${days}d`;
  const health = c.health != null ? Math.max(0, Math.min(100, Math.round(c.health))) : null;
  const healthColor =
    health == null
      ? ""
      : health >= 70
        ? "bg-crm-success"
        : health >= 40
          ? "bg-crm-warning"
          : "bg-crm-danger";

  const interactive = !!onOpen;
  return (
    <article
      aria-label={c.name}
      aria-current={selected || undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onOpen(c.id) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                e.preventDefault();
                onOpen(c.id);
              }
            }
          : undefined
      }
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-crm border bg-crm-card p-4 font-crm text-crm-fg outline-none",
        selected ? "border-crm-primary ring-1 ring-crm-primary/50" : "border-crm-border",
        interactive &&
          "cursor-pointer transition-colors hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <LogoTile>
          {c.logoUrl ? <img src={c.logoUrl} alt="" /> : <Building2 aria-hidden />}
        </LogoTile>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{c.name}</h3>
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-crm-subtle">
            {c.domain ? (
              <a
                href={`https://${c.domain}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-w-0 items-center gap-0.5 truncate hover:text-crm-fg hover:underline"
              >
                {c.domain}
                <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
            ) : null}
            {c.lifecycle ? (
              <span className={cn("shrink-0 capitalize", lifecycleCls[c.lifecycle])}>
                · {c.lifecycle}
              </span>
            ) : null}
          </p>
        </div>
        {action ? <div onClick={(e) => e.stopPropagation()}>{action}</div> : null}
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="crm-caption text-crm-subtle">ARR</dt>
          <dd className="font-medium tabular-nums">{c.arr != null ? money.format(c.arr) : "—"}</dd>
        </div>
        <div>
          <dt className="crm-caption text-crm-subtle">Open pipeline</dt>
          <dd className="tabular-nums">
            {c.openDeals && c.openDeals.count > 0 ? (
              <>
                <span className="font-medium">{money.format(c.openDeals.amount)}</span>
                <span className="text-crm-subtle">
                  {" "}
                  · {c.openDeals.count} deal{c.openDeals.count === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span className="text-crm-subtle">None</span>
            )}
          </dd>
        </div>
      </dl>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-crm-soft">
        {c.industry ? <li>{c.industry}</li> : null}
        {c.employees != null ? (
          <li
            className="inline-flex items-center gap-1"
            title={`${c.employees.toLocaleString("en-US")} employees`}
          >
            <Users className="size-3" aria-hidden />
            {empBand(c.employees)}
          </li>
        ) : null}
        {c.location ? (
          <li className="inline-flex items-center gap-1">
            <MapPin className="size-3" aria-hidden />
            {c.location}
          </li>
        ) : null}
        {renewalText ? (
          <li className={cn("inline-flex items-center gap-1", renewalCls)}>
            <CalendarClock className="size-3" aria-hidden />
            {renewalText}
          </li>
        ) : null}
      </ul>

      {health != null ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="crm-caption w-12 text-crm-subtle">Health</span>
          <span
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-crm-track"
            role="meter"
            aria-label="Health"
            aria-valuenow={health}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              className={cn("block h-full rounded-full", healthColor)}
              style={{ width: `${health}%` }}
            />
          </span>
          <span className="w-6 text-right tabular-nums">{health}</span>
        </div>
      ) : null}

      {c.owner || c.tags?.length ? (
        <footer className="flex items-center justify-between gap-2 border-t border-crm-border pt-3">
          {c.owner ? (
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-crm-soft">
              <Avatar name={c.owner.name} src={c.owner.avatarUrl} size="sm" />
              <span className="truncate">{c.owner.name}</span>
            </span>
          ) : (
            <span />
          )}
          {c.tags?.length ? <TagList tags={c.tags} size="sm" max={2} /> : null}
        </footer>
      ) : null}
    </article>
  );
}
