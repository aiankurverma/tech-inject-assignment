import * as React from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoTile } from "@/components/crm/avatar";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  category: string;
  /** Lowest plan that includes the feature. */
  plan?: string;
  status?: "new" | "beta" | "soon";
  href?: string;
  /** Bullet points shown on the card. */
  highlights?: string[];
}

export interface FeatureGridProps {
  features: Feature[];
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Show category filter and search. Defaults to true when there are 7+ features. */
  filterable?: boolean;
  columns?: 2 | 3 | 4;
  className?: string;
}

const statusTag = {
  new: { label: "New", color: "green" },
  beta: { label: "Beta", color: "purple" },
  soon: { label: "Coming soon", color: "neutral" },
} as const;

const cols = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/** Filterable feature grid for marketing pages: category tabs with counts, search, plan and status badges, highlights and links. */
export function FeatureGrid({
  features,
  eyebrow,
  title,
  description,
  filterable,
  columns = 3,
  className,
}: FeatureGridProps) {
  const [category, setCategory] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const id = React.useId();
  const showFilters = filterable ?? features.length >= 7;

  const categories = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of features) counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
    return [
      { value: "all", label: "All", count: features.length },
      ...[...counts.entries()].map(([c, n]) => ({ value: c, label: c, count: n })),
    ];
  }, [features]);

  const q = query.trim().toLowerCase();
  const visible = features.filter(
    (f) =>
      (category === "all" || f.category === category) &&
      (!q ||
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.highlights?.some((h) => h.toLowerCase().includes(q))),
  );

  return (
    <section
      aria-labelledby={title ? `${id}-t` : undefined}
      className={cn("w-full bg-crm-bg px-4 py-16 font-crm text-crm-fg sm:px-8", className)}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        {title || eyebrow || description ? (
          <header className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            {eyebrow ? <p className="crm-eyebrow text-crm-primary uppercase">{eyebrow}</p> : null}
            {title ? (
              <h2 id={`${id}-t`} className="text-3xl font-semibold tracking-tight text-balance">
                {title}
              </h2>
            ) : null}
            {description ? <p className="text-crm-muted-fg">{description}</p> : null}
          </header>
        ) : null}

        {showFilters ? (
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="overflow-x-auto">
              <SegmentedControl
                label="Feature category"
                size="sm"
                options={categories}
                value={category}
                onValueChange={setCategory}
              />
            </div>
            <label className="relative block sm:w-64">
              <span className="sr-only">Search features</span>
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-crm-subtle"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search features"
                className="h-8 w-full rounded-crm border border-crm-input/60 bg-crm-raised pr-3 pl-8 text-xs text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40"
              />
            </label>
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {visible.length} features shown
        </p>

        {visible.length === 0 ? (
          <div className="rounded-crm border border-dashed border-crm-border p-10 text-center text-sm text-crm-subtle">
            No features match “{query}”.{" "}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
              className="cursor-pointer text-crm-fg underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className={cn("grid gap-4", cols[columns])}>
            {visible.map((f) => {
              const s = f.status ? statusTag[f.status] : null;
              const Wrapper = f.href ? "a" : "div";
              return (
                <li key={f.id}>
                  <Wrapper
                    {...(f.href ? { href: f.href } : {})}
                    className={cn(
                      "group flex h-full flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-5 shadow-crm-raised",
                      f.href &&
                        "outline-none transition-colors hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                      f.status === "soon" && "opacity-70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <LogoTile aria-hidden className="text-crm-primary">
                        {f.icon ?? f.title.slice(0, 1)}
                      </LogoTile>
                      <div className="flex flex-wrap justify-end gap-1">
                        {s ? (
                          <Tag size="sm" color={s.color}>
                            {s.label}
                          </Tag>
                        ) : null}
                        {f.plan ? (
                          <Tag size="sm" color="neutral">
                            {f.plan}
                          </Tag>
                        ) : null}
                      </div>
                    </div>
                    <h3 className="flex items-center gap-1 text-sm font-medium">
                      {f.title}
                      {f.href ? (
                        <ArrowUpRight
                          aria-hidden
                          className="size-3.5 text-crm-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                      ) : null}
                    </h3>
                    <p className="text-xs leading-5 text-crm-muted-fg">{f.description}</p>
                    {f.highlights?.length ? (
                      <ul className="mt-auto flex flex-col gap-1 border-t border-crm-border pt-3 text-xs text-crm-soft">
                        {f.highlights.map((h) => (
                          <li key={h} className="flex gap-2">
                            <span
                              aria-hidden
                              className="mt-1.5 size-1 shrink-0 rounded-full bg-crm-primary"
                            />
                            {h}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Wrapper>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
