import * as React from "react";
import { Check, ClipboardCopy, Clock, Gavel, ListChecks, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Textarea } from "@/components/crm/textarea";

export interface MeetingAttendee {
  id: string;
  name: string;
  avatar?: string;
  /** "internal" = your team, "external" = customer side. */
  side: "internal" | "external";
  role?: string;
  attended?: boolean;
}

export interface AgendaItem {
  id: string;
  title: string;
  /** Planned minutes. */
  minutes: number;
  covered?: boolean;
}

export interface ActionItem {
  id: string;
  text: string;
  ownerId?: string;
  /** ISO date. */
  due?: string;
  done?: boolean;
}

export interface MeetingNotesValue {
  attendees: MeetingAttendee[];
  agenda: AgendaItem[];
  notes: string;
  decisions: string[];
  actions: ActionItem[];
}

export interface MeetingNotesProps {
  title: string;
  /** e.g. "Acme Corp · Renewal". */
  related?: string;
  /** ISO datetime when the meeting started (drives the elapsed timer). */
  startedAt?: string;
  value?: MeetingNotesValue;
  defaultValue?: MeetingNotesValue;
  onChange?: (value: MeetingNotesValue) => void;
  /** Called on "Finish & log" with the final notes. */
  onFinish?: (value: MeetingNotesValue) => void;
  readOnly?: boolean;
  className?: string;
}

const EMPTY: MeetingNotesValue = {
  attendees: [],
  agenda: [],
  notes: "",
  decisions: [],
  actions: [],
};
const uid = () => Math.random().toString(36).slice(2, 9);

/** Plain-text recap suitable for pasting into email or a CRM note. */
export function meetingRecap(title: string, v: MeetingNotesValue) {
  const name = (id?: string) => v.attendees.find((a) => a.id === id)?.name ?? "Unassigned";
  return [
    `# ${title}`,
    `Attendees: ${
      v.attendees
        .filter((a) => a.attended !== false)
        .map((a) => a.name)
        .join(", ") || "—"
    }`,
    "",
    "## Notes",
    v.notes.trim() || "—",
    "",
    "## Decisions",
    ...(v.decisions.length ? v.decisions.map((d) => `- ${d}`) : ["—"]),
    "",
    "## Action items",
    ...(v.actions.length
      ? v.actions.map(
          (a) =>
            `- [${a.done ? "x" : " "}] ${a.text} — ${name(a.ownerId)}${a.due ? ` (due ${a.due})` : ""}`,
        )
      : ["—"]),
  ].join("\n");
}

function useElapsed(startedAt?: string) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  return Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Live meeting workspace: attendance, timed agenda, notes, decisions, owned action items and a copyable recap. */
export function MeetingNotes({
  title,
  related,
  startedAt,
  value: valueProp,
  defaultValue = EMPTY,
  onChange,
  onFinish,
  readOnly,
  className,
}: MeetingNotesProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const v = valueProp ?? inner;
  const set = (p: Partial<MeetingNotesValue>) => {
    const next = { ...v, ...p };
    if (valueProp === undefined) setInner(next);
    onChange?.(next);
  };
  const elapsed = useElapsed(startedAt);
  const planned = v.agenda.reduce((s, a) => s + a.minutes, 0);
  const [decision, setDecision] = React.useState("");
  const [action, setAction] = React.useState({ text: "", ownerId: "", due: "" });
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(meetingRecap(title, v));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const overrun = elapsed !== null && planned > 0 && elapsed > planned * 60;
  const small =
    "h-7 rounded-crm border border-crm-border bg-crm-bg px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60";

  return (
    <article
      aria-label={`Meeting notes: ${title}`}
      className={cn(
        "grid gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm text-crm-fg shadow-crm-raised lg:grid-cols-[240px_1fr]",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium">{title}</h2>
          {related ? <p className="text-xs text-crm-soft">{related}</p> : null}
        </div>
        {elapsed !== null ? (
          <span
            role="timer"
            aria-label="Elapsed time"
            className={cn(
              "flex items-center gap-1 rounded-full border border-crm-border px-2 py-0.5 text-xs tabular-nums",
              overrun ? "border-crm-danger/40 text-crm-danger" : "text-crm-soft",
            )}
          >
            <Clock className="size-3" aria-hidden />
            {mmss(elapsed)}
            {planned ? ` / ${planned}:00` : ""}
          </span>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? (
              <Check className="size-3" aria-hidden />
            ) : (
              <ClipboardCopy className="size-3" aria-hidden />
            )}
            {copied ? "Copied" : "Copy recap"}
          </Button>
          {onFinish && !readOnly ? (
            <Button size="sm" onClick={() => onFinish(v)}>
              Finish &amp; log
            </Button>
          ) : null}
        </div>
      </header>

      <aside className="flex flex-col gap-4">
        <section aria-labelledby="mn-att">
          <h3 id="mn-att" className="crm-eyebrow mb-2 text-crm-subtle">
            Attendees · {v.attendees.filter((a) => a.attended !== false).length}/
            {v.attendees.length}
          </h3>
          <ul className="flex flex-col gap-1">
            {v.attendees.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Avatar name={a.name} src={a.avatar} size="sm" />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    a.attended === false && "text-crm-subtle line-through",
                  )}
                >
                  {a.name}
                  {a.role ? <span className="ml-1 text-xs text-crm-subtle">{a.role}</span> : null}
                </span>
                <span
                  className={cn(
                    "text-[10px] uppercase",
                    a.side === "external" ? "text-tag-blue-text" : "text-crm-faint",
                  )}
                >
                  {a.side === "external" ? "Ext" : "Int"}
                </span>
                <input
                  type="checkbox"
                  aria-label={`${a.name} attended`}
                  disabled={readOnly}
                  checked={a.attended !== false}
                  onChange={(e) =>
                    set({
                      attendees: v.attendees.map((x) =>
                        x.id === a.id ? { ...x, attended: e.target.checked } : x,
                      ),
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="mn-agenda">
          <h3 id="mn-agenda" className="crm-eyebrow mb-2 text-crm-subtle">
            Agenda · {v.agenda.filter((a) => a.covered).length}/{v.agenda.length}
          </h3>
          <ol className="flex flex-col gap-1">
            {v.agenda.map((a, i) => (
              <li key={a.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={readOnly}
                    checked={!!a.covered}
                    onChange={(e) =>
                      set({
                        agenda: v.agenda.map((x) =>
                          x.id === a.id ? { ...x, covered: e.target.checked } : x,
                        ),
                      })
                    }
                  />
                  <span className={cn("flex-1", a.covered && "text-crm-subtle line-through")}>
                    {i + 1}. {a.title}
                  </span>
                  <span className="text-xs text-crm-subtle tabular-nums">{a.minutes}m</span>
                </label>
              </li>
            ))}
          </ol>
        </section>
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby="mn-notes">
          <h3 id="mn-notes" className="crm-eyebrow mb-2 text-crm-subtle">
            Notes
          </h3>
          <Textarea
            aria-labelledby="mn-notes"
            value={v.notes}
            readOnly={readOnly}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Pain points, objections, budget, timeline…"
            autoResize
            maxRows={16}
            className="min-h-32"
          />
        </section>

        <section aria-labelledby="mn-dec">
          <h3 id="mn-dec" className="crm-eyebrow mb-2 flex items-center gap-1 text-crm-subtle">
            <Gavel className="size-3" aria-hidden /> Decisions
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {v.decisions.map((d, i) => (
              <li key={i} className="group flex items-start gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-crm-primary" aria-hidden />
                <span className="flex-1">{d}</span>
                {!readOnly ? (
                  <button
                    type="button"
                    aria-label={`Remove decision ${i + 1}`}
                    onClick={() => set({ decisions: v.decisions.filter((_, j) => j !== i) })}
                    className="p-0.5 text-crm-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-crm-danger"
                  >
                    <Trash2 className="size-3" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {!readOnly ? (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!decision.trim()) return;
                set({ decisions: [...v.decisions, decision.trim()] });
                setDecision("");
              }}
            >
              <input
                aria-label="New decision"
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                placeholder="Record a decision"
                className={cn(small, "flex-1")}
              />
              <Button type="submit" size="sm" variant="secondary" disabled={!decision.trim()}>
                Add
              </Button>
            </form>
          ) : null}
        </section>

        <section aria-labelledby="mn-act">
          <h3 id="mn-act" className="crm-eyebrow mb-2 flex items-center gap-1 text-crm-subtle">
            <ListChecks className="size-3" aria-hidden /> Action items ·{" "}
            {v.actions.filter((a) => !a.done).length} open
          </h3>
          {v.actions.length === 0 ? (
            <p className="text-xs text-crm-subtle">No action items yet.</p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {v.actions.map((a) => {
              const owner = v.attendees.find((x) => x.id === a.ownerId);
              return (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label={`Done: ${a.text}`}
                    disabled={readOnly}
                    checked={!!a.done}
                    onChange={(e) =>
                      set({
                        actions: v.actions.map((x) =>
                          x.id === a.id ? { ...x, done: e.target.checked } : x,
                        ),
                      })
                    }
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      a.done && "text-crm-subtle line-through",
                    )}
                  >
                    {a.text}
                  </span>
                  {a.due ? (
                    <span className="text-xs text-crm-subtle tabular-nums">{a.due}</span>
                  ) : null}
                  {owner ? (
                    <Avatar name={owner.name} src={owner.avatar} size="sm" />
                  ) : (
                    <span className="text-xs text-crm-danger">No owner</span>
                  )}
                </li>
              );
            })}
          </ul>
          {!readOnly ? (
            <form
              className="mt-2 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!action.text.trim()) return;
                set({
                  actions: [
                    ...v.actions,
                    {
                      id: uid(),
                      text: action.text.trim(),
                      ownerId: action.ownerId || undefined,
                      due: action.due || undefined,
                    },
                  ],
                });
                setAction({ text: "", ownerId: action.ownerId, due: "" });
              }}
            >
              <input
                aria-label="New action item"
                value={action.text}
                onChange={(e) => setAction({ ...action, text: e.target.value })}
                placeholder="Send pricing proposal…"
                className={cn(small, "min-w-40 flex-1")}
              />
              <select
                aria-label="Owner"
                value={action.ownerId}
                onChange={(e) => setAction({ ...action, ownerId: e.target.value })}
                className={small}
              >
                <option value="">Owner…</option>
                {v.attendees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="Due date"
                type="date"
                value={action.due}
                onChange={(e) => setAction({ ...action, due: e.target.value })}
                className={small}
              />
              <Button type="submit" size="sm" variant="secondary" disabled={!action.text.trim()}>
                <Plus className="size-3" aria-hidden /> Add
              </Button>
            </form>
          ) : null}
        </section>
      </div>
    </article>
  );
}
