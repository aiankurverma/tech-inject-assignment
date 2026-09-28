import * as React from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Rating } from "@/components/crm/rating";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface Testimonial {
  id: string;
  quote: string;
  author: { name: string; title: string; company: string; avatarUrl?: string };
  /** 1-5 stars. */
  rating?: number;
  industry?: string;
  /** Headline outcome, e.g. { value: "38%", label: "faster close" }. */
  metric?: { value: string; label: string };
  /** Where the review came from, e.g. "G2". */
  source?: string;
}

export interface TestimonialsProps {
  items: Testimonial[];
  variant?: "grid" | "carousel";
  title?: React.ReactNode;
  /** Show industry filter tabs when items have industries. */
  filterable?: boolean;
  /** Carousel autoplay interval (ms). 0 disables. Paused on hover/focus and reduced motion. */
  autoplayMs?: number;
  className?: string;
}

function Card({ t, featured }: { t: Testimonial; featured?: boolean }) {
  return (
    <figure
      className={cn(
        "flex h-full flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-5 shadow-crm-raised",
        featured && "p-6 sm:p-8",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {t.rating ? (
          <Rating value={t.rating} readOnly size="sm" label={`${t.rating} out of 5 stars`} />
        ) : (
          <Quote className="size-4 text-crm-primary" aria-hidden />
        )}
        {t.source ? <span className="crm-caption text-crm-subtle">via {t.source}</span> : null}
      </div>
      {t.metric ? (
        <p className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-crm-fg tabular-nums">{t.metric.value}</span>
          <span className="text-xs text-crm-muted-fg">{t.metric.label}</span>
        </p>
      ) : null}
      <blockquote
        className={cn(
          "flex-1 text-crm-soft",
          featured ? "text-base leading-7" : "text-sm leading-6",
        )}
      >
        <p>“{t.quote}”</p>
      </blockquote>
      <figcaption className="flex items-center gap-3 border-t border-crm-border pt-4">
        <Avatar name={t.author.name} src={t.author.avatarUrl} size="md" />
        <span className="min-w-0 text-xs">
          <span className="block truncate font-medium text-crm-fg">{t.author.name}</span>
          <span className="block truncate text-crm-subtle">
            {t.author.title}, {t.author.company}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/** Customer testimonials as a grid or accessible carousel: industry filter, aggregate rating, outcome metrics, autoplay that pauses on hover/focus/reduced motion, arrow-key navigation. */
export function Testimonials({
  items,
  variant = "grid",
  title,
  filterable = true,
  autoplayMs = 7000,
  className,
}: TestimonialsProps) {
  const [industry, setIndustry] = React.useState("all");
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);
  const id = React.useId();

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const industries = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const t of items) if (t.industry) m.set(t.industry, (m.get(t.industry) ?? 0) + 1);
    return [...m.entries()];
  }, [items]);

  const visible = industry === "all" ? items : items.filter((t) => t.industry === industry);
  const rated = visible.filter((t) => t.rating);
  const avg = rated.length ? rated.reduce((s, t) => s + (t.rating ?? 0), 0) / rated.length : 0;
  const safeIndex = visible.length ? index % visible.length : 0;

  const running =
    variant === "carousel" &&
    autoplayMs > 0 &&
    !paused &&
    !hovered &&
    !reduced &&
    visible.length > 1;
  React.useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setIndex((i) => i + 1), autoplayMs);
    return () => window.clearInterval(t);
  }, [running, autoplayMs]);

  const move = (d: number) =>
    setIndex((i) => (((i + d) % visible.length) + visible.length) % visible.length);

  const current = visible[safeIndex];

  return (
    <section
      aria-labelledby={title ? `${id}-t` : undefined}
      className={cn("flex w-full flex-col gap-6 font-crm text-crm-fg", className)}
    >
      <header className="flex flex-col items-center gap-3 text-center">
        {title ? (
          <h2 id={`${id}-t`} className="text-3xl font-semibold tracking-tight text-balance">
            {title}
          </h2>
        ) : null}
        {rated.length ? (
          <p className="flex items-center gap-2 text-sm text-crm-muted-fg">
            <Rating
              value={Math.round(avg * 2) / 2}
              readOnly
              size="sm"
              label={`Average ${avg.toFixed(1)} out of 5`}
            />
            <span>
              <span className="text-crm-fg">{avg.toFixed(1)}</span> average from {rated.length}{" "}
              {rated.length === 1 ? "review" : "reviews"}
            </span>
          </p>
        ) : null}
        {filterable && industries.length > 1 ? (
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl
              label="Filter by industry"
              size="sm"
              value={industry}
              onValueChange={(v) => {
                setIndustry(v);
                setIndex(0);
              }}
              options={[
                { value: "all", label: "All", count: items.length },
                ...industries.map(([v, n]) => ({ value: v, label: v, count: n })),
              ]}
            />
          </div>
        ) : null}
      </header>

      {visible.length === 0 ? (
        <p className="rounded-crm border border-dashed border-crm-border p-10 text-center text-sm text-crm-subtle">
          No testimonials yet.
        </p>
      ) : variant === "grid" ? (
        <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid">
          {visible.map((t) => (
            <li key={t.id}>
              <Card t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Customer testimonials"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") move(1);
            if (e.key === "ArrowLeft") move(-1);
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(false);
          }}
          className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-crm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <div
            role="group"
            aria-roledescription="slide"
            aria-label={`${safeIndex + 1} of ${visible.length}`}
            aria-live={running ? "off" : "polite"}
          >
            {current ? <Card t={current} featured /> : null}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Previous testimonial"
              onClick={() => move(-1)}
              className="grid size-[30px] cursor-pointer place-items-center rounded-full bg-crm-raised text-crm-fg shadow-crm-raised outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex gap-1.5">
              {visible.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`Show testimonial ${i + 1} from ${t.author.company}`}
                  aria-current={i === safeIndex || undefined}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-1.5 cursor-pointer rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                    i === safeIndex
                      ? "w-5 bg-crm-primary"
                      : "w-1.5 bg-crm-muted hover:bg-crm-subtle",
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next testimonial"
              onClick={() => move(1)}
              className="grid size-[30px] cursor-pointer place-items-center rounded-full bg-crm-raised text-crm-fg shadow-crm-raised outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <ChevronRight className="size-4" />
            </button>
            {autoplayMs > 0 && visible.length > 1 && !reduced ? (
              <button
                type="button"
                aria-label={paused ? "Resume autoplay" : "Pause autoplay"}
                onClick={() => setPaused((p) => !p)}
                className="grid size-[30px] cursor-pointer place-items-center rounded-full text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
