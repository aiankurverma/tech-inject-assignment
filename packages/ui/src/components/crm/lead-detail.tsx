import * as React from "react";
import { ArrowRightLeft, CheckCircle2, Circle, Mail, Phone, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Tag } from "@/components/crm/tag";
import { Progress } from "@/components/crm/progress";
import { ActivityTimeline, type Activity } from "@/components/crm/activity-timeline";

export interface LeadSignals {
  /** Company headcount. */
  employees?: number;
  industryMatch?: boolean;
  /** Seniority of the contact. */
  seniority?: "IC" | "Manager" | "Director" | "VP" | "C-level";
  pricingPageViews?: number;
  demoRequested?: boolean;
  emailOpens?: number;
  webinarAttended?: boolean;
}

export interface LeadRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  title?: string;
  source: string;
  owner?: string;
  status: "new" | "working" | "qualified" | "disqualified" | "converted";
  signals: LeadSignals;
  /** BANT answers captured during discovery. */
  qualification?: Partial<Record<"budget" | "authority" | "need" | "timeline", string>>;
  activities?: Activity[];
}

export interface ConvertPayload {
  dealName: string;
  amount: number;
  closeDate: string;
  createCompany: boolean;
}

export interface LeadDetailProps {
  lead: LeadRecord;
  currency?: string;
  onConvert?: (lead: LeadRecord, deal: ConvertPayload) => void;
  onDisqualify?: (lead: LeadRecord, reason: string) => void;
  onQualificationChange?: (q: LeadRecord["qualification"]) => void;
  className?: string;
}

const seniorityPts = { IC: 2, Manager: 6, Director: 10, VP: 13, "C-level": 15 } as const;

/** Splits a lead score into fit (who they are, max 50) and intent (what they did, max 50). */
export function scoreLead(s: LeadSignals) {
  const size = s.employees ?? 0;
  const fitParts = [
    {
      label: "Company size",
      pts: size >= 1000 ? 20 : size >= 200 ? 15 : size >= 50 ? 8 : size > 0 ? 3 : 0,
      max: 20,
    },
    { label: "Industry match", pts: s.industryMatch ? 15 : 0, max: 15 },
    { label: "Seniority", pts: s.seniority ? seniorityPts[s.seniority] : 0, max: 15 },
  ];
  const intentParts = [
    { label: "Demo requested", pts: s.demoRequested ? 20 : 0, max: 20 },
    { label: "Pricing page views", pts: Math.min(15, (s.pricingPageViews ?? 0) * 5), max: 15 },
    { label: "Email engagement", pts: Math.min(10, (s.emailOpens ?? 0) * 2), max: 10 },
    { label: "Webinar", pts: s.webinarAttended ? 5 : 0, max: 5 },
  ];
  const fit = fitParts.reduce((a, p) => a + p.pts, 0);
  const intent = intentParts.reduce((a, p) => a + p.pts, 0);
  return { fit, intent, total: fit + intent, fitParts, intentParts };
}

const bant = [
  { key: "budget", label: "Budget", hint: "Approved spend or range" },
  { key: "authority", label: "Authority", hint: "Who signs?" },
  { key: "need", label: "Need", hint: "Pain in their words" },
  { key: "timeline", label: "Timeline", hint: "When must it be live?" },
] as const;

const inputCls =
  "h-8 w-full rounded-crm border border-crm-border bg-crm-raised px-2 text-sm text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:ring-2 focus-visible:ring-crm-ring/60 aria-[invalid=true]:border-crm-danger";

function Part({ p }: { p: { label: string; pts: number; max: number } }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {p.pts > 0 ? (
        <CheckCircle2 className="size-3.5 text-crm-success" aria-hidden />
      ) : (
        <Circle className="size-3.5 text-crm-subtle" aria-hidden />
      )}
      <span className="flex-1 text-crm-soft">{p.label}</span>
      <span className="tabular-nums">
        {p.pts}/{p.max}
      </span>
    </li>
  );
}

/**
 * Lead record: fit/intent score breakdown, BANT qualification checklist, and a validated
 * convert-to-deal form (name, amount, future close date) plus disqualify with reason.
 */
export function LeadDetail({
  lead,
  currency = "USD",
  onConvert,
  onDisqualify,
  onQualificationChange,
  className,
}: LeadDetailProps) {
  const score = scoreLead(lead.signals);
  const [q, setQ] = React.useState(lead.qualification ?? {});
  const [status, setStatus] = React.useState(lead.status);
  const [mode, setMode] = React.useState<null | "convert" | "disqualify">(null);
  const [form, setForm] = React.useState({
    dealName: `${lead.company} – New business`,
    amount: "",
    closeDate: "",
    createCompany: true,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [reason, setReason] = React.useState("");
  const answered = bant.filter((b) => (q[b.key] ?? "").trim()).length;
  const grade = score.total >= 75 ? "A" : score.total >= 55 ? "B" : score.total >= 35 ? "C" : "D";
  const done = status === "converted" || status === "disqualified";

  const setAnswer = (k: (typeof bant)[number]["key"], v: string) => {
    const next = { ...q, [k]: v };
    setQ(next);
    onQualificationChange?.(next);
  };

  const convert = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const amount = Number(form.amount.replace(/[, ]/g, ""));
    if (!form.dealName.trim()) errs.dealName = "Deal name is required";
    if (!form.amount || !Number.isFinite(amount) || amount <= 0)
      errs.amount = "Enter an amount above 0";
    const today = new Date().toISOString().slice(0, 10);
    if (!form.closeDate) errs.closeDate = "Pick an expected close date";
    else if (form.closeDate < today) errs.closeDate = "Close date can't be in the past";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onConvert?.(lead, {
      dealName: form.dealName.trim(),
      amount,
      closeDate: form.closeDate,
      createCompany: form.createCompany,
    });
    setStatus("converted");
    setMode(null);
  };

  return (
    <article className={cn("flex min-w-0 flex-col gap-4 font-crm text-crm-fg", className)}>
      <header className="flex flex-wrap items-center gap-3">
        <Avatar name={lead.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-medium">{lead.name}</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-crm-soft">
            <span>{[lead.title, lead.company].filter(Boolean).join(" · ")}</span>
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1 hover:text-crm-fg"
            >
              <Mail className="size-3" aria-hidden /> {lead.email}
            </a>
            {lead.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" aria-hidden /> {lead.phone}
              </span>
            ) : null}
            <span>Source: {lead.source}</span>
          </p>
        </div>
        <Tag
          color={
            status === "converted"
              ? "green"
              : status === "disqualified"
                ? "red"
                : status === "qualified"
                  ? "purple"
                  : "blue"
          }
          className="capitalize"
        >
          {status}
        </Tag>
        {!done ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMode(mode === "disqualify" ? null : "disqualify")}
            >
              <XCircle className="size-3.5" aria-hidden /> Disqualify
            </Button>
            <Button size="sm" onClick={() => setMode(mode === "convert" ? null : "convert")}>
              <ArrowRightLeft className="size-3.5" aria-hidden /> Convert
            </Button>
          </div>
        ) : null}
      </header>

      {mode === "convert" ? (
        <form
          noValidate
          onSubmit={convert}
          aria-label="Convert lead to deal"
          className="grid gap-3 rounded-crm border border-crm-border bg-crm-card p-4 sm:grid-cols-3"
        >
          <label className="flex flex-col gap-1 text-xs text-crm-soft sm:col-span-3">
            Deal name
            <input
              className={inputCls}
              value={form.dealName}
              aria-invalid={!!errors.dealName}
              onChange={(e) => setForm({ ...form, dealName: e.target.value })}
            />
            {errors.dealName ? <span className="text-crm-danger">{errors.dealName}</span> : null}
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Amount ({currency})
            <input
              className={cn(inputCls, "tabular-nums")}
              inputMode="decimal"
              placeholder="25,000"
              value={form.amount}
              aria-invalid={!!errors.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            {errors.amount ? <span className="text-crm-danger">{errors.amount}</span> : null}
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Expected close
            <input
              type="date"
              className={inputCls}
              value={form.closeDate}
              aria-invalid={!!errors.closeDate}
              onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
            />
            {errors.closeDate ? <span className="text-crm-danger">{errors.closeDate}</span> : null}
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-xs text-crm-soft">
            <input
              type="checkbox"
              checked={form.createCompany}
              onChange={(e) => setForm({ ...form, createCompany: e.target.checked })}
              className="accent-crm-primary"
            />
            Create company “{lead.company}”
          </label>
          {answered < 3 ? (
            <p role="note" className="text-xs text-crm-warning sm:col-span-2">
              Only {answered}/4 BANT answers captured — reps convert best with at least 3.
            </p>
          ) : (
            <span className="sm:col-span-2" />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Create deal
            </Button>
          </div>
        </form>
      ) : null}

      {mode === "disqualify" ? (
        <form
          aria-label="Disqualify lead"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return;
            onDisqualify?.(lead, reason);
            setStatus("disqualified");
            setMode(null);
          }}
          className="flex flex-wrap items-end gap-2 rounded-crm border border-crm-border bg-crm-card p-3"
        >
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Reason
            <select
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-8 rounded-crm border border-crm-border bg-crm-raised px-2 text-sm text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <option value="">Choose…</option>
              <option>Not a fit (size/industry)</option>
              <option>No budget</option>
              <option>Student / job seeker</option>
              <option>Competitor</option>
              <option>Unresponsive</option>
              <option>Duplicate</option>
            </select>
          </label>
          <Button type="submit" size="sm" variant="danger" disabled={!reason}>
            Disqualify
          </Button>
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section
          aria-label="Lead score"
          className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="crm-eyebrow text-crm-subtle">Lead score</h2>
            <p className="text-2xl tabular-nums">
              {score.total}
              <span className="ml-1 text-sm text-crm-subtle">/100 · {grade}</span>
            </p>
          </div>
          <Progress
            value={score.fit}
            max={50}
            label={`Fit ${score.fit}/50`}
            tone="primary"
            size="sm"
          />
          <ul className="flex flex-col gap-1">
            {score.fitParts.map((p) => (
              <Part key={p.label} p={p} />
            ))}
          </ul>
          <Progress
            value={score.intent}
            max={50}
            label={`Intent ${score.intent}/50`}
            tone="success"
            size="sm"
          />
          <ul className="flex flex-col gap-1">
            {score.intentParts.map((p) => (
              <Part key={p.label} p={p} />
            ))}
          </ul>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section
            aria-label="Qualification"
            className="rounded-crm border border-crm-border bg-crm-bg p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="crm-eyebrow text-crm-subtle">BANT qualification</h2>
              <span className="text-xs text-crm-soft tabular-nums">{answered}/4</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {bant.map((b) => (
                <label key={b.key} className="flex flex-col gap-1 text-xs text-crm-soft">
                  <span className="flex items-center gap-1.5">
                    {(q[b.key] ?? "").trim() ? (
                      <CheckCircle2 className="size-3 text-crm-success" aria-hidden />
                    ) : (
                      <Circle className="size-3" aria-hidden />
                    )}
                    {b.label}
                  </span>
                  <input
                    className={inputCls}
                    placeholder={b.hint}
                    value={q[b.key] ?? ""}
                    disabled={done}
                    onChange={(e) => setAnswer(b.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
          <section
            aria-label="Activity"
            className="rounded-crm border border-crm-border bg-crm-bg p-4"
          >
            <h2 className="crm-eyebrow mb-3 text-crm-subtle">Activity</h2>
            {lead.activities?.length ? (
              <ActivityTimeline items={lead.activities} />
            ) : (
              <p className="py-4 text-center text-xs text-crm-subtle">
                No touches yet — this lead is waiting on you.
              </p>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
