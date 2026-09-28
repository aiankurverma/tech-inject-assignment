import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { KanbanColumn } from "@/components/crm/kanban-column";
import type { Deal } from "@/components/crm/deal-card";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import type { TagColor } from "@/components/crm/tag";

export type ReLeadStage = "new" | "contacted" | "touring" | "offer" | "contract" | "closed";

export interface ReLead {
  id: string;
  name: string;
  kind: "buyer" | "seller";
  /** Budget for buyers, estimated list price for sellers. */
  value: number;
  area: string;
  source: "Zillow" | "Referral" | "Open house" | "Website" | "Sign call";
  stage: ReLeadStage;
  agent: string;
  /** ISO date-time the lead came in. */
  createdAt: string;
  /** ISO date-time of the first reply; missing = not contacted yet. */
  firstContactAt?: string;
  /** ISO date of the next follow-up. */
  nextFollowUp?: string;
  preApproved?: boolean;
}

export interface ReLeadBoardProps {
  leads: ReLead[];
  onLeadsChange: (leads: ReLead[]) => void;
  onOpen?: (lead: ReLead) => void;
  /** Hours before a new lead without contact is flagged. */
  speedToLeadHours?: number;
  /** Buyer-side commission rate used for the pipeline GCI estimate. */
  commissionRate?: number;
  now?: Date;
  className?: string;
}

export const reStages: { id: ReLeadStage; title: string; color: string; probability: number }[] = [
  { id: "new", title: "New", color: "#8b8b8b", probability: 5 },
  { id: "contacted", title: "Contacted", color: "#6346ff", probability: 15 },
  { id: "touring", title: "Touring", color: "#2fa8e0", probability: 35 },
  { id: "offer", title: "Offer out", color: "#e0a82f", probability: 60 },
  { id: "contract", title: "Under contract", color: "#e06a2f", probability: 85 },
  { id: "closed", title: "Closed", color: "#2fbf71", probability: 100 },
];

const sourceColor: Record<ReLead["source"], TagColor> = {
  Zillow: "blue",
  Referral: "green",
  "Open house": "purple",
  Website: "teal",
  "Sign call": "amber",
};

/** Real-estate lead board: drag leads across stages, filter by agent and buyer/seller, weighted GCI and speed-to-lead alerts. */
export function ReLeadBoard({
  leads,
  onLeadsChange,
  onOpen,
  speedToLeadHours = 1,
  commissionRate = 0.025,
  now: nowProp,
  className,
}: ReLeadBoardProps) {
  const now = nowProp ?? new Date();
  const [kind, setKind] = React.useState("all");
  const [agent, setAgent] = React.useState("all");
  const [q, setQ] = React.useState("");
  const agents = [...new Set(leads.map((l) => l.agent))].sort();
  const compact = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const visible = leads.filter(
    (l) =>
      (kind === "all" || l.kind === kind) &&
      (agent === "all" || l.agent === agent) &&
      (!q.trim() || `${l.name} ${l.area}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const slow = visible.filter(
    (l) => !l.firstContactAt && +now - +new Date(l.createdAt) > speedToLeadHours * 3_600_000,
  );
  const weighted = visible
    .filter((l) => l.stage !== "closed")
    .reduce(
      (s, l) => s + l.value * ((reStages.find((x) => x.id === l.stage)?.probability ?? 0) / 100),
      0,
    );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const toDeal = (l: ReLead): Deal => ({
    id: l.id,
    title: l.name,
    company: `${l.kind === "buyer" ? "Buyer" : "Seller"} · ${l.area}${l.preApproved ? " · Pre-approved" : ""}`,
    amount: l.value,
    probability: reStages.find((x) => x.id === l.stage)?.probability,
    closeDate: l.nextFollowUp
      ? `Follow up ${new Date(l.nextFollowUp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : undefined,
    overdue: !!l.nextFollowUp && new Date(l.nextFollowUp) < today && l.stage !== "closed",
    owner: { name: l.agent },
    tag: slow.includes(l)
      ? { label: "No contact", color: "red" }
      : { label: l.source, color: sourceColor[l.source] },
  });

  const move = (id: string, stage: ReLeadStage) =>
    onLeadsChange(
      leads.map((l) =>
        l.id === id
          ? {
              ...l,
              stage,
              firstContactAt: l.firstContactAt ?? (stage !== "new" ? now.toISOString() : undefined),
            }
          : l,
      ),
    );

  return (
    <section aria-label="Lead board" className={cn("flex flex-col gap-3 font-crm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          size="sm"
          value={q}
          onValueChange={setQ}
          placeholder="Lead or area"
          className="w-full sm:w-52"
        />
        <SegmentedControl
          label="Lead type"
          size="sm"
          value={kind}
          onValueChange={setKind}
          options={[
            { value: "all", label: "All" },
            {
              value: "buyer",
              label: "Buyers",
              count: leads.filter((l) => l.kind === "buyer").length,
            },
            {
              value: "seller",
              label: "Sellers",
              count: leads.filter((l) => l.kind === "seller").length,
            },
          ]}
        />
        <label className="flex items-center gap-1.5 text-xs text-crm-soft">
          Agent
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="h-7 rounded-full border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <option value="all">Everyone</option>
            {agents.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <dl className="ml-auto flex gap-4 text-xs">
          <div>
            <dt className="text-crm-subtle">Weighted volume</dt>
            <dd className="font-medium text-crm-fg tabular-nums">{compact.format(weighted)}</dd>
          </div>
          <div>
            <dt className="text-crm-subtle">Est. GCI</dt>
            <dd className="font-medium text-crm-fg tabular-nums">
              {compact.format(weighted * commissionRate)}
            </dd>
          </div>
        </dl>
      </div>
      {slow.length ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-crm border border-crm-warning/40 bg-crm-warning/10 px-3 py-2 text-xs text-crm-warning"
        >
          <AlertTriangle className="size-3.5" aria-hidden />
          {slow.length} lead{slow.length > 1 ? "s" : ""} waiting more than {speedToLeadHours}h for
          first contact: {slow.map((l) => l.name).join(", ")}
        </p>
      ) : null}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {reStages.map((s) => {
          const items = visible.filter((l) => l.stage === s.id);
          return (
            <KanbanColumn
              key={s.id}
              title={s.title}
              color={s.color}
              deals={items.map(toDeal)}
              subtitle={`${compact.format(items.reduce((sum, l) => sum + l.value, 0))} · ${s.probability}%`}
              onOpenDeal={(d) => {
                const lead = leads.find((l) => l.id === d.id);
                if (lead) onOpen?.(lead);
              }}
              onDropDeal={(id) => move(id, s.id)}
              className="max-h-[560px]"
            />
          );
        })}
      </div>
    </section>
  );
}
