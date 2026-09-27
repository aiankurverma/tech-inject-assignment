import { Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";

export interface StarRatingProps {
  /** 0-5 */
  value: number;
  label?: string;
  className?: string;
}

/** Pill with a text label and up to five green stars. */
export function StarRating({ value, label, className }: StarRatingProps) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-crm text-xs font-medium text-crm-fg",
        className,
      )}
    >
      {label}
      <span
        role="img"
        aria-label={`${v} out of 5`}
        className="inline-flex items-center gap-0.5 rounded-full border border-crm-border bg-crm-raised px-1.5 py-0.5"
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "size-2.5",
              i < v ? "fill-crm-success text-crm-success" : "text-crm-faint",
            )}
            aria-hidden
          />
        ))}
      </span>
    </span>
  );
}

export interface ScoreCardProps {
  title: string;
  description: string;
  owner: { name: string; avatar?: string };
  updated: string;
  rating: number;
  ratingLabel?: string;
  className?: string;
}

/** Evaluation card: title, description, owner, update time and rating. */
export function ScoreCard({
  title,
  description,
  owner,
  updated,
  rating,
  ratingLabel = "High potential",
  className,
}: ScoreCardProps) {
  return (
    <article
      className={cn("rounded-crm border border-crm-input/70 bg-crm-bg p-4 font-crm", className)}
    >
      <h4 className="text-base font-medium text-crm-fg">{title}</h4>
      <p className="mt-1 text-sm text-crm-soft">{description}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-medium text-crm-fg">
            <Avatar name={owner.name} src={owner.avatar} size="xs" />
            {owner.name}
          </span>
          <span className="flex items-center gap-1 text-crm-soft">
            <Clock className="size-3" aria-hidden />
            {updated}
          </span>
        </span>
        <StarRating value={rating} label={ratingLabel} />
      </div>
    </article>
  );
}
