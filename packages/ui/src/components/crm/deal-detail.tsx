import * as React from "react";
import { Building2, CalendarDays, Plus, Trash2, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PipelineStageBar, type PipelineStage } from "@/components/crm/pipeline-stage-bar";
import { DescriptionList } from "@/components/crm/description-list";
import { ActivityTimeline, type Activity } from "@/components/crm/activity-timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/crm/tabs";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Tag } from "@/components/crm/tag";

export interface DealLineItem {
  id: string;
  product: string;
  quantity: number;
  unitPrice: number;
  /** Percentage discount 0–100. */
  discount?: number;
}

export interface DealStakeholder {
  id: string;
  name: string;
  title: string;
  role: "Champion" | "Decision maker" | "Economic buyer" | "Blocker" | "Influencer";
}

export interface DealRecord {
  id: string;
  name: string;
  company: string;
  owner: string;
  currency?: string;
  /** ISO date. */
  closeDate: string;
  source?: string;
  nextStep?: string;
  stage: string;
  outcome?: "won" | "lost";
  lostReason?: string;
  lineItems: DealLineItem[];
  stakeholders?: DealStakeholder[];
  activities?: Activity[];
}

export interface DealDetailProps {
  /** Initial record; the component keeps its own edits (change `key` to reset). */
  deal: DealRecord;
  stages: PipelineStage[];
  /** Fires with the updated record on any change (stage, outcome, line items). */
  onChange?: (deal: DealRecord) => void;
  lostReasons?: string[];
  /** Disables every edit control. */
  readOnly?: boolean;
  className?: string;
}

const roleColor = {
  Champion: "green",
  "Decision maker": "purple",
  "Economic buyer": "blue",
  Blocker: "red",
  Influencer: "neutral",
} as const;

export function lineTotal(li: DealLineItem) {
  return li.quantity * li.unitPrice * (1 - Math.min(100, Math.max(0, li.discount ?? 0)) / 100);
}

/**
 * Deal record page: clickable stage bar, close won / lost with a required reason,
 * editable line items with computed totals, stakeholders map and activity feed.
 */
export function DealDetail({
  deal: dealProp,
  stages,
  onChange,
  lostReasons = ["Price", "Chose competitor", "No budget", "No decision", "Timing"],
  readOnly,
  className,
}: DealDetailProps) {
  const [deal, setDeal] = React.useState(dealProp);
  const [closing, setClosing] = React.useState<null | "lost">(null);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState(false);
  const currency = deal.currency ?? "USD";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);

  const update = (patch: Partial<DealRecord>) => {
    const next = { ...deal, ...patch };
    setDeal(next);
    onChange?.(next);
  };
  const updateItem = (id: string, patch: Partial<DealLineItem>) =>
    update({ lineItems: deal.lineItems.map((li) => (li.id === id ? { ...li, ...patch } : li)) });

  const subtotal = deal.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const total = deal.lineItems.reduce((s, li) => s + lineTotal(li), 0);
  const discount = subtotal - total;
  const closed = !!deal.outcome;
  const daysToClose = Math.round(
    (new Date(`${deal.closeDate}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) /
      86_400_000,
  );

  const num =
    "h-7 w-full rounded-crm border border-crm-border bg-crm-raised px-2 text-right text-xs text-crm-fg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-60";

  return (
    <article className={cn("flex min-w-0 flex-col gap-4 font-crm text-crm-fg", className)}>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="crm-eyebrow flex items-center gap-1.5 text-crm-subtle">
            <Building2 className="size-3" aria-hidden /> {deal.company}
          </p>
          <h1 className="mt-1 truncate text-lg font-medium">{deal.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-crm-soft">
            <span className="text-base text-crm-fg tabular-nums">{fmt(total)}</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" aria-hidden />
              {closed ? (
                "Closed"
              ) : daysToClose < 0 ? (
                <span className="text-crm-danger">{-daysToClose}d overdue</span>
              ) : (
                `Closes in ${daysToClose}d`
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <Avatar name={deal.owner} size="xs" /> {deal.owner}
            </span>
            {deal.outcome ? (
              <Tag size="sm" color={deal.outcome === "won" ? "green" : "red"}>
                {deal.outcome === "won" ? "Won" : `Lost · ${deal.lostReason ?? ""}`}
              </Tag>
            ) : null}
          </p>
        </div>
        {!readOnly ? (
          <div className="flex gap-2">
            {closed ? (
              <Button
                variant="secondary"
                onClick={() => update({ outcome: undefined, lostReason: undefined })}
              >
                Reopen
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() =>
                    update({ outcome: "won", stage: stages[stages.length - 1]?.id ?? deal.stage })
                  }
                >
                  <Trophy className="size-3.5" aria-hidden /> Mark won
                </Button>
                <Button variant="danger" onClick={() => setClosing("lost")}>
                  <XCircle className="size-3.5" aria-hidden /> Mark lost
                </Button>
              </>
            )}
          </div>
        ) : null}
      </header>

      {closing === "lost" ? (
        <form
          aria-label="Close deal as lost"
          className="flex flex-wrap items-end gap-2 rounded-crm border border-crm-border bg-crm-raised p-3 shadow-crm-raised"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return setReasonError(true);
            update({ outcome: "lost", lostReason: reason });
            setClosing(null);
            setReason("");
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Lost reason (required)
            <select
              value={reason}
              aria-invalid={reasonError || undefined}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(false);
              }}
              className={cn(
                "h-7 rounded-crm border bg-crm-card px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                reasonError ? "border-crm-danger" : "border-crm-border",
              )}
            >
              <option value="">Choose…</option>
              {lostReasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="danger" size="sm">
            Close as lost
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setClosing(null)}>
            Cancel
          </Button>
          {reasonError ? (
            <p role="alert" className="w-full text-xs text-crm-danger">
              Pick a reason so win/loss reporting stays accurate.
            </p>
          ) : null}
        </form>
      ) : null}

      <PipelineStageBar
        stages={stages}
        current={deal.stage}
        outcome={deal.outcome}
        onStageChange={readOnly || closed ? undefined : (id) => update({ stage: id })}
      />

      <Tabs defaultValue="items" className="rounded-crm border border-crm-border bg-crm-bg">
        <TabsList>
          <TabsTrigger value="items">Line items ({deal.lineItems.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="people">Stakeholders ({deal.stakeholders?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm" aria-label="Line items">
              <thead>
                <tr className="crm-caption text-left text-crm-subtle">
                  <th className="pb-2 font-normal">Product</th>
                  <th className="w-20 pb-2 text-right font-normal">Qty</th>
                  <th className="w-28 pb-2 text-right font-normal">Unit price</th>
                  <th className="w-20 pb-2 text-right font-normal">Disc. %</th>
                  <th className="w-28 pb-2 text-right font-normal">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {deal.lineItems.map((li) => (
                  <tr key={li.id} className="border-t border-crm-border">
                    <td className="py-2 pr-2">
                      <input
                        aria-label="Product"
                        value={li.product}
                        disabled={readOnly || closed}
                        onChange={(e) => updateItem(li.id, { product: e.target.value })}
                        className="h-7 w-full rounded-crm border border-transparent bg-transparent px-1 text-sm text-crm-fg outline-none hover:border-crm-border focus-visible:border-crm-border focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        aria-label={`Quantity for ${li.product}`}
                        type="number"
                        min={1}
                        value={li.quantity}
                        disabled={readOnly || closed}
                        onChange={(e) =>
                          updateItem(li.id, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className={num}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        aria-label={`Unit price for ${li.product}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.unitPrice}
                        disabled={readOnly || closed}
                        onChange={(e) =>
                          updateItem(li.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className={num}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        aria-label={`Discount for ${li.product}`}
                        type="number"
                        min={0}
                        max={100}
                        value={li.discount ?? 0}
                        disabled={readOnly || closed}
                        onChange={(e) =>
                          updateItem(li.id, {
                            discount: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                          })
                        }
                        className={num}
                      />
                    </td>
                    <td className="py-2 text-right tabular-nums">{fmt(lineTotal(li))}</td>
                    <td className="py-2 pl-1">
                      {!readOnly && !closed ? (
                        <button
                          type="button"
                          aria-label={`Remove ${li.product}`}
                          onClick={() =>
                            update({ lineItems: deal.lineItems.filter((x) => x.id !== li.id) })
                          }
                          className="grid size-6 cursor-pointer place-items-center rounded-full text-crm-subtle hover:bg-crm-muted hover:text-crm-danger focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!deal.lineItems.length ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-crm-subtle">
                      No products yet — the deal amount is $0.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            {!readOnly && !closed ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  update({
                    lineItems: [
                      ...deal.lineItems,
                      { id: `li-${Date.now()}`, product: "New product", quantity: 1, unitPrice: 0 },
                    ],
                  })
                }
              >
                <Plus className="size-3.5" aria-hidden /> Add line item
              </Button>
            ) : (
              <span />
            )}
            <dl className="grid min-w-48 grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <dt className="text-crm-subtle">Subtotal</dt>
              <dd className="text-right tabular-nums">{fmt(subtotal)}</dd>
              <dt className="text-crm-subtle">Discounts</dt>
              <dd className="text-right text-crm-success tabular-nums">−{fmt(discount)}</dd>
              <dt className="font-medium">Total</dt>
              <dd className="text-right font-medium tabular-nums">{fmt(total)}</dd>
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="details" className="p-4">
          <DescriptionList
            columns={2}
            items={[
              { label: "Company", value: deal.company },
              { label: "Owner", value: deal.owner },
              {
                label: "Close date",
                value: new Date(`${deal.closeDate}T00:00:00`).toLocaleDateString("en-US", {
                  dateStyle: "medium",
                }),
              },
              { label: "Source", value: deal.source },
              { label: "Currency", value: currency },
              { label: "Next step", value: deal.nextStep, fullWidth: true },
            ]}
          />
        </TabsContent>

        <TabsContent value="people" className="p-4">
          {deal.stakeholders?.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {deal.stakeholders.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-crm border border-crm-border bg-crm-card p-3"
                >
                  <Avatar name={p.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-crm-subtle">{p.title}</p>
                  </div>
                  <Tag size="sm" color={roleColor[p.role]}>
                    {p.role}
                  </Tag>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-xs text-crm-subtle">
              No stakeholders mapped. Deals without a champion close 2× less often.
            </p>
          )}
          {deal.stakeholders?.length && !deal.stakeholders.some((p) => p.role === "Champion") ? (
            <p role="note" className="mt-3 text-xs text-crm-warning">
              No champion identified on this deal.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="activity" className="p-4">
          {deal.activities?.length ? (
            <ActivityTimeline items={deal.activities} />
          ) : (
            <p className="py-6 text-center text-xs text-crm-subtle">No activity logged yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </article>
  );
}
