import * as React from "react";
import { ExternalLink, Mail, MapPin, Phone, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Progress } from "@/components/crm/progress";
import { Stepper } from "@/components/crm/stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/crm/tabs";
import { Tag, type TagColor } from "@/components/crm/tag";
import { Textarea } from "@/components/crm/textarea";

export type Recommendation = "strong-yes" | "yes" | "no" | "strong-no";

export interface Scorecard {
  id: string;
  interviewer: string;
  round: string;
  /** ISO date submitted. */
  submittedAt: string;
  recommendation: Recommendation;
  /** Competency → 1..4 score. */
  scores: Record<string, number>;
  notes?: string;
}

export interface CandidateNote {
  id: string;
  author: string;
  /** ISO date-time. */
  at: string;
  text: string;
}

export interface AtsCandidateRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location: string;
  currentTitle: string;
  currentCompany: string;
  linkedin?: string;
  job: string;
  stages: string[];
  stageIndex: number;
  /** Expected annual base salary. */
  expectedSalary?: number;
  /** Budgeted band for the role. */
  band?: { min: number; max: number };
  noticeDays?: number;
  skills: string[];
  scorecards: Scorecard[];
  notes: CandidateNote[];
  status: "active" | "rejected" | "hired";
  /** Interviewers still to submit feedback. */
  pendingFeedback?: string[];
}

export interface AtsCandidateProps {
  candidate: AtsCandidateRecord;
  onCandidateChange: (candidate: AtsCandidateRecord) => void;
  /** Author name for new notes. */
  currentUser: string;
  currency?: string;
  now?: Date;
  className?: string;
}

const recMeta: Record<Recommendation, { label: string; color: TagColor; weight: number }> = {
  "strong-yes": { label: "Strong yes", color: "green", weight: 2 },
  yes: { label: "Yes", color: "moss", weight: 1 },
  no: { label: "No", color: "orange", weight: -1 },
  "strong-no": { label: "Strong no", color: "red", weight: -2 },
};

/** Averages each competency across scorecards and nets recommendations into a hire signal. */
export function summarizeScorecards(cards: Scorecard[]) {
  const sums = new Map<string, { total: number; n: number }>();
  cards.forEach((c) =>
    Object.entries(c.scores).forEach(([k, v]) => {
      const cur = sums.get(k) ?? { total: 0, n: 0 };
      sums.set(k, { total: cur.total + v, n: cur.n + 1 });
    }),
  );
  const competencies = [...sums].map(([name, { total, n }]) => ({ name, avg: total / n }));
  const signal = cards.reduce((s, c) => s + recMeta[c.recommendation].weight, 0);
  const tally = (Object.keys(recMeta) as Recommendation[]).map((r) => ({
    rec: r,
    count: cards.filter((c) => c.recommendation === r).length,
  }));
  return { competencies, signal, tally };
}

/** Candidate record: profile, stage stepper, comp vs band check, scorecard roll-up, notes and advance/reject/hire actions. */
export function AtsCandidate({
  candidate: c,
  onCandidateChange,
  currentUser,
  currency = "USD",
  now: nowProp,
  className,
}: AtsCandidateProps) {
  const now = nowProp ?? new Date();
  const [note, setNote] = React.useState("");
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const { competencies, signal, tally } = summarizeScorecards(c.scorecards);
  const last = c.stageIndex >= c.stages.length - 1;
  const bandPos =
    c.band && c.expectedSalary !== undefined
      ? c.expectedSalary > c.band.max
        ? "above"
        : c.expectedSalary < c.band.min
          ? "below"
          : "within"
      : null;

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    onCandidateChange({
      ...c,
      notes: [
        { id: `n${now.getTime()}`, author: currentUser, at: now.toISOString(), text: note.trim() },
        ...c.notes,
      ],
    });
    setNote("");
  };

  return (
    <article
      aria-label={`Candidate ${c.name}`}
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-start gap-4 border-b border-crm-border p-4">
        <Avatar name={c.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-crm-fg">{c.name}</h2>
            <Tag
              size="sm"
              color={c.status === "hired" ? "green" : c.status === "rejected" ? "red" : "blue"}
            >
              {c.status === "hired"
                ? "Hired"
                : c.status === "rejected"
                  ? "Rejected"
                  : c.stages[c.stageIndex]}
            </Tag>
          </div>
          <p className="text-sm text-crm-soft">
            {c.currentTitle} at {c.currentCompany} · applying for {c.job}
          </p>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-crm-subtle [&_svg]:size-3.5">
            <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-crm-fg">
              <Mail aria-hidden /> {c.email}
            </a>
            {c.phone ? (
              <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-crm-fg">
                <Phone aria-hidden /> {c.phone}
              </a>
            ) : null}
            <span className="flex items-center gap-1">
              <MapPin aria-hidden /> {c.location}
            </span>
            {c.linkedin ? (
              <a
                href={c.linkedin}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-crm-fg"
              >
                <ExternalLink aria-hidden /> LinkedIn
              </a>
            ) : null}
          </p>
        </div>
        {c.status === "active" ? (
          <div className="flex gap-1.5">
            <Button
              variant="danger"
              onClick={() => onCandidateChange({ ...c, status: "rejected" })}
            >
              Reject
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                onCandidateChange(
                  last ? { ...c, status: "hired" } : { ...c, stageIndex: c.stageIndex + 1 },
                )
              }
            >
              {last ? "Mark hired" : `Move to ${c.stages[c.stageIndex + 1]}`}
            </Button>
          </div>
        ) : (
          <Button onClick={() => onCandidateChange({ ...c, status: "active" })}>Reopen</Button>
        )}
      </header>
      <div className="overflow-x-auto border-b border-crm-border px-4 py-3">
        <Stepper
          steps={c.stages.map((title) => ({ title }))}
          current={c.status === "hired" ? c.stages.length : c.stageIndex}
          onStepClick={
            c.status === "active" ? (i) => onCandidateChange({ ...c, stageIndex: i }) : undefined
          }
          className="min-w-[560px]"
        />
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scorecards">Scorecards ({c.scorecards.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({c.notes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="grid gap-4 p-4 md:grid-cols-2">
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-xs text-crm-subtle">Expected base</dt>
              <dd className="flex items-center gap-2 text-crm-fg tabular-nums">
                {c.expectedSalary !== undefined ? money.format(c.expectedSalary) : "—"}
                {bandPos ? (
                  <Tag
                    size="sm"
                    color={bandPos === "within" ? "green" : bandPos === "above" ? "red" : "blue"}
                  >
                    {bandPos === "within"
                      ? "Within band"
                      : bandPos === "above"
                        ? "Above band"
                        : "Below band"}
                  </Tag>
                ) : null}
              </dd>
              {c.band ? (
                <dd className="text-xs text-crm-subtle tabular-nums">
                  Band {money.format(c.band.min)} – {money.format(c.band.max)}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-xs text-crm-subtle">Notice period</dt>
              <dd className="text-crm-fg">
                {c.noticeDays !== undefined
                  ? `${c.noticeDays} days · earliest start ${new Date(+now + c.noticeDays * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-xs text-crm-subtle">Skills</dt>
              <dd className="flex flex-wrap gap-1">
                {c.skills.map((s) => (
                  <Tag key={s} size="sm">
                    {s}
                  </Tag>
                ))}
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-raised p-3">
            <p className="flex items-center justify-between text-sm text-crm-fg">
              Hiring signal
              <span
                className={cn(
                  "flex items-center gap-1 tabular-nums",
                  signal > 0
                    ? "text-crm-success"
                    : signal < 0
                      ? "text-crm-danger"
                      : "text-crm-soft",
                )}
              >
                {signal >= 0 ? (
                  <ThumbsUp className="size-3.5" aria-hidden />
                ) : (
                  <ThumbsDown className="size-3.5" aria-hidden />
                )}
                {signal > 0 ? `+${signal}` : signal}
              </span>
            </p>
            <div className="flex flex-wrap gap-1">
              {tally
                .filter((t) => t.count)
                .map((t) => (
                  <Tag key={t.rec} size="sm" color={recMeta[t.rec].color}>
                    {t.count} × {recMeta[t.rec].label}
                  </Tag>
                ))}
            </div>
            {competencies.map((k) => (
              <Progress
                key={k.name}
                value={k.avg}
                max={4}
                size="sm"
                tone={k.avg >= 3 ? "success" : k.avg >= 2.5 ? "warning" : "danger"}
                label={`${k.name} · ${k.avg.toFixed(1)}/4`}
              />
            ))}
            {!c.scorecards.length ? (
              <p className="text-xs text-crm-subtle">No scorecards yet.</p>
            ) : null}
            {c.pendingFeedback?.length ? (
              <p className="text-xs text-crm-warning">Waiting on: {c.pendingFeedback.join(", ")}</p>
            ) : null}
          </div>
        </TabsContent>
        <TabsContent value="scorecards" className="flex flex-col gap-2 p-4">
          {c.scorecards.length ? (
            c.scorecards.map((s) => (
              <section
                key={s.id}
                className="rounded-crm border border-crm-border bg-crm-raised p-3"
              >
                <header className="flex flex-wrap items-center gap-2">
                  <Avatar name={s.interviewer} size="sm" />
                  <span className="text-sm text-crm-fg">{s.interviewer}</span>
                  <span className="text-xs text-crm-subtle">
                    {s.round} ·{" "}
                    {new Date(s.submittedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <Tag size="sm" color={recMeta[s.recommendation].color} className="ml-auto">
                    {recMeta[s.recommendation].label}
                  </Tag>
                </header>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                  {Object.entries(s.scores).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-crm-subtle">{k}</dt>
                      <dd className="text-crm-fg tabular-nums">{v}/4</dd>
                    </div>
                  ))}
                </dl>
                {s.notes ? <p className="mt-2 text-xs text-crm-soft">{s.notes}</p> : null}
              </section>
            ))
          ) : (
            <p className="p-6 text-center text-sm text-crm-subtle">No scorecards submitted.</p>
          )}
        </TabsContent>
        <TabsContent value="notes" className="flex flex-col gap-3 p-4">
          <form onSubmit={addNote} className="flex flex-col gap-2">
            <Textarea
              aria-label="Add a note"
              placeholder="Share context with the hiring team…"
              value={note}
              maxLength={1000}
              showCount
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              className="self-end"
              disabled={!note.trim()}
            >
              Add note
            </Button>
          </form>
          <ul className="flex flex-col gap-2">
            {c.notes.map((n) => (
              <li key={n.id} className="flex gap-2">
                <Avatar name={n.author} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs text-crm-subtle">
                    <span className="text-crm-fg">{n.author}</span> ·{" "}
                    {new Date(n.at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-sm whitespace-pre-wrap text-crm-soft">{n.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </article>
  );
}
