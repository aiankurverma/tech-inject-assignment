import * as React from "react";
import { diffWords } from "diff";
import { cn } from "@/lib/utils";

/**
 * Inline word-level diff (jsdiff's diffWords). Shows `value` relative to `base`:
 * added words are highlighted, removed ones struck through (optional).
 */
export const WordDiff = React.memo(function WordDiff({
  base,
  value,
  showRemoved = false,
  className,
}: {
  base: string;
  value: string;
  showRemoved?: boolean;
  className?: string;
}) {
  const parts = React.useMemo(
    () => (base === value || !base ? null : diffWords(base, value, { ignoreCase: false })),
    [base, value],
  );
  if (!parts) return <span className={className}>{value}</span>;
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.added ? (
          <mark key={i} className="rounded-sm bg-crm-warning/25 px-px text-crm-fg">
            <span className="sr-only">added </span>
            {p.value}
          </mark>
        ) : p.removed ? (
          showRemoved ? (
            <del key={i} className="text-crm-danger/80 decoration-crm-danger/70">
              <span className="sr-only">removed </span>
              {p.value}
            </del>
          ) : null
        ) : (
          <span key={i} className={cn(showRemoved && "text-crm-soft")}>
            {p.value}
          </span>
        ),
      )}
    </span>
  );
});
