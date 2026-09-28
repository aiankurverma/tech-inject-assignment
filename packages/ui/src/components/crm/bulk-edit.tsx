import * as React from "react";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { Select, type SelectOption } from "@/components/crm/select";
import { cn } from "@/lib/utils";

export type BulkFieldType = "text" | "number" | "currency" | "select" | "tags";

export interface BulkField {
  key: string;
  label: string;
  type: BulkFieldType;
  options?: SelectOption[];
  /** Cannot be emptied. */
  required?: boolean;
}

export interface BulkRecord {
  id: string;
  name: string;
  values: Record<string, string | number | string[] | undefined>;
  /** Records the user can't edit (closed, other team). Skipped with the reason. */
  lockedReason?: string;
}

export type BulkOperation =
  "set" | "clear" | "add_tag" | "remove_tag" | "increase_pct" | "decrease_pct";

export interface BulkChange {
  id: string;
  field: string;
  before: BulkRecord["values"][string];
  after: BulkRecord["values"][string];
}

export interface BulkEditProps {
  records: BulkRecord[];
  fields: BulkField[];
  currency?: string;
  onApply: (changes: BulkChange[]) => void | Promise<void>;
  onCancel?: () => void;
  /** Rows shown in the preview. */
  previewLimit?: number;
  className?: string;
}

const OPS: Record<BulkFieldType, { value: BulkOperation; label: string }[]> = {
  text: [
    { value: "set", label: "Set to" },
    { value: "clear", label: "Clear" },
  ],
  select: [
    { value: "set", label: "Set to" },
    { value: "clear", label: "Clear" },
  ],
  number: [
    { value: "set", label: "Set to" },
    { value: "increase_pct", label: "Increase by %" },
    { value: "decrease_pct", label: "Decrease by %" },
    { value: "clear", label: "Clear" },
  ],
  currency: [
    { value: "set", label: "Set to" },
    { value: "increase_pct", label: "Increase by %" },
    { value: "decrease_pct", label: "Decrease by %" },
    { value: "clear", label: "Clear" },
  ],
  tags: [
    { value: "add_tag", label: "Add tag" },
    { value: "remove_tag", label: "Remove tag" },
    { value: "set", label: "Replace all with" },
    { value: "clear", label: "Remove all" },
  ],
};

/** Compute the new value for one record. Returns undefined-safe results; money rounds to cents. */
export function applyBulkOperation(
  field: BulkField,
  op: BulkOperation,
  input: string,
  current: BulkRecord["values"][string],
): BulkRecord["values"][string] {
  if (op === "clear") return field.type === "tags" ? [] : undefined;
  if (field.type === "tags") {
    const tags = Array.isArray(current) ? current : [];
    const t = input.trim();
    if (op === "add_tag") return tags.includes(t) ? tags : [...tags, t];
    if (op === "remove_tag") return tags.filter((x) => x !== t);
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (field.type === "number" || field.type === "currency") {
    const n = Number(input);
    if (op === "set") return n;
    const base = typeof current === "number" ? current : 0;
    const next = base * (1 + ((op === "increase_pct" ? 1 : -1) * n) / 100);
    return field.type === "currency"
      ? Math.round(next * 100) / 100
      : Math.round(next * 1000) / 1000;
  }
  return input;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Field-level bulk update with type-aware operations, a before/after diff preview and locked-record handling. */
export function BulkEdit({
  records,
  fields,
  currency = "USD",
  onApply,
  onCancel,
  previewLimit = 6,
  className,
}: BulkEditProps) {
  const [fieldKey, setFieldKey] = React.useState(fields[0]?.key ?? "");
  const field = fields.find((f) => f.key === fieldKey);
  const [op, setOp] = React.useState<BulkOperation>(OPS[field?.type ?? "text"][0]!.value);
  const [input, setInput] = React.useState("");
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency });

  const needsInput = op !== "clear";
  const inputError = (() => {
    if (!field) return "Choose a field";
    if (op === "clear" && field.required) return `${field.label} is required and can't be cleared`;
    if (!needsInput) return null;
    if (!input.trim()) return "Enter a value";
    if ((field.type === "number" || field.type === "currency") && Number.isNaN(Number(input)))
      return "Enter a number";
    if (
      (op === "increase_pct" || op === "decrease_pct") &&
      (Number(input) <= 0 || Number(input) > 100)
    )
      return "Percent must be between 0 and 100";
    return null;
  })();

  const editable = records.filter((r) => !r.lockedReason);
  const locked = records.filter((r) => r.lockedReason);
  const changes: BulkChange[] =
    field && !inputError
      ? editable
          .map((r) => ({
            id: r.id,
            field: field.key,
            before: r.values[field.key],
            after: applyBulkOperation(field, op, input, r.values[field.key]),
          }))
          .filter((c) => !same(c.before, c.after))
      : [];
  const unchanged = field && !inputError ? editable.length - changes.length : 0;

  const show = (v: BulkRecord["values"][string]) => {
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return "—";
    if (Array.isArray(v)) return v.join(", ");
    if (field?.type === "currency" && typeof v === "number") return money.format(v);
    if (field?.type === "select")
      return field.options?.find((o) => o.value === v)?.label ?? String(v);
    return String(v);
  };
  const delta =
    field?.type === "currency"
      ? changes.reduce(
          (s, c) =>
            s +
            ((typeof c.after === "number" ? c.after : 0) -
              (typeof c.before === "number" ? c.before : 0)),
          0,
        )
      : null;

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      await onApply(changes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm",
        className,
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-crm-fg">Edit {records.length} records</span>
        {locked.length ? (
          <span className="text-xs text-crm-warning">{locked.length} locked</span>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr]">
        <Select
          aria-label="Field"
          options={fields.map((f) => ({ value: f.key, label: f.label }))}
          value={fieldKey}
          onValueChange={(v) => {
            const f = fields.find((x) => x.key === v);
            setFieldKey(v);
            setOp(OPS[f?.type ?? "text"][0]!.value);
            setInput("");
          }}
        />
        <Select
          aria-label="Operation"
          options={OPS[field?.type ?? "text"]}
          value={op}
          onValueChange={(v) => setOp(v as BulkOperation)}
        />
        {needsInput ? (
          field?.type === "select" ? (
            <Select
              aria-label="New value"
              options={field.options ?? []}
              value={input || undefined}
              placeholder="Choose value"
              onValueChange={setInput}
            />
          ) : (
            <Input
              aria-label="New value"
              type={field?.type === "number" || field?.type === "currency" ? "number" : "text"}
              prefix={op.endsWith("_pct") ? "%" : field?.type === "currency" ? "$" : undefined}
              placeholder={field?.type === "tags" && op === "set" ? "tag-a, tag-b" : "Value"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          )
        ) : (
          <span className="flex items-center text-xs text-crm-subtle">Value will be emptied</span>
        )}
      </div>
      {inputError && (input || op === "clear") ? (
        <p role="alert" className="-mt-2 text-xs text-crm-danger">
          {inputError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-crm-soft"
          aria-live="polite"
        >
          <span className="crm-eyebrow text-crm-subtle">Preview</span>
          <span>{changes.length} will change</span>
          {unchanged ? <span>{unchanged} already match</span> : null}
          {delta !== null && changes.length ? (
            <span className={delta >= 0 ? "text-crm-success" : "text-crm-danger"}>
              Net {delta >= 0 ? "+" : ""}
              {money.format(delta)}
            </span>
          ) : null}
        </div>
        <ul className="divide-y divide-crm-border rounded-crm border border-crm-border text-sm">
          {changes.length === 0 ? (
            <li className="px-3 py-4 text-center text-xs text-crm-subtle">
              {inputError ? "Complete the edit to preview changes." : "No records would change."}
            </li>
          ) : (
            changes.slice(0, previewLimit).map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 sm:grid-cols-[1.2fr_1fr_auto_1fr]"
              >
                <span className="truncate text-crm-fg">
                  {records.find((r) => r.id === c.id)?.name}
                </span>
                <span className="hidden truncate text-crm-subtle line-through sm:block">
                  {show(c.before)}
                </span>
                <ArrowRight className="hidden size-3.5 text-crm-subtle sm:block" aria-hidden />
                <span className="truncate text-right text-crm-fg sm:text-left">
                  {show(c.after)}
                </span>
              </li>
            ))
          )}
          {changes.length > previewLimit ? (
            <li className="px-3 py-2 text-xs text-crm-subtle">
              +{changes.length - previewLimit} more
            </li>
          ) : null}
        </ul>
        {locked.length ? (
          <details className="text-xs text-crm-soft">
            <summary className="cursor-pointer">
              {locked.length} record{locked.length > 1 ? "s" : ""} will be skipped
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {locked.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <Lock className="size-3 text-crm-subtle" aria-hidden />
                  <span className="text-crm-fg">{r.name}</span>
                  <span className="text-crm-subtle">{r.lockedReason}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-crm bg-crm-danger/10 px-3 py-2 text-xs text-crm-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 border-t border-crm-border pt-3">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={applying}>
            Cancel
          </Button>
        ) : null}
        <Button
          variant="primary"
          loading={applying}
          disabled={!!inputError || changes.length === 0}
          onClick={apply}
        >
          Update {changes.length} record{changes.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}
