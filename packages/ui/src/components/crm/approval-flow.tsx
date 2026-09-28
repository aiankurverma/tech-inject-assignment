import * as React from "react";
import { Check, Clock, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/crm/button";
import { Textarea } from "@/components/crm/textarea";
import { cn } from "@/lib/utils";

export interface ApprovalRule {
  id: string;
  /** Approver role, e.g. "Sales Manager". */
  role: string;
  approver: string;
  /** Required when discount % is at least this. */
  minDiscountPct?: number;
  /** Required when deal amount is at least this. */
  minAmount?: number;
  /** Hours the approver has before the step breaches SLA. */
  slaHours: number;
}

export type ApprovalDecision = "pending" | "approved" | "rejected";

export interface ApprovalRecord {
  ruleId: string;
  decision: ApprovalDecision;
  comment?: string;
  /** ISO time the decision was made. */
  decidedAt?: string;
}

export interface ApprovalRequest {
  dealName: string;
  amount: number;
  currency?: string;
  discountPct: number;
  requestedBy: string;
  /** ISO time the request was submitted (step 1 SLA starts here). */
  submittedAt: string;
  justification?: string;
}

export interface ApprovalFlowProps {
  request: ApprovalRequest;
  rules: ApprovalRule[];
  records: ApprovalRecord[];
  /** Name of the viewer; they can act only on the current step when it's theirs. */
  currentUser: string;
  onDecision?: (ruleId: string, decision: "approved" | "rejected", comment: string) => void;
  /** Override "now" (useful for tests / SSR). */
  now?: Date;
  className?: string;
}

/** Rules that apply to a request, in chain order (ascending thresholds as given). */
export function requiredApprovers(req: ApprovalRequest, rules: ApprovalRule[]) {
  return rules.filter(
    (r) =>
      (r.minDiscountPct !== undefined && req.discountPct >= r.minDiscountPct) ||
      (r.minAmount !== undefined && req.amount >= r.minAmount),
  );
}

function hoursLeft(start: string, slaHours: number, now: Date) {
  return slaHours - (now.getTime() - new Date(start).getTime()) / 3_600_000;
}
function fmtHours(h: number) {
  const a = Math.abs(h);
  const s =
    a >= 24 ? `${Math.floor(a / 24)}d ${Math.round(a % 24)}h` : `${Math.max(1, Math.round(a))}h`;
  return h < 0 ? `${s} overdue` : `${s} left`;
}

/** Sequential discount / deal-desk approval chain derived from threshold rules, with SLA timers. */
export function ApprovalFlow({
  request,
  rules,
  records,
  currentUser,
  onDecision,
  now: nowProp,
  className,
}: ApprovalFlowProps) {
  const [tick, setTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (nowProp) return;
    const t = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [nowProp]);
  const now = nowProp ?? new Date(tick);
  const [comment, setComment] = React.useState("");
  const cid = React.useId();
  const [err, setErr] = React.useState<string | null>(null);

  const chain = requiredApprovers(request, rules);
  const recFor = (id: string) => records.find((r) => r.ruleId === id);
  const rejected = chain.find((r) => recFor(r.id)?.decision === "rejected");
  const currentIdx = rejected
    ? -1
    : chain.findIndex((r) => (recFor(r.id)?.decision ?? "pending") === "pending");
  const overall: "auto" | "approved" | "rejected" | "pending" =
    chain.length === 0
      ? "auto"
      : rejected
        ? "rejected"
        : currentIdx === -1
          ? "approved"
          : "pending";
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: request.currency ?? "USD",
    maximumFractionDigits: 0,
  });
  const net = request.amount * (1 - request.discountPct / 100);
  const current = currentIdx >= 0 ? chain[currentIdx] : undefined;
  const canAct = !!current && current.approver === currentUser && !!onDecision;

  const decide = (d: "approved" | "rejected") => {
    if (!current) return;
    if (d === "rejected" && !comment.trim()) {
      setErr("Add a reason so the rep knows what to change.");
      return;
    }
    setErr(null);
    onDecision?.(current.id, d, comment.trim());
    setComment("");
  };

  const statusTone = {
    auto: "border-tag-green-border bg-tag-green-bg text-tag-green-text",
    approved: "border-tag-green-border bg-tag-green-bg text-tag-green-text",
    rejected: "border-tag-red-border bg-tag-red-bg text-tag-red-text",
    pending: "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text",
  }[overall];
  const statusLabel = {
    auto: "Auto-approved",
    approved: "Approved",
    rejected: "Rejected",
    pending: `Waiting on ${current?.role ?? ""}`,
  }[overall];

  return (
    <section
      aria-label={`Approval for ${request.dealName}`}
      className={cn(
        "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="crm-eyebrow text-crm-subtle">Discount approval</span>
          <h3 className="truncate text-sm font-medium text-crm-fg">{request.dealName}</h3>
          <span className="text-xs text-crm-soft">Requested by {request.requestedBy}</span>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", statusTone)}>
          {statusLabel}
        </span>
      </header>

      <dl className="grid grid-cols-3 gap-2 rounded-crm bg-crm-raised p-3 shadow-crm-raised">
        {[
          ["List", money.format(request.amount)],
          ["Discount", `${request.discountPct}%`],
          ["Net", money.format(net)],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1">
            <dt className="text-xs text-crm-subtle">{k}</dt>
            <dd className="text-sm font-medium text-crm-fg tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {request.justification ? (
        <p className="border-l-2 border-crm-border pl-3 text-xs text-crm-soft">
          {request.justification}
        </p>
      ) : null}

      {chain.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-crm-soft">
          <ShieldCheck className="size-4 text-crm-success" aria-hidden />
          Within rep authority. No approval needed.
        </p>
      ) : (
        <ol className="flex flex-col" aria-label="Approval chain">
          {chain.map((r, i) => {
            const rec = recFor(r.id);
            const decision = rec?.decision ?? "pending";
            const isCurrent = i === currentIdx;
            const blocked = !isCurrent && decision === "pending";
            const prev = chain[i - 1];
            const startedAt =
              i === 0 ? request.submittedAt : prev ? recFor(prev.id)?.decidedAt : undefined;
            const left = isCurrent && startedAt ? hoursLeft(startedAt, r.slaHours, now) : null;
            const reason = [
              r.minDiscountPct !== undefined && request.discountPct >= r.minDiscountPct
                ? `discount ≥ ${r.minDiscountPct}%`
                : null,
              r.minAmount !== undefined && request.amount >= r.minAmount
                ? `amount ≥ ${money.format(r.minAmount)}`
                : null,
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <li
                key={r.id}
                aria-current={isCurrent ? "step" : undefined}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                {i < chain.length - 1 ? (
                  <span aria-hidden className="absolute top-7 bottom-0 left-3 w-px bg-crm-border" />
                ) : null}
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-xs",
                    decision === "approved" && "bg-crm-success/20 text-crm-success",
                    decision === "rejected" && "bg-crm-danger/20 text-crm-danger",
                    isCurrent && "bg-crm-raised text-crm-fg ring-2 ring-crm-warning",
                    blocked && "bg-crm-muted text-crm-subtle",
                  )}
                >
                  {decision === "approved" ? (
                    <Check className="size-3.5" aria-label="Approved" />
                  ) : decision === "rejected" ? (
                    <X className="size-3.5" aria-label="Rejected" />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-crm-fg">{r.approver}</span>
                    <span className="text-xs text-crm-subtle">{r.role}</span>
                    {left !== null ? (
                      <span
                        className={cn(
                          "ml-auto inline-flex items-center gap-1 text-xs tabular-nums",
                          left < 0
                            ? "text-crm-danger"
                            : left < r.slaHours * 0.25
                              ? "text-crm-warning"
                              : "text-crm-soft",
                        )}
                      >
                        <Clock className="size-3" aria-hidden />
                        {fmtHours(left)}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-crm-subtle">Required because {reason}</span>
                  {rec?.comment ? (
                    <p className="rounded-crm bg-crm-raised px-2.5 py-1.5 text-xs text-crm-soft">
                      “{rec.comment}”
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {canAct ? (
        <div className="flex flex-col gap-2 border-t border-crm-border pt-3">
          <label htmlFor={cid} className="text-xs text-crm-soft">
            Your decision as {current?.role}
          </label>
          <Textarea
            id={cid}
            rows={2}
            placeholder="Comment (required to reject)"
            value={comment}
            invalid={!!err}
            onChange={(e) => setComment(e.target.value)}
            aria-describedby={err ? `${cid}-err` : undefined}
          />
          {err ? (
            <p id={`${cid}-err`} role="alert" className="text-xs text-crm-danger">
              {err}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="danger" onClick={() => decide("rejected")}>
              Reject
            </Button>
            <Button variant="primary" onClick={() => decide("approved")}>
              Approve
            </Button>
          </div>
        </div>
      ) : current ? (
        <p className="border-t border-crm-border pt-3 text-xs text-crm-subtle">
          Only {current.approver} can act on this step.
        </p>
      ) : null}
    </section>
  );
}
