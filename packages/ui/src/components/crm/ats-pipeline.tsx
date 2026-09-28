import * as React from "react";
import { Hourglass, Star, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { CountBadge } from "@/components/crm/badge";
import { SearchInput } from "@/components/crm/search-input";
import { Tag, type TagColor } from "@/components/crm/tag";

export interface AtsStage {
  id: string;
  title: string;
  /** Days a candidate may sit in this stage before being flagged. */
  slaDays?: number;
}

export interface AtsCandidateCard {
  id: string;
  name: string;
  currentTitle: string;
  stageId: string;
  /** ISO date-time the candidate entered the current stage. */
  enteredStageAt: string;
  source: "LinkedIn" | "Referral" | "Careers page" | "Agency" | "Sourced";
  /** Average scorecard rating 1-4. */
  rating?: number;
  rejected?: { reason: string };
}

export interface AtsPipelineProps {
  job: { title: string; department: string; openings: number };
  stages: AtsStage[];
  candidates: AtsCandidateCard[];
  onCandidatesChange: (candidates: AtsCandidateCard[]) => void;
  onOpen?: (candidate: AtsCandidateCard) => void;
  rejectReasons?: string[];
  now?: Date;
  className?: string;
}

const DRAG = "application/x-kitbase-candidate";
const sourceColor: Record<AtsCandidateCard["source"], TagColor> = {
  LinkedIn: "blue",
  Referral: "green",
  "Careers page": "teal",
  Agency: "orange",
  Sourced: "purple",
};

/** Recruiting pipeline for one job: stage columns with drag-and-drop and keyboard moves, SLA flags, conversion rates and rejection with reasons. */
export function AtsPipeline({
  job,
  stages,
  candidates,
  onCandidatesChange,
  onOpen,
  rejectReasons = [
    "Not enough experience",
    "Compensation mismatch",
    "Failed technical",
    "Withdrew",
    "Position filled",
  ],
  now: nowProp,
  className,
}: AtsPipelineProps) {
  const now = nowProp ?? new Date();
  const [q, setQ] = React.useState("");
  const [showRejected, setShowRejected] = React.useState(false);
  const [over, setOver] = React.useState<string | null>(null);
  const [rejecting, setRejecting] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState("");

  const daysIn = (c: AtsCandidateCard) =>
    Math.floor((+now - +new Date(c.enteredStageAt)) / 86_400_000);
  const active = candidates.filter((c) => !c.rejected);
  const matches = (c: AtsCandidateCard) =>
    !q.trim() || `${c.name} ${c.currentTitle}`.toLowerCase().includes(q.trim().toLowerCase());
  const stageIndex = (id: string) => stages.findIndex((s) => s.id === id);
  const reached = (i: number) => active.filter((c) => stageIndex(c.stageId) >= i).length;
  const hired = stages.length ? reached(stages.length - 1) : 0;

  const move = (id: string, stageId: string) => {
    const c = candidates.find((x) => x.id === id);
    if (!c || c.stageId === stageId) return;
    onCandidatesChange(
      candidates.map((x) =>
        x.id === id ? { ...x, stageId, enteredStageAt: now.toISOString() } : x,
      ),
    );
    setAnnounce(`${c.name} moved to ${stages.find((s) => s.id === stageId)?.title ?? stageId}`);
  };
  const reject = (id: string, reason: string) => {
    onCandidatesChange(candidates.map((x) => (x.id === id ? { ...x, rejected: { reason } } : x)));
    setRejecting(null);
    setAnnounce(`Candidate rejected: ${reason}`);
  };

  return (
    <section
      aria-label={`${job.title} pipeline`}
      className={cn("flex flex-col gap-3 font-crm", className)}
    >
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-subtle">{job.department}</p>
          <h2 className="text-lg font-semibold text-crm-fg">{job.title}</h2>
          <p className="text-xs text-crm-soft">
            {active.length} active · {hired}/{job.openings} hired ·{" "}
            {candidates.length - active.length} rejected
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            size="sm"
            value={q}
            onValueChange={setQ}
            placeholder="Candidate or title"
            className="w-52"
          />
          <label className="flex items-center gap-1.5 text-xs text-crm-soft">
            <input
              type="checkbox"
              checked={showRejected}
              onChange={(e) => setShowRejected(e.target.checked)}
              className="accent-crm-primary"
            />
            Show rejected
          </label>
        </div>
      </header>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {stages.map((s, i) => {
          const list = candidates.filter(
            (c) => c.stageId === s.id && (showRejected || !c.rejected) && matches(c),
          );
          const prev = i ? reached(i - 1) : 0;
          const conv = i && prev ? Math.round((reached(i) / prev) * 100) : null;
          return (
            <section
              key={s.id}
              aria-label={s.title}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG)) return;
                e.preventDefault();
                setOver(s.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData(DRAG);
                if (id) move(id, s.id);
              }}
              className={cn(
                "flex max-h-[600px] w-[260px] shrink-0 flex-col rounded-xl border bg-crm-sidebar",
                over === s.id ? "border-crm-primary bg-crm-primary/5" : "border-crm-border",
              )}
            >
              <header className="px-3 pt-3 pb-2">
                <h3 className="flex items-center gap-2 text-sm font-medium text-crm-fg">
                  {s.title} <CountBadge>{list.filter((c) => !c.rejected).length}</CountBadge>
                </h3>
                <p className="mt-1 text-[11px] text-crm-subtle">
                  {conv !== null ? `${conv}% from previous` : "Top of funnel"}
                  {s.slaDays ? ` · SLA ${s.slaDays}d` : ""}
                </p>
              </header>
              <ul className="flex min-h-16 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {list.map((c) => {
                  const d = daysIn(c);
                  const late = !c.rejected && s.slaDays !== undefined && d > s.slaDays;
                  return (
                    <li
                      key={c.id}
                      draggable={!c.rejected}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG, c.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className={cn(
                        "flex flex-col gap-2 rounded-crm border bg-crm-card p-2.5 shadow-crm-raised",
                        c.rejected ? "opacity-50" : "cursor-grab active:cursor-grabbing",
                        late ? "border-crm-warning/60" : "border-crm-border",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onOpen?.(c)}
                        className="flex cursor-pointer items-center gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                      >
                        <Avatar name={c.name} size="md" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-crm-fg">{c.name}</span>
                          <span className="block truncate text-xs text-crm-subtle">
                            {c.currentTitle}
                          </span>
                        </span>
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <Tag size="sm" color={sourceColor[c.source]}>
                          {c.source}
                        </Tag>
                        {c.rating ? (
                          <span className="flex items-center gap-0.5 text-crm-soft tabular-nums">
                            <Star
                              className="size-3 fill-crm-warning text-crm-warning"
                              aria-hidden
                            />
                            {c.rating.toFixed(1)}
                            <span className="sr-only"> of 4</span>
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "ml-auto flex items-center gap-0.5 tabular-nums",
                            late ? "text-crm-warning" : "text-crm-subtle",
                          )}
                        >
                          <Hourglass className="size-3" aria-hidden />
                          {d}d{late ? " · overdue" : ""}
                        </span>
                      </div>
                      {c.rejected ? (
                        <p className="text-[11px] text-crm-danger">Rejected: {c.rejected.reason}</p>
                      ) : rejecting === c.id ? (
                        <div
                          role="group"
                          aria-label="Reject reason"
                          className="flex flex-col gap-1"
                        >
                          {rejectReasons.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => reject(c.id, r)}
                              className="cursor-pointer rounded px-1.5 py-1 text-left text-[11px] text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                            >
                              {r}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setRejecting(null)}
                            className="cursor-pointer text-left text-[11px] text-crm-subtle underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <select
                            aria-label={`Move ${c.name} to stage`}
                            value={c.stageId}
                            onChange={(e) => move(c.id, e.target.value)}
                            className="h-6 min-w-0 flex-1 rounded-full border border-crm-border bg-crm-raised px-1.5 text-[11px] text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                          >
                            {stages.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.title}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            aria-label={`Reject ${c.name}`}
                            onClick={() => setRejecting(c.id)}
                            className="grid size-6 cursor-pointer place-items-center rounded-full text-crm-soft outline-none hover:bg-crm-danger/15 hover:text-crm-danger focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                          >
                            <UserX className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
                {!list.length ? (
                  <li className="grid h-16 place-items-center rounded-crm border border-dashed border-crm-border text-xs text-crm-subtle">
                    No candidates
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
