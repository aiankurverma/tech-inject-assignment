import * as React from "react";
import { ArrowRight, Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { AvatarGroup } from "@/components/crm/avatar-group";

export interface HeroProps {
  /** Small pill above the headline, e.g. a launch announcement. */
  announcement?: { label: string; href?: string; badge?: string };
  headline: React.ReactNode;
  subheadline?: React.ReactNode;
  /** Email capture; resolves when the trial is started. Reject to show an error. */
  onStartTrial?: (email: string) => Promise<void> | void;
  ctaLabel?: string;
  secondaryCta?: { label: string; href?: string; onClick?: () => void };
  /** Short reassurance list under the form. */
  assurances?: string[];
  socialProof?: {
    people: { name: string; src?: string }[];
    rating?: number;
    reviews?: number;
    label?: string;
  };
  /** Product screenshot or live component preview. */
  media?: React.ReactNode;
  align?: "center" | "split";
  /** Domains rejected as personal email (B2B trial). Empty array to allow all. */
  blockedDomains?: string[];
  className?: string;
}

const PERSONAL = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"];

/** Marketing hero with announcement pill, work-email trial capture (validation, personal-domain block, async states), social proof and media slot. */
export function Hero({
  announcement,
  headline,
  subheadline,
  onStartTrial,
  ctaLabel = "Start free trial",
  secondaryCta,
  assurances = [],
  socialProof,
  media,
  align = "center",
  blockedDomains = PERSONAL,
  className,
}: HeroProps) {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  const split = align === "split" && !!media;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))
      return setError("Enter a valid email address");
    const domain = value.split("@")[1] ?? "";
    if (blockedDomains.includes(domain)) return setError("Please use your work email");
    setError(null);
    setStatus("busy");
    try {
      await onStartTrial?.(value);
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Could not start your trial");
    }
  };

  const secondary = secondaryCta ? (
    secondaryCta.href ? (
      <Button asChild size="lg" variant="ghost">
        <a href={secondaryCta.href}>{secondaryCta.label}</a>
      </Button>
    ) : (
      <Button size="lg" variant="ghost" onClick={secondaryCta.onClick}>
        {secondaryCta.label}
      </Button>
    )
  ) : null;

  return (
    <section
      aria-labelledby={`${id}-h`}
      className={cn(
        "relative w-full overflow-hidden bg-crm-bg px-4 py-16 font-crm text-crm-fg sm:px-8 sm:py-24",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 max-w-3xl rounded-full bg-crm-primary/20 blur-3xl"
      />
      <div
        className={cn(
          "relative mx-auto grid max-w-6xl items-center gap-12",
          split ? "lg:grid-cols-2" : "justify-items-center text-center",
        )}
      >
        <div
          className={cn("flex flex-col gap-6", split ? "items-start" : "max-w-2xl items-center")}
        >
          {announcement ? (
            <a
              href={announcement.href ?? "#"}
              className="inline-flex items-center gap-2 rounded-full border border-crm-border bg-crm-raised py-1 pr-3 pl-1 text-xs text-crm-soft shadow-crm-raised outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              {announcement.badge ? (
                <span className="rounded-full bg-crm-primary px-2 py-0.5 text-crm-primary-fg">
                  {announcement.badge}
                </span>
              ) : null}
              {announcement.label}
              <ArrowRight className="size-3" aria-hidden />
            </a>
          ) : null}
          <h1
            id={`${id}-h`}
            className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl"
          >
            {headline}
          </h1>
          {subheadline ? (
            <p className="max-w-xl text-base text-pretty text-crm-muted-fg sm:text-lg">
              {subheadline}
            </p>
          ) : null}

          {onStartTrial ? (
            status === "done" ? (
              <p
                role="status"
                className="flex items-center gap-2 rounded-crm border border-crm-success/40 bg-crm-success/10 px-4 py-3 text-sm"
              >
                <Check className="size-4 text-crm-success" aria-hidden />
                Check {email.trim()} for your sign-in link.
              </p>
            ) : (
              <form
                noValidate
                onSubmit={submit}
                className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
              >
                <label htmlFor={`${id}-e`} className="sr-only">
                  Work email
                </label>
                <Input
                  id={`${id}-e`}
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  invalid={!!error}
                  aria-describedby={`${id}-err`}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className="h-10"
                />
                <Button
                  type="submit"
                  size="lg"
                  variant="primary"
                  loading={status === "busy"}
                  className="h-10"
                >
                  {ctaLabel}
                </Button>
              </form>
            )
          ) : null}
          <p
            id={`${id}-err`}
            role="alert"
            className="-mt-4 min-h-4 text-xs text-crm-danger empty:hidden"
          >
            {error ?? ""}
          </p>

          {secondary}

          {assurances.length ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-crm-subtle">
              {assurances.map((a) => (
                <li key={a} className="flex items-center gap-1">
                  <Check className="size-3 text-crm-success" aria-hidden /> {a}
                </li>
              ))}
            </ul>
          ) : null}

          {socialProof ? (
            <div className="flex items-center gap-3">
              <AvatarGroup people={socialProof.people} max={5} />
              <div className="flex flex-col gap-0.5 text-left text-xs">
                {socialProof.rating !== undefined ? (
                  <span className="flex items-center gap-1 text-crm-fg">
                    <span className="flex" aria-hidden>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "size-3",
                            i < Math.round(socialProof.rating ?? 0)
                              ? "fill-crm-warning text-crm-warning"
                              : "text-crm-subtle",
                          )}
                        />
                      ))}
                    </span>
                    <span>
                      {socialProof.rating.toFixed(1)}
                      <span className="sr-only"> out of 5</span>
                    </span>
                    {socialProof.reviews ? (
                      <span className="text-crm-subtle">
                        ({socialProof.reviews.toLocaleString()} reviews)
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {socialProof.label ? (
                  <span className="text-crm-subtle">{socialProof.label}</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {media ? (
          <div className="w-full rounded-crm border border-crm-border bg-crm-card p-2 shadow-crm-raised">
            {media}
          </div>
        ) : null}
      </div>
    </section>
  );
}
