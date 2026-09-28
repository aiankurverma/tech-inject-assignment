import * as React from "react";
import { AlertTriangle, Check, Clock, KeyRound, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type ShowingStatus = "requested" | "confirmed" | "completed" | "cancelled" | "no-show";

export interface Showing {
  id: string;
  address: string;
  /** ISO date-time. */
  start: string;
  durationMin: number;
  buyer: string;
  agent: string;
  status: ShowingStatus;
  /** Lockbox / access note shown to the agent. */
  access?: string;
  /** 1-5 buyer interest captured after the showing. */
  interest?: number;
  feedback?: string;
}

export interface ReShowingsProps {
  showings: Showing[];
  onShowingsChange: (showings: Showing[]) => void;
  /** Minimum minutes between two showings for the same agent (drive time). */
  travelBufferMin?: number;
  now?: Date;
  className?: string;
}

const statusMeta: Record<ShowingStatus, { label: string; color: TagColor }> = {
  requested: { label: "Requested", color: "amber" },
  confirmed: { label: "Confirmed", color: "blue" },
  completed: { label: "Completed", color: "green" },
  cancelled: { label: "Cancelled", color: "neutral" },
  "no-show": { label: "No-show", color: "red" },
};

const end = (s: Showing) => +new Date(s.start) + s.durationMin * 60_000;

/** Returns showing ids that overlap or leave less than `buffer` minutes for the same agent. */
export function findConflicts(showings: Showing[], bufferMin: number) {
  const out = new Map<string, string>();
  const live = showings
    .filter((s) => s.status === "requested" || s.status === "confirmed")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (!a || !b || a.agent !== b.agent) continue;
      const gap = (+new Date(b.start) - end(a)) / 60_000;
      if (gap < 0) {
        out.set(a.id, `Overlaps ${b.address}`);
        out.set(b.id, `Overlaps ${a.address}`);
      } else if (gap < bufferMin) {
        out.set(b.id, `Only ${Math.round(gap)} min after ${a.address}`);
      }
    }
  }
  return out;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Showing schedule grouped by day with confirm/cancel, conflict + drive-time warnings and post-showing feedback capture. */
export function ReShowings({
  showings,
  onShowingsChange,
  travelBufferMin = 20,
  now: nowProp,
  className,
}: ReShowingsProps) {
  const now = nowProp ?? new Date();
  const [tab, setTab] = React.useState("upcoming");
  const [feedbackFor, setFeedbackFor] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState({ interest: 3, feedback: "" });
  const conflicts = findConflicts(showings, travelBufferMin);
  const patch = (id: string, p: Partial<Showing>) =>
    onShowingsChange(showings.map((s) => (s.id === id ? { ...s, ...p } : s)));

  const isPast = (s: Showing) => end(s) < +now;
  const needsFeedback = showings.filter((s) => isPast(s) && s.status === "confirmed");
  const list = showings
    .filter((s) =>
      tab === "upcoming"
        ? !isPast(s) && s.status !== "cancelled"
        : tab === "feedback"
          ? needsFeedback.includes(s)
          : isPast(s) || s.status === "cancelled",
    )
    .sort((a, b) => (tab === "past" ? -1 : 1) * (+new Date(a.start) - +new Date(b.start)));

  const days = new Map<string, Showing[]>();
  list.forEach((s) => {
    const k = new Date(s.start).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    days.set(k, [...(days.get(k) ?? []), s]);
  });

  const completed = showings.filter((s) => s.status === "completed");
  const avgInterest = completed
    .filter((s) => s.interest)
    .reduce((a, s, _, arr) => a + (s.interest ?? 0) / arr.length, 0);

  return (
    <section
      aria-label="Showings"
      className={cn(
        "flex flex-col rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-crm-fg">Showings</h2>
          <p className="text-xs text-crm-subtle">
            {completed.length} completed · avg interest {avgInterest ? avgInterest.toFixed(1) : "—"}
            /5 · {conflicts.size ? `${conflicts.size} scheduling conflicts` : "no conflicts"}
          </p>
        </div>
        <SegmentedControl
          label="Showing view"
          size="sm"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "feedback", label: "Needs feedback", count: needsFeedback.length },
            { value: "past", label: "Past" },
          ]}
        />
      </header>
      {!list.length ? (
        <p className="p-10 text-center text-sm text-crm-subtle">
          {tab === "feedback" ? "All feedback captured." : "No showings here."}
        </p>
      ) : (
        <ol className="flex flex-col gap-4 p-4">
          {[...days].map(([day, rows]) => (
            <li key={day}>
              <h3 className="crm-eyebrow mb-2 text-crm-subtle">{day}</h3>
              <ul className="flex flex-col gap-2">
                {rows.map((s) => {
                  const warn = conflicts.get(s.id);
                  return (
                    <li
                      key={s.id}
                      className={cn(
                        "flex flex-col gap-2 rounded-crm border bg-crm-raised p-3",
                        warn ? "border-crm-warning/60" : "border-crm-border",
                      )}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="w-16 shrink-0 text-xs text-crm-fg tabular-nums">
                          {fmtTime(s.start)}
                          <span className="block text-crm-subtle">{s.durationMin} min</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm text-crm-fg">
                            <MapPin className="size-3.5 shrink-0 text-crm-subtle" aria-hidden />
                            {s.address}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-crm-soft">
                            <Avatar name={s.agent} size="xs" /> {s.agent} with {s.buyer}
                          </p>
                          {s.access ? (
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-crm-subtle">
                              <KeyRound className="size-3" aria-hidden /> {s.access}
                            </p>
                          ) : null}
                          {warn ? (
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-crm-warning">
                              <AlertTriangle className="size-3" aria-hidden /> {warn}
                            </p>
                          ) : null}
                          {s.feedback ? (
                            <p className="mt-1 text-xs text-crm-soft">
                              “{s.feedback}” · interest {s.interest}/5
                            </p>
                          ) : null}
                        </div>
                        <Tag size="sm" color={statusMeta[s.status].color}>
                          {statusMeta[s.status].label}
                        </Tag>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {s.status === "requested" ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => patch(s.id, { status: "confirmed" })}
                          >
                            <Check /> Confirm
                          </Button>
                        ) : null}
                        {(s.status === "requested" || s.status === "confirmed") && !isPast(s) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => patch(s.id, { status: "cancelled" })}
                          >
                            <X /> Cancel
                          </Button>
                        ) : null}
                        {needsFeedback.includes(s) ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => patch(s.id, { status: "no-show" })}
                            >
                              No-show
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setFeedbackFor(s.id);
                                setDraft({ interest: 3, feedback: "" });
                              }}
                            >
                              <Clock /> Log feedback
                            </Button>
                          </>
                        ) : null}
                      </div>
                      {feedbackFor === s.id ? (
                        <form
                          className="flex flex-col gap-2 border-t border-crm-border pt-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            patch(s.id, {
                              status: "completed",
                              interest: draft.interest,
                              feedback: draft.feedback.trim(),
                            });
                            setFeedbackFor(null);
                          }}
                        >
                          <fieldset className="flex items-center gap-2 text-xs text-crm-soft">
                            <legend className="sr-only">Buyer interest</legend>
                            Interest
                            {[1, 2, 3, 4, 5].map((n) => (
                              <label
                                key={n}
                                className={cn(
                                  "grid size-6 cursor-pointer place-items-center rounded-full border text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-crm-ring/60",
                                  draft.interest === n
                                    ? "border-crm-primary bg-crm-primary text-crm-primary-fg"
                                    : "border-crm-border text-crm-soft",
                                )}
                              >
                                <input
                                  type="radio"
                                  name={`interest-${s.id}`}
                                  className="sr-only"
                                  checked={draft.interest === n}
                                  onChange={() => setDraft({ ...draft, interest: n })}
                                />
                                {n}
                              </label>
                            ))}
                          </fieldset>
                          <textarea
                            aria-label="Buyer feedback"
                            required
                            rows={2}
                            value={draft.feedback}
                            onChange={(e) => setDraft({ ...draft, feedback: e.target.value })}
                            placeholder="Loved the kitchen, worried about street noise…"
                            className="rounded-crm border border-crm-input/60 bg-crm-card px-3 py-2 text-sm text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                          />
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setFeedbackFor(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              size="sm"
                              variant="primary"
                              disabled={!draft.feedback.trim()}
                            >
                              Save feedback
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
