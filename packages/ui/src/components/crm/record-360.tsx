import * as React from "react";
import { Building2, Globe, Mail, MapPin, Phone, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ActivityTimeline,
  type Activity,
  type ActivityType,
} from "@/components/crm/activity-timeline";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { DealCard, type Deal } from "@/components/crm/deal-card";
import { DescriptionList } from "@/components/crm/description-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/crm/tabs";
import { Tag, type TagColor } from "@/components/crm/tag";

export interface Record360Contact {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  /** Buying-committee role. */
  role?: "champion" | "decision_maker" | "influencer" | "blocker" | "user";
  lastTouch?: string;
}

export interface Record360Ticket {
  id: string;
  subject: string;
  status: "open" | "pending" | "solved";
  priority: "low" | "normal" | "high" | "urgent";
  age: string;
}

export interface Record360Data {
  company: {
    name: string;
    domain?: string;
    industry?: string;
    employees?: number;
    location?: string;
    owner?: { name: string; avatar?: string };
    lifecycle?: "lead" | "prospect" | "customer" | "churned";
  };
  /** 0–100 account health. */
  health?: number;
  /** Annual recurring revenue in major units. */
  arr?: number;
  renewalDate?: string;
  contacts: Record360Contact[];
  deals: (Deal & { stage: string; status?: "open" | "won" | "lost" })[];
  activities: Activity[];
  tickets: Record360Ticket[];
}

export interface Record360Props {
  data: Record360Data;
  currency?: string;
  locale?: string;
  defaultTab?: "overview" | "activity" | "deals" | "contacts" | "support";
  onOpenDeal?: (deal: Deal) => void;
  onLogActivity?: () => void;
  className?: string;
}

const ROLE: Record<NonNullable<Record360Contact["role"]>, { label: string; color: TagColor }> = {
  champion: { label: "Champion", color: "green" },
  decision_maker: { label: "Decision maker", color: "purple" },
  influencer: { label: "Influencer", color: "blue" },
  blocker: { label: "Blocker", color: "red" },
  user: { label: "User", color: "neutral" },
};
const LIFECYCLE: Record<NonNullable<Record360Data["company"]["lifecycle"]>, TagColor> = {
  lead: "neutral",
  prospect: "blue",
  customer: "green",
  churned: "red",
};
const TICKET: Record<Record360Ticket["status"], TagColor> = {
  open: "orange",
  pending: "amber",
  solved: "green",
};

function Count({ n }: { n: number }) {
  return <span className="ml-1 text-crm-subtle tabular-nums">{n}</span>;
}

/** 360° account page: header, health/revenue KPIs and tabs for activity, deals, buying committee and support — composed from CRM primitives. */
export function Record360({
  data,
  currency = "USD",
  locale = "en-US",
  defaultTab = "overview",
  onOpenDeal,
  onLogActivity,
  className,
}: Record360Props) {
  const [tab, setTab] = React.useState<string>(defaultTab);
  const [activityType, setActivityType] = React.useState<"all" | ActivityType>("all");
  const [dealStatus, setDealStatus] = React.useState<"open" | "won" | "lost">("open");
  const fmt = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [locale, currency],
  );
  const { company } = data;
  const openDeals = data.deals.filter((d) => (d.status ?? "open") === "open");
  const pipeline = openDeals.reduce((s, d) => s + d.amount, 0);
  const weighted = openDeals.reduce((s, d) => s + (d.amount * (d.probability ?? 0)) / 100, 0);
  const openTickets = data.tickets.filter((t) => t.status !== "solved");
  const health = data.health;
  const healthTone =
    health === undefined
      ? ""
      : health >= 70
        ? "text-crm-success"
        : health >= 40
          ? "text-tag-amber-text"
          : "text-crm-danger";
  const hasChampion = data.contacts.some((c) => c.role === "champion");
  const activities =
    activityType === "all"
      ? data.activities
      : data.activities.filter((a) => a.type === activityType);
  const deals = data.deals.filter((d) => (d.status ?? "open") === dealStatus);

  const kpis = [
    { label: "ARR", value: data.arr !== undefined ? fmt.format(data.arr) : "—" },
    {
      label: "Open pipeline",
      value: fmt.format(pipeline),
      sub: `${fmt.format(weighted)} weighted`,
    },
    {
      label: "Health",
      value: health !== undefined ? `${health}/100` : "—",
      cls: healthTone,
    },
    {
      label: "Renewal",
      value: data.renewalDate
        ? new Date(data.renewalDate + "T00:00:00").toLocaleDateString(locale, {
            dateStyle: "medium",
          })
        : "—",
    },
    {
      label: "Open tickets",
      value: String(openTickets.length),
      cls: openTickets.some((t) => t.priority === "urgent") ? "text-crm-danger" : "",
    },
  ];

  return (
    <article
      aria-label={`${company.name} overview`}
      className={cn("flex flex-col gap-4 font-crm text-crm-fg", className)}
    >
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-crm bg-crm-muted text-crm-soft">
          <Building2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-medium">{company.name}</h2>
            {company.lifecycle ? (
              <Tag size="sm" color={LIFECYCLE[company.lifecycle]} className="capitalize">
                {company.lifecycle}
              </Tag>
            ) : null}
          </div>
          <p className="flex flex-wrap gap-x-3 text-xs text-crm-soft">
            {company.domain ? (
              <span className="flex items-center gap-1">
                <Globe className="size-3" aria-hidden />
                {company.domain}
              </span>
            ) : null}
            {company.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {company.location}
              </span>
            ) : null}
            {company.employees ? (
              <span className="flex items-center gap-1">
                <Users className="size-3" aria-hidden />
                {company.employees.toLocaleString(locale)} employees
              </span>
            ) : null}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {company.owner ? (
            <span className="flex items-center gap-1.5 text-xs text-crm-soft">
              <Avatar name={company.owner.name} src={company.owner.avatar} size="sm" />{" "}
              {company.owner.name}
            </span>
          ) : null}
          {onLogActivity ? (
            <Button size="sm" onClick={onLogActivity}>
              Log activity
            </Button>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-crm border border-crm-border bg-crm-card p-3 shadow-crm-raised"
          >
            <dt className="crm-caption text-crm-subtle">{k.label}</dt>
            <dd className={cn("text-base font-medium tabular-nums", k.cls)}>{k.value}</dd>
            {k.sub ? <dd className="text-xs text-crm-subtle tabular-nums">{k.sub}</dd> : null}
          </div>
        ))}
      </dl>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">
            Activity
            <Count n={data.activities.length} />
          </TabsTrigger>
          <TabsTrigger value="deals">
            Deals
            <Count n={openDeals.length} />
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts
            <Count n={data.contacts.length} />
          </TabsTrigger>
          <TabsTrigger value="support">
            Support
            <Count n={openTickets.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
          <section className="rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
            <h3 className="crm-eyebrow mb-3 text-crm-subtle">Recent activity</h3>
            {data.activities.length ? (
              <ActivityTimeline items={data.activities.slice(0, 4)} />
            ) : (
              <p className="text-xs text-crm-subtle">No activity logged yet.</p>
            )}
          </section>
          <section className="flex flex-col gap-3">
            <div className="rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
              <h3 className="crm-eyebrow mb-3 text-crm-subtle">Details</h3>
              <DescriptionList
                items={[
                  { label: "Industry", value: company.industry },
                  { label: "Domain", value: company.domain, copyValue: company.domain },
                  { label: "Owner", value: company.owner?.name },
                  { label: "Contacts", value: String(data.contacts.length) },
                ]}
              />
            </div>
            {!hasChampion && data.contacts.length ? (
              <p
                role="note"
                className="rounded-crm border border-tag-amber-border bg-tag-amber-bg p-3 text-xs text-tag-amber-text"
              >
                No champion identified in the buying committee. Multi-thread before the next stage.
              </p>
            ) : null}
          </section>
        </TabsContent>

        <TabsContent
          value="activity"
          className="mt-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised"
        >
          <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Filter activity">
            {(["all", "email", "call", "meeting", "note", "task"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={activityType === t}
                onClick={() => setActivityType(t)}
                className={cn(
                  "rounded-full border border-crm-border px-2.5 py-0.5 text-xs capitalize",
                  activityType === t ? "border-crm-primary bg-crm-primary/15" : "text-crm-soft",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          {activities.length ? (
            <ActivityTimeline items={activities} />
          ) : (
            <p className="text-xs text-crm-subtle">No {activityType} activity.</p>
          )}
        </TabsContent>

        <TabsContent value="deals" className="mt-3">
          <div className="mb-3 flex gap-1" role="group" aria-label="Deal status">
            {(["open", "won", "lost"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={dealStatus === s}
                onClick={() => setDealStatus(s)}
                className={cn(
                  "rounded-full border border-crm-border px-2.5 py-0.5 text-xs capitalize",
                  dealStatus === s ? "border-crm-primary bg-crm-primary/15" : "text-crm-soft",
                )}
              >
                {s}{" "}
                <span className="tabular-nums">
                  {data.deals.filter((d) => (d.status ?? "open") === s).length}
                </span>
              </button>
            ))}
          </div>
          {deals.length ? (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((d) => (
                <li key={d.id} className="flex flex-col gap-1">
                  <span className="crm-caption text-crm-subtle">{d.stage}</span>
                  <DealCard deal={{ ...d, currency: d.currency ?? "$" }} onOpen={onOpenDeal} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-crm border border-dashed border-crm-border p-8 text-center text-xs text-crm-subtle">
              No {dealStatus} deals.
            </p>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-3">
          <ul className="divide-y divide-crm-border rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
            {data.contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <Avatar name={c.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-crm-soft">{c.title}</p>
                </div>
                {c.role ? (
                  <Tag size="sm" color={ROLE[c.role].color}>
                    {ROLE[c.role].label}
                  </Tag>
                ) : null}
                {c.lastTouch ? (
                  <span className="text-xs text-crm-subtle">Last touch {c.lastTouch}</span>
                ) : null}
                <span className="flex gap-1">
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      aria-label={`Email ${c.name}`}
                      className="rounded p-1.5 text-crm-soft hover:bg-crm-muted"
                    >
                      <Mail className="size-3.5" />
                    </a>
                  ) : null}
                  {c.phone ? (
                    <a
                      href={`tel:${c.phone}`}
                      aria-label={`Call ${c.name}`}
                      className="rounded p-1.5 text-crm-soft hover:bg-crm-muted"
                    >
                      <Phone className="size-3.5" />
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
            {data.contacts.length === 0 ? (
              <li className="p-8 text-center text-xs text-crm-subtle">No contacts yet.</li>
            ) : null}
          </ul>
        </TabsContent>

        <TabsContent value="support" className="mt-3">
          <ul className="divide-y divide-crm-border rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
            {data.tickets.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="text-xs text-crm-subtle tabular-nums">#{t.id}</span>
                <span className="min-w-0 flex-1 truncate">{t.subject}</span>
                {t.priority === "urgent" || t.priority === "high" ? (
                  <Tag
                    size="sm"
                    color={t.priority === "urgent" ? "red" : "orange"}
                    className="capitalize"
                  >
                    {t.priority}
                  </Tag>
                ) : null}
                <Tag size="sm" color={TICKET[t.status]} className="capitalize">
                  {t.status}
                </Tag>
                <span className="w-16 text-right text-xs text-crm-subtle">{t.age}</span>
              </li>
            ))}
            {data.tickets.length === 0 ? (
              <li className="p-8 text-center text-xs text-crm-subtle">No support tickets.</li>
            ) : null}
          </ul>
        </TabsContent>
      </Tabs>
    </article>
  );
}
