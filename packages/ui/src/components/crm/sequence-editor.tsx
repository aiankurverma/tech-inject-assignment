import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Linkedin,
  Mail,
  Phone,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { Switch } from "@/components/crm/switch";
import { Textarea } from "@/components/crm/textarea";
import { cn } from "@/lib/utils";

export type SequenceChannel = "email" | "call" | "linkedin" | "task";

export interface SequenceStep {
  id: string;
  channel: SequenceChannel;
  /** Days to wait after the previous step (first step: after enrollment). */
  waitDays: number;
  subject?: string;
  body: string;
}

export interface SequenceEditorProps {
  steps?: SequenceStep[];
  defaultSteps?: SequenceStep[];
  onStepsChange?: (steps: SequenceStep[]) => void;
  /** Enrollment date used for the schedule preview. Defaults to today. */
  startDate?: Date;
  /** Skip Saturdays and Sundays when scheduling. */
  businessDaysOnly?: boolean;
  onBusinessDaysOnlyChange?: (v: boolean) => void;
  /** Allowed merge tokens, without braces, e.g. ["first_name", "company"]. */
  tokens?: string[];
  readOnly?: boolean;
  className?: string;
}

const CHANNELS: Record<SequenceChannel, { label: string; icon: LucideIcon }> = {
  email: { label: "Email", icon: Mail },
  call: { label: "Call", icon: Phone },
  linkedin: { label: "LinkedIn", icon: Linkedin },
  task: { label: "Task", icon: CheckSquare },
};
const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;

/** Add `days` to a date, optionally skipping weekends. */
export function addSequenceDays(from: Date, days: number, businessOnly: boolean) {
  const d = new Date(from);
  if (!businessOnly) {
    d.setDate(d.getDate() + days);
    return d;
  }
  let left = days;
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

/** Tokens used in text that aren't in the allowed list. */
export function unknownTokens(text: string, allowed: string[]) {
  const out = new Set<string>();
  for (const m of text.matchAll(TOKEN_RE))
    if (!allowed.includes(m[1]!.toLowerCase())) out.add(m[1]!);
  return [...out];
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
let seq = 0;
const uid = () => `seq_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Multi-channel outreach cadence editor with a business-day schedule preview and merge-token checks. */
export function SequenceEditor({
  steps,
  defaultSteps = [],
  onStepsChange,
  startDate,
  businessDaysOnly,
  onBusinessDaysOnlyChange,
  tokens = ["first_name", "last_name", "company", "title", "sender_name"],
  readOnly,
  className,
}: SequenceEditorProps) {
  const [inner, setInner] = React.useState(defaultSteps);
  const list = steps ?? inner;
  const [bizInner, setBizInner] = React.useState(true);
  const biz = businessDaysOnly ?? bizInner;
  const [activeId, setActiveId] = React.useState<string | undefined>(list[0]?.id);
  const active = list.find((s) => s.id === activeId) ?? list[0];
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const set = (next: SequenceStep[]) => {
    if (steps === undefined) setInner(next);
    onStepsChange?.(next);
  };
  const patch = (id: string, p: Partial<SequenceStep>) =>
    set(list.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set(next);
  };
  const add = (channel: SequenceChannel) => {
    const s: SequenceStep = {
      id: uid(),
      channel,
      waitDays: list.length ? 2 : 0,
      subject: channel === "email" ? "" : undefined,
      body: "",
    };
    set([...list, s]);
    setActiveId(s.id);
  };
  const insertToken = (t: string) => {
    if (!active) return;
    const el = bodyRef.current;
    const token = `{{${t}}}`;
    const start = el?.selectionStart ?? active.body.length;
    const end = el?.selectionEnd ?? active.body.length;
    patch(active.id, { body: active.body.slice(0, start) + token + active.body.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const base = startDate ?? new Date();
  let cursor = base;
  const schedule = list.map((s) => {
    cursor = addSequenceDays(cursor, Math.max(0, s.waitDays || 0), biz);
    return cursor;
  });
  const totalDays = schedule.length
    ? Math.round((schedule[schedule.length - 1]!.getTime() - base.getTime()) / 86_400_000)
    : 0;
  const issues = (s: SequenceStep) => {
    const out: string[] = [];
    if (!s.body.trim()) out.push("Body is empty");
    if (s.channel === "email" && !s.subject?.trim()) out.push("Subject is empty");
    const bad = unknownTokens(`${s.subject ?? ""} ${s.body}`, tokens);
    if (bad.length) out.push(`Unknown token${bad.length > 1 ? "s" : ""}: ${bad.join(", ")}`);
    return out;
  };

  return (
    <div
      className={cn(
        "grid gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm md:grid-cols-[280px_1fr]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="crm-eyebrow text-crm-subtle">Steps</span>
          <span className="text-xs text-crm-soft tabular-nums">
            {list.length} steps · {totalDays} days
          </span>
        </div>
        {list.length === 0 ? (
          <p className="rounded-crm border border-dashed border-crm-border p-4 text-center text-xs text-crm-subtle">
            No steps yet. Add an email or call to start the cadence.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5" aria-label="Sequence steps">
            {list.map((s, i) => {
              const Icon = CHANNELS[s.channel].icon;
              const n = issues(s).length;
              const selected = s.id === active?.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={selected || undefined}
                    onClick={() => setActiveId(s.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-crm px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                      selected ? "bg-crm-raised shadow-crm-raised" : "hover:bg-crm-raised/60",
                    )}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-crm-muted">
                      <Icon className="size-3.5 text-crm-icon" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm text-crm-fg">
                        {i + 1}. {s.subject || CHANNELS[s.channel].label}
                      </span>
                      <span className="text-xs text-crm-subtle">
                        Day +{s.waitDays} · {dateFmt.format(schedule[i]!)}
                      </span>
                    </span>
                    {n ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-crm-warning"
                        aria-label={`${n} issue${n > 1 ? "s" : ""}`}
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {!readOnly ? (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CHANNELS) as SequenceChannel[]).map((c) => (
              <Button key={c} size="sm" onClick={() => add(c)}>
                <Plus /> {CHANNELS[c].label}
              </Button>
            ))}
          </div>
        ) : null}
        <Switch
          size="sm"
          label="Business days only"
          description="Skip weekends when scheduling"
          checked={biz}
          disabled={readOnly}
          onCheckedChange={(v) => {
            if (businessDaysOnly === undefined) setBizInner(v);
            onBusinessDaysOnlyChange?.(v);
          }}
        />
      </div>

      {active ? (
        <div className="flex min-w-0 flex-col gap-3">
          {(() => {
            const i = list.findIndex((s) => s.id === active.id);
            const probs = issues(active);
            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-crm-fg">
                    Step {i + 1} · {CHANNELS[active.channel].label}
                  </span>
                  {!readOnly ? (
                    <div className="ml-auto flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Move step up"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Move step down"
                        disabled={i === list.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete step"
                        onClick={() => {
                          set(list.filter((s) => s.id !== active.id));
                          setActiveId(list[i + 1]?.id ?? list[i - 1]?.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <label className="flex items-center gap-2 text-xs text-crm-soft">
                  Wait
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    className="h-8 w-20"
                    value={active.waitDays}
                    disabled={readOnly}
                    onChange={(e) =>
                      patch(active.id, {
                        waitDays: Math.max(0, Math.min(60, e.target.valueAsNumber || 0)),
                      })
                    }
                  />
                  {biz ? "business days" : "days"} after {i === 0 ? "enrollment" : "previous step"}
                </label>
                {active.channel === "email" ? (
                  <Input
                    aria-label="Subject"
                    placeholder={i === 0 ? "Subject" : "Leave blank to reply in thread"}
                    value={active.subject ?? ""}
                    disabled={readOnly}
                    onChange={(e) => patch(active.id, { subject: e.target.value })}
                  />
                ) : null}
                <Textarea
                  ref={bodyRef}
                  aria-label={active.channel === "email" ? "Email body" : "Instructions"}
                  rows={8}
                  placeholder={
                    active.channel === "call"
                      ? "Talk track: open with {{company}}'s recent hiring..."
                      : "Hi {{first_name}},"
                  }
                  value={active.body}
                  disabled={readOnly}
                  onChange={(e) => patch(active.id, { body: e.target.value })}
                />
                {!readOnly ? (
                  <div className="flex flex-wrap items-center gap-1.5" aria-label="Insert token">
                    <span className="text-xs text-crm-subtle">Insert:</span>
                    {tokens.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => insertToken(t)}
                        className="cursor-pointer rounded-full border border-tag-purple-border bg-tag-purple-bg px-2 py-0.5 font-mono text-[11px] text-tag-purple-text outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                      >
                        {`{{${t}}}`}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div aria-live="polite">
                  {probs.length ? (
                    <ul className="flex flex-col gap-1">
                      {probs.map((p) => (
                        <li key={p} className="text-xs text-crm-warning">
                          {p}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-crm-success">
                      Ready · sends {dateFmt.format(schedule[i]!)}
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="grid place-items-center text-xs text-crm-subtle">Select a step to edit</div>
      )}
    </div>
  );
}
