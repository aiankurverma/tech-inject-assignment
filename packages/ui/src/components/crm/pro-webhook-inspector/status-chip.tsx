import { cn } from "@/lib/utils";
import type { DeliveryOutcome } from "@/components/crm/pro-webhook-inspector/types";

const TONE = {
  green: "border-tag-green-border bg-tag-green-bg text-tag-green-text",
  amber: "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text",
  red: "border-tag-red-border bg-tag-red-bg text-tag-red-text",
  blue: "border-tag-blue-border bg-tag-blue-bg text-tag-blue-text",
  neutral: "border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text",
} as const;

function statusTone(code: number | null) {
  if (code == null) return TONE.red;
  if (code < 300) return TONE.green;
  if (code < 400) return TONE.blue;
  if (code < 500 || code === 429) return TONE.amber;
  return TONE.red;
}

/** HTTP status code chip; null renders as a transport error ("ERR"). */
export function StatusCodeChip({ code, className }: { code: number | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-10 justify-center rounded-md border px-1.5 py-px font-mono text-[11px] tabular-nums",
        statusTone(code),
        className,
      )}
      title={code == null ? "No response (network error or timeout)" : `HTTP ${code}`}
    >
      {code ?? "ERR"}
    </span>
  );
}

const OUTCOME: Record<DeliveryOutcome, { label: string; tone: string; dot: string }> = {
  succeeded: { label: "Succeeded", tone: TONE.green, dot: "bg-crm-success" },
  retrying: { label: "Retrying", tone: TONE.amber, dot: "bg-crm-warning" },
  failed: { label: "Failed", tone: TONE.red, dot: "bg-crm-danger" },
  pending: { label: "Pending", tone: TONE.neutral, dot: "bg-crm-subtle" },
};

export const OUTCOME_LABEL: Record<DeliveryOutcome, string> = {
  succeeded: OUTCOME.succeeded.label,
  retrying: OUTCOME.retrying.label,
  failed: OUTCOME.failed.label,
  pending: OUTCOME.pending.label,
};

export function OutcomeChip({
  outcome,
  className,
}: {
  outcome: DeliveryOutcome;
  className?: string;
}) {
  const o = OUTCOME[outcome];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-px text-[11px] font-medium",
        o.tone,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", o.dot)} />
      {o.label}
    </span>
  );
}
