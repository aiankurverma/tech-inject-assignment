import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CloudLogo {
  id: string;
  name: string;
  /** Optional mark (svg/img). Falls back to a monogram built from the name. */
  mark?: React.ReactNode;
  /** Case study or customer page. */
  href?: string;
  industry?: string;
  /** Short proof point, e.g. "+38% win rate". Shown on hover/focus. */
  metric?: string;
}

export interface LogoCloudProps {
  logos: CloudLogo[];
  title?: string;
  /** "grid" wraps; "marquee" scrolls horizontally (paused on hover, static for reduced motion). */
  variant?: "grid" | "marquee";
  /** Show an industry filter row built from the logos' `industry` values. */
  filterable?: boolean;
  /** Controlled industry filter ("all" = no filter). */
  industry?: string;
  defaultIndustry?: string;
  onIndustryChange?: (industry: string) => void;
  /** Grid only: logos shown before a "+N more" toggle. */
  max?: number;
  columns?: 3 | 4 | 5 | 6;
  loading?: boolean;
  className?: string;
}

const colClass = {
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
} as const;

function monogram(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    parts.length > 1 ? (parts[0]?.charAt(0) ?? "") + (parts[1]?.charAt(0) ?? "") : name.slice(0, 2)
  ).toUpperCase();
}

function LogoItem({ logo, className }: { logo: CloudLogo; className?: string }) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-crm-soft grayscale transition-[filter,color] duration-150 group-hover:text-crm-fg group-hover:grayscale-0 group-focus-visible:text-crm-fg [&_svg]:size-5">
        {logo.mark ?? (
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-[6px] bg-crm-muted text-[10px] font-semibold text-crm-fg"
          >
            {monogram(logo.name)}
          </span>
        )}
        <span className="text-sm font-medium whitespace-nowrap">{logo.name}</span>
      </span>
      {logo.metric ? (
        <span className="crm-caption text-crm-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          {logo.metric}
        </span>
      ) : null}
    </>
  );
  const base = cn(
    "group flex h-20 flex-col items-center justify-center gap-1 rounded-crm border border-crm-border bg-crm-card px-4 font-crm outline-none",
    "focus-visible:ring-2 focus-visible:ring-crm-ring/60",
    className,
  );
  if (logo.href)
    return (
      <a
        href={logo.href}
        className={cn(base, "relative hover:border-crm-input")}
        aria-label={`${logo.name}${logo.metric ? ` — ${logo.metric}` : ""}, read case study`}
      >
        {body}
        <ArrowUpRight
          aria-hidden
          className="absolute top-2 right-2 size-3 text-crm-subtle opacity-0 group-hover:opacity-100"
        />
      </a>
    );
  return <div className={base}>{body}</div>;
}

/** Social-proof strip of customer logos with industry filter, overflow toggle and marquee mode. */
export function LogoCloud({
  logos,
  title = "Trusted by revenue teams at",
  variant = "grid",
  filterable = false,
  industry,
  defaultIndustry = "all",
  onIndustryChange,
  max = 12,
  columns = 6,
  loading = false,
  className,
}: LogoCloudProps) {
  const [inner, setInner] = React.useState(defaultIndustry);
  const active = industry ?? inner;
  const [expanded, setExpanded] = React.useState(false);

  const industries = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of logos)
      if (l.industry) counts.set(l.industry, (counts.get(l.industry) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [logos]);

  const filtered = active === "all" ? logos : logos.filter((l) => l.industry === active);
  const shown = variant === "grid" && !expanded ? filtered.slice(0, max) : filtered;
  const hidden = filtered.length - shown.length;

  const pick = (v: string) => {
    if (industry === undefined) setInner(v);
    onIndustryChange?.(v);
    setExpanded(false);
  };

  return (
    <section aria-label={title} className={cn("flex flex-col gap-4 font-crm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="crm-eyebrow text-crm-soft">{title}</p>
        {filterable && industries.length > 1 ? (
          <div role="radiogroup" aria-label="Filter by industry" className="flex flex-wrap gap-1">
            {[["all", logos.length] as const, ...industries].map(([name, count]) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={active === name}
                onClick={() => pick(name)}
                className={cn(
                  "h-7 cursor-pointer rounded-full px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  active === name
                    ? "bg-crm-raised text-crm-fg shadow-crm-raised"
                    : "text-crm-muted-fg hover:text-crm-fg",
                )}
              >
                {name === "all" ? "All" : name}{" "}
                <span className="text-crm-subtle tabular-nums">{count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className={cn("grid grid-cols-2 gap-2", colClass[columns])} aria-busy="true">
          {Array.from({ length: Math.min(max, columns * 2) }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-crm bg-crm-raised" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-crm border border-dashed border-crm-border p-6 text-center text-sm text-crm-subtle">
          No customers in this industry yet.
        </p>
      ) : variant === "marquee" ? (
        <div
          className="group/m relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
          role="list"
        >
          <div className="flex w-max gap-2 motion-safe:animate-[crm-marquee_40s_linear_infinite] group-hover/m:[animation-play-state:paused] group-focus-within/m:[animation-play-state:paused]">
            {[...shown, ...shown].map((l, i) => (
              <div
                key={`${l.id}-${i}`}
                role={i < shown.length ? "listitem" : undefined}
                aria-hidden={i >= shown.length || undefined}
              >
                <LogoItem logo={l} className="w-44" />
              </div>
            ))}
          </div>
          <style>{`@keyframes crm-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
        </div>
      ) : (
        <div role="list" className={cn("grid grid-cols-2 gap-2", colClass[columns])}>
          {shown.map((l) => (
            <div key={l.id} role="listitem">
              <LogoItem logo={l} />
            </div>
          ))}
        </div>
      )}

      {variant === "grid" && (hidden > 0 || expanded) && filtered.length > max ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          className="self-center rounded-full px-3 py-1 text-xs text-crm-muted-fg outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          {expanded ? "Show fewer" : `+${hidden} more customers`}
        </button>
      ) : null}
    </section>
  );
}
