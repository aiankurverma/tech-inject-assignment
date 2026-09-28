import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Shuffle, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { Select, type SelectOption } from "@/components/crm/select";
import { Switch } from "@/components/crm/switch";
import { cn } from "@/lib/utils";

export interface RoutingLead {
  country: string;
  employees: number;
  source: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  /** Empty array = any country. */
  countries: string[];
  minEmployees?: number;
  maxEmployees?: number;
  /** Empty = any source. */
  sources: string[];
  /** Rep ids; more than one = round robin, skipping reps at capacity. */
  assignees: string[];
}

export interface RoutingRep {
  id: string;
  name: string;
  /** Open leads right now. */
  openLeads: number;
  /** Max open leads before the rep is skipped. */
  capacity: number;
  outOfOffice?: boolean;
}

export interface RoutingResult {
  ruleId: string | null;
  repId: string | null;
  reason: string;
}

export interface LeadRoutingProps {
  rules?: RoutingRule[];
  defaultRules?: RoutingRule[];
  onRulesChange?: (rules: RoutingRule[]) => void;
  reps: RoutingRep[];
  /** Owner when nothing matches or every assignee is full. */
  fallbackRepId: string;
  countries: SelectOption[];
  sources: SelectOption[];
  className?: string;
}

export function ruleMatches(rule: RoutingRule, lead: RoutingLead) {
  if (!rule.enabled) return false;
  if (rule.countries.length && !rule.countries.includes(lead.country)) return false;
  if (rule.sources.length && !rule.sources.includes(lead.source)) return false;
  if (rule.minEmployees !== undefined && lead.employees < rule.minEmployees) return false;
  if (rule.maxEmployees !== undefined && lead.employees > rule.maxEmployees) return false;
  return true;
}

/**
 * First matching rule wins. Among its assignees, pick the available rep with the lowest
 * load ratio (open / capacity); ties go to the rep listed first.
 */
export function routeLead(
  lead: RoutingLead,
  rules: RoutingRule[],
  reps: RoutingRep[],
  fallbackRepId: string,
): RoutingResult {
  const rule = rules.find((r) => ruleMatches(r, lead));
  if (!rule)
    return { ruleId: null, repId: fallbackRepId, reason: "No rule matched, fallback owner" };
  const pool = rule.assignees
    .map((id) => reps.find((r) => r.id === id))
    .filter((r): r is RoutingRep => !!r && !r.outOfOffice && r.openLeads < r.capacity);
  if (!pool.length)
    return {
      ruleId: rule.id,
      repId: fallbackRepId,
      reason: "All assignees full or away, fallback owner",
    };
  const best = pool.reduce((a, b) => (b.openLeads / b.capacity < a.openLeads / a.capacity ? b : a));
  return {
    ruleId: rule.id,
    repId: best.id,
    reason: pool.length > 1 ? `Round robin, lowest load of ${pool.length}` : "Single assignee",
  };
}

let seq = 0;
const uid = () => `rule_${Date.now().toString(36)}_${(seq++).toString(36)}`;

function MultiToggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SelectOption[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              "cursor-pointer rounded-full border px-2 py-0.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              on
                ? "border-tag-blue-border bg-tag-blue-bg text-tag-blue-text"
                : "border-crm-border text-crm-subtle hover:text-crm-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Ordered first-match lead assignment rules with capacity-aware round robin and a live test panel. */
export function LeadRouting({
  rules,
  defaultRules = [],
  onRulesChange,
  reps,
  fallbackRepId,
  countries,
  sources,
  className,
}: LeadRoutingProps) {
  const [inner, setInner] = React.useState(defaultRules);
  const list = rules ?? inner;
  const set = (next: RoutingRule[]) => {
    if (rules === undefined) setInner(next);
    onRulesChange?.(next);
  };
  const patch = (id: string, p: Partial<RoutingRule>) =>
    set(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set(next);
  };
  const [test, setTest] = React.useState<RoutingLead>({
    country: countries[0]?.value ?? "",
    employees: 1200,
    source: sources[0]?.value ?? "",
  });
  const result = routeLead(test, list, reps, fallbackRepId);
  const repName = (id: string | null) => reps.find((r) => r.id === id)?.name ?? "Unassigned";
  const repOptions = reps.map((r) => ({
    value: r.id,
    label: `${r.name}${r.outOfOffice ? " (OOO)" : ""} · ${r.openLeads}/${r.capacity}`,
  }));

  return (
    <div
      className={cn(
        "grid gap-3 rounded-crm border border-crm-border bg-crm-card p-3 font-crm lg:grid-cols-[1fr_300px]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="crm-eyebrow text-crm-subtle">Rules · first match wins</span>
          <Button
            size="sm"
            onClick={() =>
              set([
                ...list,
                {
                  id: uid(),
                  name: `Rule ${list.length + 1}`,
                  enabled: true,
                  countries: [],
                  sources: [],
                  assignees: [],
                },
              ])
            }
          >
            <Plus /> Rule
          </Button>
        </div>
        {list.length === 0 ? (
          <p className="rounded-crm border border-dashed border-crm-border p-4 text-center text-xs text-crm-subtle">
            No rules. Every lead goes to {repName(fallbackRepId)}.
          </p>
        ) : null}
        <ol className="flex flex-col gap-1.5">
          {list.map((r, i) => {
            const hit = result.ruleId === r.id;
            const noAssignee = r.assignees.length === 0;
            return (
              <li
                key={r.id}
                className={cn(
                  "flex flex-col gap-2 rounded-crm border bg-crm-raised p-2.5 transition-colors",
                  hit ? "border-crm-primary" : "border-crm-border",
                  !r.enabled && "opacity-60",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-crm-subtle tabular-nums">#{i + 1}</span>
                  <Input
                    aria-label="Rule name"
                    value={r.name}
                    onChange={(e) => patch(r.id, { name: e.target.value })}
                    className="h-8 max-w-[220px] flex-1"
                  />
                  {hit ? (
                    <span className="rounded-full bg-crm-primary/20 px-2 py-0.5 text-xs text-crm-fg">
                      Test match
                    </span>
                  ) : null}
                  <div className="ml-auto flex items-center gap-0.5">
                    <Switch
                      size="sm"
                      aria-label={`Enable ${r.name}`}
                      checked={r.enabled}
                      onCheckedChange={(v) => patch(r.id, { enabled: v })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Move down"
                      disabled={i === list.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${r.name}`}
                      onClick={() => set(list.filter((x) => x.id !== r.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-[90px_1fr] sm:items-center">
                  <span className="text-crm-soft">Country</span>
                  <MultiToggle
                    label="Countries"
                    options={countries}
                    value={r.countries}
                    onChange={(v) => patch(r.id, { countries: v })}
                  />
                  <span className="text-crm-soft">Source</span>
                  <MultiToggle
                    label="Sources"
                    options={sources}
                    value={r.sources}
                    onChange={(v) => patch(r.id, { sources: v })}
                  />
                  <span className="text-crm-soft">Employees</span>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Min employees"
                      type="number"
                      min={0}
                      placeholder="Min"
                      className="h-8 w-24"
                      value={r.minEmployees ?? ""}
                      onChange={(e) =>
                        patch(r.id, {
                          minEmployees: e.target.value === "" ? undefined : e.target.valueAsNumber,
                        })
                      }
                    />
                    <span className="text-crm-subtle">to</span>
                    <Input
                      aria-label="Max employees"
                      type="number"
                      min={0}
                      placeholder="Max"
                      className="h-8 w-24"
                      value={r.maxEmployees ?? ""}
                      invalid={
                        r.minEmployees !== undefined &&
                        r.maxEmployees !== undefined &&
                        r.maxEmployees < r.minEmployees
                      }
                      onChange={(e) =>
                        patch(r.id, {
                          maxEmployees: e.target.value === "" ? undefined : e.target.valueAsNumber,
                        })
                      }
                    />
                  </div>
                  <span className="text-crm-soft">Assign to</span>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap gap-1">
                      {r.assignees.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full border border-crm-border bg-crm-muted px-2 py-0.5 text-crm-fg"
                        >
                          {repName(id)}
                          <button
                            type="button"
                            aria-label={`Remove ${repName(id)}`}
                            className="cursor-pointer text-crm-subtle hover:text-crm-fg"
                            onClick={() =>
                              patch(r.id, { assignees: r.assignees.filter((a) => a !== id) })
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {r.assignees.length > 1 ? (
                        <span className="inline-flex items-center gap-1 text-crm-subtle">
                          <Shuffle className="size-3" aria-hidden /> round robin
                        </span>
                      ) : null}
                    </div>
                    <Select
                      aria-label="Add assignee"
                      placeholder="Add rep..."
                      className="h-8"
                      value=""
                      options={repOptions.filter((o) => !r.assignees.includes(o.value))}
                      onValueChange={(v) => patch(r.id, { assignees: [...r.assignees, v] })}
                    />
                    {noAssignee ? (
                      <span className="text-crm-warning">No assignee: matches go to fallback.</span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-crm-subtle">
          Unmatched leads go to <span className="text-crm-soft">{repName(fallbackRepId)}</span>.
        </p>
      </div>

      <aside
        aria-label="Test a lead"
        className="flex h-fit flex-col gap-3 rounded-crm bg-crm-raised p-3 shadow-crm-raised"
      >
        <span className="crm-eyebrow text-crm-subtle">Test a lead</span>
        <Select
          aria-label="Test country"
          options={countries}
          value={test.country}
          onValueChange={(v) => setTest({ ...test, country: v })}
        />
        <Select
          aria-label="Test source"
          options={sources}
          value={test.source}
          onValueChange={(v) => setTest({ ...test, source: v })}
        />
        <Input
          aria-label="Test employees"
          type="number"
          min={1}
          value={test.employees}
          onChange={(e) => setTest({ ...test, employees: e.target.valueAsNumber || 0 })}
        />
        <div aria-live="polite" className="flex flex-col gap-1 border-t border-crm-border pt-3">
          <span className="flex items-center gap-2 text-sm font-medium text-crm-fg">
            <UserRound className="size-4 text-crm-icon" aria-hidden />
            {repName(result.repId)}
          </span>
          <span className="text-xs text-crm-soft">
            {result.ruleId
              ? `via ${list.find((r) => r.id === result.ruleId)?.name}`
              : "no rule matched"}
          </span>
          <span className="text-xs text-crm-subtle">{result.reason}</span>
        </div>
        <ul className="flex flex-col gap-1.5 border-t border-crm-border pt-3" aria-label="Rep load">
          {reps.map((r) => {
            const pct = Math.min(100, Math.round((r.openLeads / r.capacity) * 100));
            return (
              <li key={r.id} className="flex flex-col gap-1 text-xs">
                <span className="flex justify-between text-crm-soft">
                  <span>
                    {r.name}
                    {r.outOfOffice ? " · OOO" : ""}
                  </span>
                  <span className="tabular-nums">
                    {r.openLeads}/{r.capacity}
                  </span>
                </span>
                <span className="h-1 overflow-hidden rounded-full bg-crm-track">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      pct >= 100
                        ? "bg-crm-danger"
                        : pct >= 80
                          ? "bg-crm-warning"
                          : "bg-crm-success",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
