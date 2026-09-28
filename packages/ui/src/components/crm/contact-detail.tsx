import * as React from "react";
import { Ban, Building2, Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Tag, type TagColor } from "@/components/crm/tag";
import { DescriptionList } from "@/components/crm/description-list";
import {
  ActivityTimeline,
  type Activity,
  type ActivityType,
} from "@/components/crm/activity-timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/crm/tabs";
import { Textarea } from "@/components/crm/textarea";

export interface ContactRecord {
  id: string;
  name: string;
  title?: string;
  company?: string;
  email: string;
  phone?: string;
  location?: string;
  /** IANA time zone, e.g. "Europe/Berlin" — drives the local-time chip. */
  timeZone?: string;
  owner: string;
  lifecycle: "Subscriber" | "Lead" | "MQL" | "SQL" | "Customer" | "Evangelist";
  tags?: { label: string; color: TagColor }[];
  /** Consent flags. */
  doNotEmail?: boolean;
  doNotCall?: boolean;
  linkedin?: string;
  createdAt: string;
  deals?: { id: string; name: string; amount: number; stage: string }[];
  activities: Activity[];
}

export interface ContactDetailProps {
  contact: ContactRecord;
  currency?: string;
  /** Called when a note is logged from the composer; the note is also added locally. */
  onLogNote?: (text: string) => void;
  onEmail?: (c: ContactRecord) => void;
  onCall?: (c: ContactRecord) => void;
  /** Author name used for notes logged here. */
  currentUser?: string;
  className?: string;
}

const lifecycleColor = {
  Subscriber: "neutral",
  Lead: "blue",
  MQL: "teal",
  SQL: "purple",
  Customer: "green",
  Evangelist: "amber",
} as const;

const filters: { value: "all" | ActivityType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "email", label: "Emails" },
  { value: "call", label: "Calls" },
  { value: "meeting", label: "Meetings" },
  { value: "note", label: "Notes" },
];

function useLocalTime(timeZone?: string) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    if (!timeZone) return;
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, [timeZone]);
  if (!timeZone) return null;
  try {
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
    const hour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(now),
    );
    return { time, working: hour >= 9 && hour < 18 };
  } catch {
    return null;
  }
}

/**
 * Contact record: identity header with consent-aware actions, local time + business-hours hint,
 * engagement summary, filterable activity feed with a note composer, deals and properties.
 */
export function ContactDetail({
  contact,
  currency = "USD",
  onLogNote,
  onEmail,
  onCall,
  currentUser = "You",
  className,
}: ContactDetailProps) {
  const [filter, setFilter] = React.useState<"all" | ActivityType>("all");
  const [notes, setNotes] = React.useState<Activity[]>([]);
  const [draft, setDraft] = React.useState("");
  const local = useLocalTime(contact.timeZone);

  const activities = [...notes, ...contact.activities];
  const shown = filter === "all" ? activities : activities.filter((a) => a.type === filter);
  const count = (t: ActivityType) => activities.filter((a) => a.type === t).length;
  const openPipeline = (contact.deals ?? []).reduce((s, d) => s + d.amount, 0);
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes((n) => [
      {
        id: `note-${Date.now()}`,
        type: "note",
        actor: { name: currentUser },
        text: "added a note",
        detail: text,
        time: "Just now",
      },
      ...n,
    ]);
    onLogNote?.(text);
    setDraft("");
  };

  return (
    <article
      className={cn("grid min-w-0 gap-4 font-crm text-crm-fg lg:grid-cols-[300px_1fr]", className)}
    >
      <aside className="flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4">
        <div className="flex items-center gap-3">
          <Avatar name={contact.name} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-medium">{contact.name}</h1>
            <p className="truncate text-xs text-crm-soft">
              {[contact.title, contact.company].filter(Boolean).join(" at ")}
            </p>
            <Tag size="sm" color={lifecycleColor[contact.lifecycle]} className="mt-1">
              {contact.lifecycle}
            </Tag>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={contact.doNotEmail}
            title={contact.doNotEmail ? "Contact opted out of email" : undefined}
            onClick={() => onEmail?.(contact)}
          >
            {contact.doNotEmail ? (
              <Ban className="size-3.5" aria-hidden />
            ) : (
              <Mail className="size-3.5" aria-hidden />
            )}
            Email
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={contact.doNotCall || !contact.phone}
            title={contact.doNotCall ? "Contact opted out of calls" : undefined}
            onClick={() => onCall?.(contact)}
          >
            {contact.doNotCall ? (
              <Ban className="size-3.5" aria-hidden />
            ) : (
              <Phone className="size-3.5" aria-hidden />
            )}
            Call
          </Button>
        </div>
        {contact.doNotEmail || contact.doNotCall ? (
          <p role="note" className="text-xs text-crm-warning">
            Consent:{" "}
            {[contact.doNotEmail && "no email", contact.doNotCall && "no calls"]
              .filter(Boolean)
              .join(", ")}
            .
          </p>
        ) : null}

        <ul className="flex flex-col gap-2 text-xs text-crm-soft">
          <li className="flex items-center gap-2">
            <Mail className="size-3.5 shrink-0" aria-hidden />
            <a
              href={`mailto:${contact.email}`}
              className="truncate hover:text-crm-fg focus-visible:underline focus-visible:outline-none"
            >
              {contact.email}
            </a>
          </li>
          {contact.phone ? (
            <li className="flex items-center gap-2">
              <Phone className="size-3.5 shrink-0" aria-hidden />
              <a
                href={`tel:${contact.phone.replace(/\s/g, "")}`}
                className="hover:text-crm-fg focus-visible:underline focus-visible:outline-none"
              >
                {contact.phone}
              </a>
            </li>
          ) : null}
          {contact.company ? (
            <li className="flex items-center gap-2">
              <Building2 className="size-3.5 shrink-0" aria-hidden /> {contact.company}
            </li>
          ) : null}
          {contact.location ? (
            <li className="flex items-center gap-2">
              <MapPin className="size-3.5 shrink-0" aria-hidden /> {contact.location}
            </li>
          ) : null}
          {local ? (
            <li className="flex items-center gap-2">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              {local.time} local
              <span
                className={cn("ml-auto", local.working ? "text-crm-success" : "text-crm-subtle")}
              >
                {local.working ? "Working hours" : "Outside hours"}
              </span>
            </li>
          ) : null}
        </ul>

        {contact.tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {contact.tags.map((t) => (
              <Tag key={t.label} size="sm" color={t.color}>
                {t.label}
              </Tag>
            ))}
          </div>
        ) : null}

        <dl className="grid grid-cols-3 gap-2 border-t border-crm-border pt-3 text-center">
          {(["email", "call", "meeting"] as const).map((t) => (
            <div key={t}>
              <dd className="text-base tabular-nums">{count(t)}</dd>
              <dt className="crm-caption text-crm-subtle capitalize">{t}s</dt>
            </div>
          ))}
        </dl>
      </aside>

      <Tabs
        defaultValue="activity"
        className="min-w-0 rounded-crm border border-crm-border bg-crm-bg"
      >
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({contact.deals?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="flex flex-col gap-4 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-2"
          >
            <label htmlFor={`note-${contact.id}`} className="sr-only">
              Log a note
            </label>
            <Textarea
              id={`note-${contact.id}`}
              rows={2}
              value={draft}
              placeholder={`Log a note about ${contact.name.split(" ")[0]}… (Ctrl+Enter to save)`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-1">
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "h-6 cursor-pointer rounded-full px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                    filter === f.value
                      ? "bg-crm-muted text-crm-fg"
                      : "text-crm-subtle hover:text-crm-fg",
                  )}
                >
                  {f.label}
                </button>
              ))}
              <Button type="submit" size="sm" className="ml-auto" disabled={!draft.trim()}>
                <Send className="size-3" aria-hidden /> Save note
              </Button>
            </div>
          </form>
          {shown.length ? (
            <ActivityTimeline items={shown} />
          ) : (
            <p className="py-6 text-center text-xs text-crm-subtle">
              Nothing logged for this filter yet.
            </p>
          )}
        </TabsContent>

        <TabsContent value="deals" className="p-4">
          {contact.deals?.length ? (
            <>
              <ul className="flex flex-col divide-y divide-crm-border">
                {contact.deals.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    <Tag size="sm" color="blue">
                      {d.stage}
                    </Tag>
                    <span className="w-24 text-right tabular-nums">{money(d.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-right text-xs text-crm-soft">
                Total <span className="text-crm-fg tabular-nums">{money(openPipeline)}</span>
              </p>
            </>
          ) : (
            <p className="py-6 text-center text-xs text-crm-subtle">
              This contact isn't on any deals.
            </p>
          )}
        </TabsContent>

        <TabsContent value="about" className="p-4">
          <DescriptionList
            columns={2}
            items={[
              { label: "Email", value: contact.email, copyValue: contact.email },
              { label: "Phone", value: contact.phone, copyValue: contact.phone },
              { label: "Owner", value: contact.owner },
              { label: "Lifecycle stage", value: contact.lifecycle },
              { label: "Time zone", value: contact.timeZone },
              { label: "LinkedIn", value: contact.linkedin },
              {
                label: "Created",
                value: new Date(contact.createdAt).toLocaleDateString("en-US", {
                  dateStyle: "medium",
                }),
              },
            ]}
          />
        </TabsContent>
      </Tabs>
    </article>
  );
}
