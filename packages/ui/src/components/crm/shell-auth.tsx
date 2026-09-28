import * as React from "react";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";

export interface AuthTestimonial {
  quote: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

export interface AuthStat {
  value: string;
  label: string;
}

export interface ShellAuthProps {
  brand: { name: string; logo: React.ReactNode };
  /** Form heading, e.g. "Sign in to Acme". */
  title: string;
  subtitle?: React.ReactNode;
  /** The form (fields, buttons). */
  children: React.ReactNode;
  /** Under the form, e.g. "No account? Sign up". */
  footer?: React.ReactNode;
  /** Right/left marketing panel content. Omit panel for a centered card layout. */
  panel?: {
    headline: string;
    testimonials?: AuthTestimonial[];
    stats?: AuthStat[];
    /** Rotate testimonials every N ms (paused on hover/focus and for reduced motion). */
    rotateMs?: number;
  };
  /** Side the marketing panel sits on. */
  panelSide?: "left" | "right";
  /** Links in the bottom bar (Terms, Privacy, Status). */
  legalLinks?: { label: string; href: string }[];
  /** e.g. region/data-residency selector or language picker. */
  topRight?: React.ReactNode;
  className?: string;
}

/**
 * Authentication layout: brand header, form column with title and footer, optional marketing
 * panel with rotating testimonials and proof stats (hidden under 1024px), and legal links.
 */
export function ShellAuth({
  brand,
  title,
  subtitle,
  children,
  footer,
  panel,
  panelSide = "right",
  legalLinks = [],
  topRight,
  className,
}: ShellAuthProps) {
  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const testimonials = panel?.testimonials ?? [];
  const rotateMs = panel?.rotateMs ?? 7000;

  React.useEffect(() => {
    if (testimonials.length < 2 || paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % testimonials.length), rotateMs);
    return () => window.clearInterval(t);
  }, [testimonials.length, paused, rotateMs]);

  const t = testimonials[idx];

  const form = (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 px-6 py-5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="grid size-7 place-items-center rounded-crm bg-crm-muted shadow-crm-raised [&_svg]:size-4">
            {brand.logo}
          </span>
          {brand.name}
        </span>
        {topRight}
      </header>
      <main className="grid flex-1 place-items-center px-6 py-8">
        <div
          className={cn(
            "flex w-full max-w-[380px] flex-col gap-6",
            !panel && "rounded-crm border border-crm-border bg-crm-card p-6 shadow-crm-raised",
          )}
        >
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-medium tracking-[-0.01em]">{title}</h1>
            {subtitle ? <p className="text-sm text-crm-muted-fg">{subtitle}</p> : null}
          </div>
          {children}
          {footer ? <div className="text-center text-xs text-crm-muted-fg">{footer}</div> : null}
        </div>
      </main>
      {legalLinks.length ? (
        <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-6 py-4 text-[11px] text-crm-subtle">
          {legalLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              {l.label}
            </a>
          ))}
        </footer>
      ) : null}
    </div>
  );

  const aside = panel ? (
    <aside
      aria-label="Why teams choose us"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden border-crm-border bg-crm-sidebar p-10 lg:flex",
        panelSide === "left" ? "border-r" : "border-l",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 size-[420px] rounded-full bg-crm-primary/20 blur-3xl"
      />
      <h2 className="relative max-w-md text-2xl font-medium tracking-[-0.02em]">
        {panel.headline}
      </h2>
      {t ? (
        <figure className="relative flex flex-col gap-4" aria-live={paused ? "off" : "polite"}>
          <Quote aria-hidden className="size-5 text-crm-subtle" />
          <blockquote className="text-base leading-relaxed text-crm-soft">“{t.quote}”</blockquote>
          <figcaption className="flex items-center gap-3">
            <Avatar name={t.name} src={t.avatarUrl} size="md" />
            <span className="flex flex-col">
              <span className="text-sm font-medium">{t.name}</span>
              <span className="text-xs text-crm-muted-fg">{t.role}</span>
            </span>
          </figcaption>
          {testimonials.length > 1 ? (
            <div role="tablist" aria-label="Testimonials" className="flex gap-1.5">
              {testimonials.map((x, i) => (
                <button
                  key={x.name}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  aria-label={`Testimonial ${i + 1} of ${testimonials.length}`}
                  onClick={() => setIdx(i)}
                  className={cn(
                    "h-1.5 rounded-full outline-none transition-[width,background-color] focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                    i === idx ? "w-6 bg-crm-fg" : "w-1.5 bg-crm-subtle",
                  )}
                />
              ))}
            </div>
          ) : null}
        </figure>
      ) : null}
      {panel.stats?.length ? (
        <dl className="relative grid grid-cols-3 gap-4 border-t border-crm-border pt-6">
          {panel.stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <dt className="order-2 text-xs text-crm-muted-fg">{s.label}</dt>
              <dd className="order-1 text-xl font-medium tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </aside>
  ) : null;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full bg-crm-bg font-crm text-crm-fg",
        panelSide === "left" && "flex-row-reverse",
        className,
      )}
    >
      {form}
      {aside}
    </div>
  );
}
