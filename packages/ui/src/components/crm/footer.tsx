import * as React from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
  /** Small tag after the label, e.g. "New" or "Hiring". */
  badge?: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterSocial {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export type SystemStatus = "operational" | "degraded" | "outage";

export interface FooterProps {
  brand: React.ReactNode;
  tagline?: string;
  columns: FooterColumn[];
  socials?: FooterSocial[];
  /** Live status pill linking to your status page. */
  status?: { state: SystemStatus; href: string };
  /** Region/language picker. */
  locales?: { value: string; label: string }[];
  locale?: string;
  onLocaleChange?: (value: string) => void;
  /** Newsletter signup; resolve to confirm, reject to show error. */
  onSubscribe?: (email: string) => Promise<void>;
  legal?: FooterLink[];
  company?: string;
  className?: string;
}

const statusMeta: Record<SystemStatus, { label: string; dot: string }> = {
  operational: { label: "All systems operational", dot: "bg-crm-success" },
  degraded: { label: "Degraded performance", dot: "bg-crm-warning" },
  outage: { label: "Service outage", dot: "bg-crm-danger" },
};

function LinkItem({ link }: { link: FooterLink }) {
  return (
    <a
      href={link.href}
      target={link.external ? "_blank" : undefined}
      rel={link.external ? "noopener noreferrer" : undefined}
      className="inline-flex items-center gap-1.5 rounded text-sm text-crm-soft outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3"
    >
      {link.label}
      {link.external ? (
        <>
          <ExternalLink aria-hidden />
          <span className="sr-only">(opens in new tab)</span>
        </>
      ) : null}
      {link.badge ? (
        <span className="rounded-full bg-crm-primary/20 px-1.5 text-[10px] font-medium text-crm-primary">
          {link.badge}
        </span>
      ) : null}
    </a>
  );
}

/** Site footer: link columns (collapsible on mobile), newsletter, status pill, locale and legal row. */
export function Footer({
  brand,
  tagline,
  columns,
  socials = [],
  status,
  locales,
  locale,
  onLocaleChange,
  onSubscribe,
  legal = [],
  company,
  className,
}: FooterProps) {
  const id = React.useId();
  const [openCol, setOpenCol] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [sub, setSub] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = React.useState("");
  const year = new Date().getFullYear();

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubscribe) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setSub("error");
      setMsg("Enter a valid email address.");
      return;
    }
    setSub("loading");
    try {
      await onSubscribe(email.trim());
      setSub("done");
      setMsg("You're subscribed. One email a month, unsubscribe anytime.");
      setEmail("");
    } catch (x) {
      setSub("error");
      setMsg(x instanceof Error ? x.message : "Couldn't subscribe. Try again.");
    }
  };

  return (
    <footer className={cn("border-t border-crm-border bg-crm-bg font-crm", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
        <div
          className="grid gap-8 lg:grid-cols-[1.4fr_repeat(var(--cols),1fr)]"
          style={{ "--cols": columns.length } as React.CSSProperties}
        >
          <div className="flex flex-col gap-4">
            <div className="text-crm-fg">{brand}</div>
            {tagline ? <p className="max-w-xs text-sm text-crm-soft">{tagline}</p> : null}
            {onSubscribe ? (
              <form noValidate onSubmit={subscribe} className="flex max-w-sm flex-col gap-1.5">
                <label htmlFor={`${id}-nl`} className="text-xs text-crm-soft">
                  Product updates
                </label>
                <div className="flex gap-2">
                  <Input
                    id={`${id}-nl`}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    invalid={sub === "error"}
                    aria-describedby={msg ? `${id}-nlm` : undefined}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (sub === "error") setSub("idle");
                    }}
                  />
                  <Button type="submit" size="lg" loading={sub === "loading"}>
                    Subscribe
                  </Button>
                </div>
                {msg && (sub === "error" || sub === "done") ? (
                  <p
                    id={`${id}-nlm`}
                    role={sub === "error" ? "alert" : "status"}
                    className={cn(
                      "text-xs",
                      sub === "error" ? "text-crm-danger" : "text-crm-success",
                    )}
                  >
                    {msg}
                  </p>
                ) : null}
              </form>
            ) : null}
          </div>

          {columns.map((col) => {
            const open = openCol === col.title;
            const listId = `${id}-${col.title.replace(/\W+/g, "-")}`;
            return (
              <nav
                key={col.title}
                aria-label={col.title}
                className="border-b border-crm-border pb-3 lg:border-0 lg:pb-0"
              >
                <h3 className="hidden crm-eyebrow text-crm-fg lg:block">{col.title}</h3>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => setOpenCol(open ? null : col.title)}
                  className="flex w-full items-center justify-between py-1 crm-eyebrow text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 lg:hidden"
                >
                  {col.title}
                  <ChevronDown
                    aria-hidden
                    className={cn("size-4 transition-transform", open && "rotate-180")}
                  />
                </button>
                <ul
                  id={listId}
                  className={cn("mt-3 flex-col gap-2", open ? "flex" : "hidden lg:flex")}
                >
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <LinkItem link={l} />
                    </li>
                  ))}
                </ul>
              </nav>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 border-t border-crm-border pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 crm-caption text-crm-subtle">
            <span>
              © {year} {company ?? ""}
            </span>
            {legal.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="rounded outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {status ? (
              <a
                href={status.href}
                className="inline-flex h-7 items-center gap-2 rounded-full border border-crm-border px-2.5 text-xs text-crm-soft outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", statusMeta[status.state].dot)}
                />
                {statusMeta[status.state].label}
              </a>
            ) : null}
            {locales && locales.length > 0 ? (
              <>
                <label htmlFor={`${id}-loc`} className="sr-only">
                  Language and region
                </label>
                <select
                  id={`${id}-loc`}
                  value={locale}
                  onChange={(e) => onLocaleChange?.(e.target.value)}
                  className="h-7 rounded-full border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg outline-none [color-scheme:dark] focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  {locales.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {socials.length ? (
              <ul className="flex items-center gap-1">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      aria-label={s.label}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-7 items-center justify-center rounded-full text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5"
                    >
                      {s.icon}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
