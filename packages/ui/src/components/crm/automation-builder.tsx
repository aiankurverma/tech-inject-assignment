import * as React from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock,
  GitBranch,
  Plus,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { Select, type SelectOption } from "@/components/crm/select";
import { Switch } from "@/components/crm/switch";
import { cn } from "@/lib/utils";

export type AutomationStep =
  | {
      id: string;
      kind: "condition";
      field: string;
      operator: "is" | "is_not" | "gt" | "lt";
      value: string;
    }
  | { id: string; kind: "delay"; amount: number; unit: "minutes" | "hours" | "days" }
  | { id: string; kind: "action"; action: string; target: string };

export interface Automation {
  name: string;
  enabled: boolean;
  trigger: string;
  steps: AutomationStep[];
}

export interface AutomationBuilderProps {
  value?: Automation;
  defaultValue?: Automation;
  onChange?: (value: Automation) => void;
  /** Available triggers, e.g. "Deal stage changed". */
  triggers: SelectOption[];
  /** Record fields usable in conditions. */
  fields: SelectOption[];
  /** Actions with a label for their target input, e.g. { value: "email", label: "Send email", targetLabel: "Template" }. */
  actions: (SelectOption & { targetLabel: string; targetOptions?: SelectOption[] })[];
  /** Max steps allowed (plan limit). */
  maxSteps?: number;
  onSave?: (value: Automation) => void;
  saving?: boolean;
  readOnly?: boolean;
  className?: string;
}

const OPERATORS: SelectOption[] = [
  { value: "is", label: "is" },
  { value: "is_not", label: "is not" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
];
const UNITS: SelectOption[] = [
  { value: "minutes", label: "minutes" },
  { value: "hours", label: "hours" },
  { value: "days", label: "days" },
];
const UNIT_MIN = { minutes: 1, hours: 60, days: 1440 } as const;

const KIND_META: Record<AutomationStep["kind"], { label: string; icon: LucideIcon; tone: string }> =
  {
    condition: { label: "If", icon: GitBranch, tone: "text-tag-amber-text bg-tag-amber-bg" },
    delay: { label: "Wait", icon: Clock, tone: "text-tag-blue-text bg-tag-blue-bg" },
    action: { label: "Then", icon: Zap, tone: "text-tag-green-text bg-tag-green-bg" },
  };

let seq = 0;
const uid = () => `step_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Returns a problem message per step id (empty object = valid). */
export function validateAutomation(a: Automation): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!a.trigger) errs.trigger = "Choose a trigger.";
  if (!a.name.trim()) errs.name = "Name the automation.";
  if (!a.steps.some((s) => s.kind === "action")) errs.steps = "Add at least one action.";
  a.steps.forEach((s, i) => {
    if (s.kind === "condition" && (!s.field || !s.value.trim()))
      errs[s.id] = "Pick a field and value.";
    if (s.kind === "delay" && (!Number.isFinite(s.amount) || s.amount <= 0))
      errs[s.id] = "Delay must be greater than 0.";
    if (s.kind === "delay" && i === a.steps.length - 1)
      errs[s.id] = "A delay at the end does nothing.";
    if (s.kind === "action" && (!s.action || !s.target.trim()))
      errs[s.id] = "Pick an action and target.";
  });
  return errs;
}

function formatDuration(mins: number) {
  if (mins === 0) return "immediately";
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ");
}

/** Trigger → conditions / delays / actions editor with validation, reordering and a run-time summary. */
export function AutomationBuilder({
  value,
  defaultValue,
  onChange,
  triggers,
  fields,
  actions,
  maxSteps = 12,
  onSave,
  saving,
  readOnly,
  className,
}: AutomationBuilderProps) {
  const [inner, setInner] = React.useState<Automation>(
    defaultValue ?? { name: "", enabled: false, trigger: "", steps: [] },
  );
  const auto = value ?? inner;
  const set = (next: Automation) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };
  const errors = validateAutomation(auto);
  const valid = Object.keys(errors).length === 0;
  const [showErrors, setShowErrors] = React.useState(false);

  const updateStep = (id: string, patch: Partial<AutomationStep>) =>
    set({
      ...auto,
      steps: auto.steps.map((s) => (s.id === id ? ({ ...s, ...patch } as AutomationStep) : s)),
    });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= auto.steps.length) return;
    const steps = [...auto.steps];
    [steps[i], steps[j]] = [steps[j]!, steps[i]!];
    set({ ...auto, steps });
  };
  const add = (kind: AutomationStep["kind"]) => {
    if (auto.steps.length >= maxSteps) return;
    const step: AutomationStep =
      kind === "condition"
        ? { id: uid(), kind, field: "", operator: "is", value: "" }
        : kind === "delay"
          ? { id: uid(), kind, amount: 1, unit: "days" }
          : { id: uid(), kind, action: "", target: "" };
    set({ ...auto, steps: [...auto.steps, step] });
  };

  const totalWait = auto.steps.reduce(
    (sum, s) => (s.kind === "delay" && s.amount > 0 ? sum + s.amount * UNIT_MIN[s.unit] : sum),
    0,
  );
  const actionCount = auto.steps.filter((s) => s.kind === "action").length;
  const ro = readOnly || saving;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Automation name"
          placeholder="Untitled automation"
          value={auto.name}
          disabled={ro}
          invalid={showErrors && !!errors.name}
          onChange={(e) => set({ ...auto, name: e.target.value })}
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        <div className="ml-auto flex items-center gap-3">
          <Switch
            size="sm"
            label={auto.enabled ? "Live" : "Paused"}
            checked={auto.enabled}
            disabled={ro || (!valid && !auto.enabled)}
            onCheckedChange={(on) => set({ ...auto, enabled: on })}
          />
          {onSave ? (
            <Button
              variant="primary"
              loading={saving}
              disabled={readOnly}
              onClick={() => {
                setShowErrors(true);
                if (valid) onSave(auto);
              }}
            >
              Save
            </Button>
          ) : null}
        </div>
      </div>

      <ol className="flex flex-col" aria-label="Automation steps">
        <li className="flex flex-col gap-2 rounded-crm bg-crm-raised p-3 shadow-crm-raised">
          <span className="crm-eyebrow text-crm-subtle">When</span>
          <Select
            aria-label="Trigger"
            options={triggers}
            value={auto.trigger || undefined}
            placeholder="Choose a trigger..."
            disabled={ro}
            invalid={showErrors && !!errors.trigger}
            onValueChange={(v) => set({ ...auto, trigger: v })}
          />
        </li>
        {auto.steps.map((s, i) => {
          const meta = KIND_META[s.kind];
          const Icon = meta.icon;
          const err = errors[s.id];
          const act = s.kind === "action" ? actions.find((a) => a.value === s.action) : undefined;
          return (
            <li key={s.id} className="flex flex-col">
              <span aria-hidden className="ml-5 h-4 w-px bg-crm-border" />
              <div
                className={cn(
                  "flex flex-col gap-2 rounded-crm border bg-crm-raised p-3",
                  showErrors && err ? "border-crm-danger/60" : "border-crm-border",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      meta.tone,
                    )}
                  >
                    <Icon className="size-3" aria-hidden />
                    {meta.label}
                  </span>
                  <span className="text-xs text-crm-subtle">Step {i + 1}</span>
                  {!ro ? (
                    <div className="ml-auto flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Move step ${i + 1} up`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Move step ${i + 1} down`}
                        disabled={i === auto.steps.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove step ${i + 1}`}
                        onClick={() =>
                          set({ ...auto, steps: auto.steps.filter((x) => x.id !== s.id) })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {s.kind === "condition" ? (
                    <>
                      <Select
                        aria-label="Field"
                        options={fields}
                        value={s.field || undefined}
                        placeholder="Field"
                        disabled={ro}
                        onValueChange={(v) => updateStep(s.id, { field: v })}
                      />
                      <Select
                        aria-label="Operator"
                        options={OPERATORS}
                        value={s.operator}
                        disabled={ro}
                        onValueChange={(v) =>
                          updateStep(s.id, { operator: v as "is" | "is_not" | "gt" | "lt" })
                        }
                      />
                      <Input
                        aria-label="Value"
                        placeholder="Value"
                        value={s.value}
                        disabled={ro}
                        onChange={(e) => updateStep(s.id, { value: e.target.value })}
                      />
                    </>
                  ) : s.kind === "delay" ? (
                    <>
                      <Input
                        aria-label="Delay amount"
                        type="number"
                        min={1}
                        value={Number.isFinite(s.amount) ? s.amount : ""}
                        disabled={ro}
                        onChange={(e) => updateStep(s.id, { amount: e.target.valueAsNumber })}
                      />
                      <Select
                        aria-label="Delay unit"
                        options={UNITS}
                        value={s.unit}
                        disabled={ro}
                        onValueChange={(v) =>
                          updateStep(s.id, { unit: v as "minutes" | "hours" | "days" })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Select
                        aria-label="Action"
                        options={actions}
                        value={s.action || undefined}
                        placeholder="Action"
                        disabled={ro}
                        onValueChange={(v) => updateStep(s.id, { action: v, target: "" })}
                      />
                      {act?.targetOptions ? (
                        <Select
                          aria-label={act.targetLabel}
                          className="sm:col-span-2"
                          options={act.targetOptions}
                          value={s.target || undefined}
                          placeholder={act.targetLabel}
                          disabled={ro}
                          onValueChange={(v) => updateStep(s.id, { target: v })}
                        />
                      ) : (
                        <Input
                          aria-label={act?.targetLabel ?? "Target"}
                          className="sm:col-span-2"
                          placeholder={act?.targetLabel ?? "Choose an action first"}
                          value={s.target}
                          disabled={ro || !act}
                          onChange={(e) => updateStep(s.id, { target: e.target.value })}
                        />
                      )}
                    </>
                  )}
                </div>
                {showErrors && err ? (
                  <p role="alert" className="text-xs text-crm-danger">
                    {err}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {!ro ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => add("condition")}
            disabled={auto.steps.length >= maxSteps}
          >
            <Plus /> Condition
          </Button>
          <Button size="sm" onClick={() => add("delay")} disabled={auto.steps.length >= maxSteps}>
            <Plus /> Delay
          </Button>
          <Button size="sm" onClick={() => add("action")} disabled={auto.steps.length >= maxSteps}>
            <Plus /> Action
          </Button>
          <span className="ml-auto text-xs text-crm-subtle tabular-nums">
            {auto.steps.length}/{maxSteps} steps
          </span>
        </div>
      ) : null}

      <div
        aria-live="polite"
        className="flex flex-wrap items-center gap-2 border-t border-crm-border pt-3 text-xs text-crm-soft"
      >
        {valid ? (
          <span>
            Runs {actionCount} action{actionCount === 1 ? "" : "s"}, finishing{" "}
            {totalWait ? `${formatDuration(totalWait)} after` : "immediately on"} the trigger.
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-crm-warning">
            <AlertTriangle className="size-3.5" aria-hidden />
            {Object.keys(errors).length} issue{Object.keys(errors).length === 1 ? "" : "s"} to fix
            before this can go live{errors.steps ? `: ${errors.steps}` : "."}
          </span>
        )}
      </div>
    </div>
  );
}
