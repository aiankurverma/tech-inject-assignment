import * as React from "react";
import { ExternalLink, Globe, LifeBuoy, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoTile, Avatar } from "@/components/crm/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/crm/tabs";
import { DescriptionList } from "@/components/crm/description-list";
import { ActivityTimeline, type Activity } from "@/components/crm/activity-timeline";
import { Tag, type TagColor } from "@/components/crm/tag";
import { Progress } from "@/components/crm/progress";

export interface CompanyContact {
  id: string;
  name: string;
  title: string;
  email: string;
  /** Marks the primary relationship. */
  primary?: boolean;
}

export interface CompanyDeal {
  id: string;
  name: string;
  amount: number;
  stage: string;
  status: "open" | "won" | "lost";
  closeDate: string;
}

export interface CompanyTicket {
  id: string;
  subject: string;
  priority: "urgent" | "high" | "normal" | "low";
  status: "open" | "pending" | "solved";
}

export interface CompanyRecord {
  id: string;
  name: string;
  domain: string;
  industry: string;
  employees: number;
  location?: string;
  owner: string;
  arr: number;
  /** ISO date the current contract renews. */
  renewalDate?: string;
  /** Seats licensed vs. seats active (drives the adoption signal). */
  seats?: { licensed: number; active: number };
  /** NPS of the account (−100..100). */
  nps?: number;
  description?: string;
  tags?: { label: string; color: TagColor }[];
  contacts: CompanyContact[];
  deals: CompanyDeal[];
  tickets: CompanyTicket[];
  activities?: Activity[];
}

export interface CompanyDetailProps {
  company: CompanyRecord;
  currency?: string;
  /** Reference date for renewal countdown; defaults to now. */
  today?: string;
  defaultTab?: "overview" | "contacts" | "deals" | "tickets" | "activity";
  onOpenDeal?: (d: CompanyDeal) => void;
  onOpenContact?: (c: CompanyContact) => void;
  onOpenTicket?: (t: CompanyTicket) => void;
  className?: string;
}

/**
 * Computes an account health score 0–100 from adoption, NPS, open urgent tickets and renewal proximity.
 * Exported so lists and dashboards can reuse the same formula.
 */
export function computeCompanyHealth(c: CompanyRecord, daysToRenewal?: number) {
  const adoption = c.seats ? Math.min(1, c.seats.active / Math.max(1, c.seats.licensed)) : 0.6;
  const nps = c.nps === undefined ? 0.5 : (c.nps + 100) / 200;
  const urgent = c.tickets.filter(
    (t) => t.status !== "solved" && (t.priority === "urgent" || t.priority === "high"),
  ).length;
  const support = Math.max(0, 1 - urgent * 0.25);
  const renewalPenalty =
    daysToRenewal !== undefined && daysToRenewal < 60 && adoption < 0.5 ? 10 : 0;
  return Math.round(adoption * 45 + nps * 30 + support * 25 - renewalPenalty);
}

const prioColor = { urgent: "red", high: "orange", normal: "blue", low: "neutral" } as const;

/** Account 360: header with health, KPIs, and tabs for overview, contacts, deals, tickets and activity. */
export function CompanyDetail({
  company: c,
  currency = "USD",
  today,
  defaultTab = "overview",
  onOpenDeal,
  onOpenContact,
  onOpenTicket,
  className,
}: CompanyDetailProps) {
  const [dealFilter, setDealFilter] = React.useState<"open" | "closed">("open");
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  const ref = today ? new Date(`${today}T00:00:00`) : new Date();
  const daysToRenewal = c.renewalDate
    ? Math.ceil((new Date(`${c.renewalDate}T00:00:00`).getTime() - ref.getTime()) / 86_400_000)
    : undefined;
  const health = Math.max(0, Math.min(100, computeCompanyHealth(c, daysToRenewal)));
  const openDeals = c.deals.filter((d) => d.status === "open");
  const pipeline = openDeals.reduce((s, d) => s + d.amount, 0);
  const wonTotal = c.deals.filter((d) => d.status === "won").reduce((s, d) => s + d.amount, 0);
  const openTickets = c.tickets.filter((t) => t.status !== "solved");
  const adoption = c.seats
    ? Math.round((c.seats.active / Math.max(1, c.seats.licensed)) * 100)
    : undefined;
  const shownDeals = c.deals.filter((d) =>
    dealFilter === "open" ? d.status === "open" : d.status !== "open",
  );

  const kpis = [
    { label: "ARR", value: money(c.arr) },
    { label: "Open pipeline", value: money(pipeline), hint: `${openDeals.length} deals` },
    { label: "Lifetime won", value: money(wonTotal) },
    {
      label: "Renewal",
      value:
        daysToRenewal === undefined
          ? "—"
          : daysToRenewal < 0
            ? `${-daysToRenewal}d lapsed`
            : `${daysToRenewal}d`,
      warn: daysToRenewal !== undefined && daysToRenewal < 90,
    },
    {
      label: "Open tickets",
      value: String(openTickets.length),
      warn: openTickets.some((t) => t.priority === "urgent"),
    },
  ];

  const row =
    "flex w-full cursor-pointer items-center gap-3 rounded-crm px-2 py-2 text-left outline-none hover:bg-crm-card focus-visible:bg-crm-card focus-visible:ring-2 focus-visible:ring-crm-ring/60";

  return (
    <article className={cn("flex min-w-0 flex-col gap-4 font-crm text-crm-fg", className)}>
      <header className="flex flex-wrap items-center gap-3">
        <LogoTile size="lg" className="text-base font-medium">
          {c.name.charAt(0)}
        </LogoTile>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-medium">{c.name}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-crm-soft">
            <a
              href={`https://${c.domain}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-crm-fg focus-visible:underline focus-visible:outline-none"
            >
              <Globe className="size-3" aria-hidden /> {c.domain}
              <ExternalLink className="size-2.5" aria-hidden />
            </a>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" aria-hidden /> {c.employees.toLocaleString("en-US")}{" "}
              employees
            </span>
            {c.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden /> {c.location}
              </span>
            ) : null}
            {c.tags?.map((t) => (
              <Tag key={t.label} size="sm" color={t.color}>
                {t.label}
              </Tag>
            ))}
          </p>
        </div>
        <div className="w-40">
          <Progress
            value={health}
            label="Account health"
            showValue
            tone={health >= 70 ? "success" : health >= 40 ? "warning" : "danger"}
          />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-crm border border-crm-border bg-crm-card p-3">
            <dt className="crm-caption text-crm-subtle">{k.label}</dt>
            <dd className={cn("mt-1 text-base tabular-nums", k.warn && "text-crm-warning")}>
              {k.value}
            </dd>
            {k.hint ? <dd className="text-xs text-crm-subtle">{k.hint}</dd> : null}
          </div>
        ))}
      </dl>

      <Tabs defaultValue={defaultTab} className="rounded-crm border border-crm-border bg-crm-bg">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({c.contacts.length})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({c.deals.length})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({openTickets.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4 p-4">
          {c.description ? <p className="text-sm text-crm-soft">{c.description}</p> : null}
          <DescriptionList
            columns={3}
            items={[
              { label: "Industry", value: c.industry },
              { label: "Account owner", value: c.owner },
              {
                label: "Renewal date",
                value: c.renewalDate
                  ? new Date(`${c.renewalDate}T00:00:00`).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })
                  : undefined,
              },
              {
                label: "Seat adoption",
                value: c.seats
                  ? `${c.seats.active} / ${c.seats.licensed} (${adoption}%)`
                  : undefined,
              },
              { label: "NPS", value: c.nps !== undefined ? String(c.nps) : undefined },
              { label: "Domain", value: c.domain, copyValue: c.domain },
            ]}
          />
          {adoption !== undefined &&
          adoption < 50 &&
          daysToRenewal !== undefined &&
          daysToRenewal < 90 ? (
            <p
              role="note"
              className="rounded-crm border border-crm-warning/40 bg-crm-warning/10 px-3 py-2 text-xs text-crm-warning"
            >
              Renewal risk: only {adoption}% of seats are active with {daysToRenewal} days to
              renewal.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="contacts" className="p-2">
          {c.contacts.length ? (
            <ul>
              {[...c.contacts]
                .sort((a, b) => Number(!!b.primary) - Number(!!a.primary))
                .map((p) => (
                  <li key={p.id}>
                    <button type="button" className={row} onClick={() => onOpenContact?.(p)}>
                      <Avatar name={p.name} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-crm-subtle">
                          {p.title} · {p.email}
                        </span>
                      </span>
                      {p.primary ? (
                        <Tag size="sm" color="purple">
                          Primary
                        </Tag>
                      ) : null}
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-xs text-crm-subtle">
              No contacts linked to this company.
            </p>
          )}
        </TabsContent>

        <TabsContent value="deals" className="p-2">
          <div role="group" aria-label="Deal filter" className="mb-2 flex gap-1 px-2 pt-2">
            {(["open", "closed"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={dealFilter === f}
                onClick={() => setDealFilter(f)}
                className={cn(
                  "h-6 cursor-pointer rounded-full px-2.5 text-xs capitalize outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  dealFilter === f
                    ? "bg-crm-muted text-crm-fg"
                    : "text-crm-subtle hover:text-crm-fg",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          {shownDeals.length ? (
            <ul>
              {shownDeals.map((d) => (
                <li key={d.id}>
                  <button type="button" className={row} onClick={() => onOpenDeal?.(d)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{d.name}</span>
                      <span className="block text-xs text-crm-subtle">
                        Close{" "}
                        {new Date(`${d.closeDate}T00:00:00`).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </span>
                    <Tag
                      size="sm"
                      color={d.status === "won" ? "green" : d.status === "lost" ? "red" : "blue"}
                    >
                      {d.status === "open" ? d.stage : d.status === "won" ? "Won" : "Lost"}
                    </Tag>
                    <span className="w-24 text-right text-sm tabular-nums">{money(d.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-xs text-crm-subtle">No {dealFilter} deals.</p>
          )}
        </TabsContent>

        <TabsContent value="tickets" className="p-2">
          {c.tickets.length ? (
            <ul>
              {c.tickets.map((t) => (
                <li key={t.id}>
                  <button type="button" className={row} onClick={() => onOpenTicket?.(t)}>
                    <LifeBuoy className="size-3.5 text-crm-soft" aria-hidden />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        t.status === "solved" && "text-crm-subtle line-through",
                      )}
                    >
                      {t.subject}
                    </span>
                    <Tag size="sm" color={prioColor[t.priority]}>
                      {t.priority}
                    </Tag>
                    <span className="w-16 text-right text-xs text-crm-soft capitalize">
                      {t.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-xs text-crm-subtle">No support tickets — nice.</p>
          )}
        </TabsContent>

        <TabsContent value="activity" className="p-4">
          {c.activities?.length ? (
            <ActivityTimeline items={c.activities} />
          ) : (
            <p className="py-6 text-center text-xs text-crm-subtle">No activity logged yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </article>
  );
}
