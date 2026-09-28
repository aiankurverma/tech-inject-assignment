import * as React from "react";
import { ChevronDown, PhoneIncoming, PhoneMissed, PhoneOutgoing, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type CallDirection = "inbound" | "outbound";
export type CallOutcome = "connected" | "voicemail" | "no_answer" | "busy" | "wrong_number";

export interface CallRecord {
  id: string;
  direction: CallDirection;
  outcome: CallOutcome;
  /** Talk time in seconds (0 when not connected). */
  duration: number;
  /** ISO datetime. */
  at: string;
  contact: { name: string; company?: string; phone: string };
  rep: { name: string; avatar?: string };
  notes?: string;
}

export interface CallLogProps {
  calls?: CallRecord[];
  defaultCalls?: CallRecord[];
  onCallsChange?: (calls: CallRecord[]) => void;
  /** Name used as rep for calls logged from the form. */
  currentRep?: { name: string; avatar?: string };
  locale?: string;
  loading?: boolean;
  className?: string;
}

const OUTCOME: Record<CallOutcome, { label: string; color: TagColor }> = {
  connected: { label: "Connected", color: "green" },
  voicemail: { label: "Voicemail", color: "blue" },
  no_answer: { label: "No answer", color: "neutral" },
  busy: { label: "Busy", color: "amber" },
  wrong_number: { label: "Wrong number", color: "red" },
};

/** "1:05:03" / "4:07" / "0:00". */
export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Parses "mm:ss", "h:mm:ss" or plain minutes ("7") into seconds; null when invalid. */
export function parseDuration(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 60);
  const parts = t.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const n = parts.map(Number);
  if (n.slice(1).some((x) => x >= 60)) return null;
  return n.reduce((acc, x) => acc * 60 + x, 0);
}

/** Call activity log with direction/outcome filters, talk-time and connect-rate stats, expandable notes and a validated "log a call" form. */
export function CallLog({
  calls: callsProp,
  defaultCalls = [],
  onCallsChange,
  currentRep = { name: "You" },
  locale = "en-US",
  loading,
  className,
}: CallLogProps) {
  const [inner, setInner] = React.useState(defaultCalls);
  const calls = callsProp ?? inner;
  const [dir, setDir] = React.useState("all");
  const [outcome, setOutcome] = React.useState<"all" | CallOutcome>("all");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    phone: "",
    direction: "outbound" as CallDirection,
    outcome: "connected" as CallOutcome,
    duration: "",
    notes: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const list = calls
    .filter(
      (c) => (dir === "all" || c.direction === dir) && (outcome === "all" || c.outcome === outcome),
    )
    .sort((a, b) => b.at.localeCompare(a.at));

  const outbound = list.filter((c) => c.direction === "outbound");
  const connected = list.filter((c) => c.outcome === "connected");
  const talk = connected.reduce((s, c) => s + c.duration, 0);
  const connectRate = outbound.length
    ? Math.round((outbound.filter((c) => c.outcome === "connected").length / outbound.length) * 100)
    : null;

  const time = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Contact is required";
    if (!/^\+?[\d\s().-]{7,}$/.test(form.phone.trim())) errs.phone = "Enter a valid phone number";
    let seconds = 0;
    if (form.outcome === "connected") {
      const p = parseDuration(form.duration);
      if (p === null || p <= 0) errs.duration = "Use mm:ss or minutes, e.g. 4:30";
      else seconds = p;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const rec: CallRecord = {
      id: `c-${Date.now()}`,
      direction: form.direction,
      outcome: form.outcome,
      duration: seconds,
      at: new Date().toISOString(),
      contact: { name: form.name.trim(), phone: form.phone.trim() },
      rep: currentRep,
      notes: form.notes.trim() || undefined,
    };
    const next = [rec, ...calls];
    if (callsProp === undefined) setInner(next);
    onCallsChange?.(next);
    setForm({ ...form, name: "", phone: "", duration: "", notes: "" });
    setFormOpen(false);
  };

  const field =
    "h-8 w-full rounded-crm border border-crm-border bg-crm-bg px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 aria-[invalid=true]:border-crm-danger";

  return (
    <section
      aria-label="Call log"
      className={cn(
        "flex flex-col rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
        <SegmentedControl
          size="sm"
          label="Direction"
          value={dir}
          onValueChange={setDir}
          options={[
            { value: "all", label: "All" },
            { value: "outbound", label: "Outbound" },
            { value: "inbound", label: "Inbound" },
          ]}
        />
        <select
          aria-label="Outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as "all" | CallOutcome)}
          className="h-7 rounded-crm border border-crm-border bg-crm-bg px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <option value="all">All outcomes</option>
          {Object.entries(OUTCOME).map(([k, o]) => (
            <option key={k} value={k}>
              {o.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => setFormOpen((o) => !o)}
          aria-expanded={formOpen}
        >
          <Plus className="size-3" aria-hidden /> Log call
        </Button>
      </header>

      <dl className="grid grid-cols-3 divide-x divide-crm-border border-b border-crm-border text-center">
        {[
          ["Calls", String(list.length)],
          ["Talk time", formatDuration(talk)],
          ["Connect rate", connectRate === null ? "—" : `${connectRate}%`],
        ].map(([k, val]) => (
          <div key={k} className="px-2 py-2.5">
            <dt className="crm-caption text-crm-subtle">{k}</dt>
            <dd className="text-sm font-medium tabular-nums">{val}</dd>
          </div>
        ))}
      </dl>

      {formOpen ? (
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-3 border-b border-crm-border bg-crm-bg/50 p-3 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Contact
            <input
              className={field}
              value={form.name}
              aria-invalid={!!errors.name || undefined}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            {errors.name ? (
              <span role="alert" className="text-crm-danger">
                {errors.name}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Phone
            <input
              className={field}
              type="tel"
              value={form.phone}
              aria-invalid={!!errors.phone || undefined}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 415 555 0132"
            />
            {errors.phone ? (
              <span role="alert" className="text-crm-danger">
                {errors.phone}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Direction
            <select
              className={field}
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value as CallDirection })}
            >
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Outcome
            <select
              className={field}
              value={form.outcome}
              onChange={(e) => setForm({ ...form, outcome: e.target.value as CallOutcome })}
            >
              {Object.entries(OUTCOME).map(([k, o]) => (
                <option key={k} value={k}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Duration
            <input
              className={field}
              value={form.duration}
              disabled={form.outcome !== "connected"}
              aria-invalid={!!errors.duration || undefined}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              placeholder={form.outcome === "connected" ? "4:30" : "Not connected"}
            />
            {errors.duration ? (
              <span role="alert" className="text-crm-danger">
                {errors.duration}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft sm:row-span-2">
            Notes
            <textarea
              className={cn(field, "h-auto min-h-16 py-1.5")}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <div className="flex gap-2 sm:col-start-1">
            <Button type="submit" size="sm">
              Save call
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-crm bg-crm-muted" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="p-10 text-center text-sm text-crm-subtle">No calls match these filters.</p>
      ) : (
        <ul className="divide-y divide-crm-border">
          {list.map((c) => {
            const Icon =
              c.outcome !== "connected" && c.direction === "inbound"
                ? PhoneMissed
                : c.direction === "inbound"
                  ? PhoneIncoming
                  : PhoneOutgoing;
            const isOpen = expanded === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-expanded={c.notes ? isOpen : undefined}
                  disabled={!c.notes}
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm outline-none hover:bg-crm-muted/40 focus-visible:bg-crm-muted/60 disabled:cursor-default"
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      c.outcome === "connected"
                        ? "text-crm-success"
                        : c.direction === "inbound"
                          ? "text-crm-danger"
                          : "text-crm-soft",
                    )}
                    aria-label={`${c.direction} call`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {c.contact.name}
                      {c.contact.company ? (
                        <span className="text-crm-subtle"> · {c.contact.company}</span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-crm-subtle tabular-nums">
                      {c.contact.phone} · {time(c.at)}
                    </span>
                  </span>
                  <Tag size="sm" color={OUTCOME[c.outcome].color}>
                    {OUTCOME[c.outcome].label}
                  </Tag>
                  <span className="w-14 text-right text-xs text-crm-soft tabular-nums">
                    {c.duration ? formatDuration(c.duration) : "—"}
                  </span>
                  <Avatar name={c.rep.name} src={c.rep.avatar} size="sm" />
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-crm-faint transition-transform",
                      isOpen && "rotate-180",
                      !c.notes && "invisible",
                    )}
                    aria-hidden
                  />
                </button>
                {isOpen && c.notes ? (
                  <p className="px-10 pb-3 text-xs whitespace-pre-line text-crm-soft">{c.notes}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
