import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/crm/button";
import { FormField, Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";
import { Switch } from "@/components/crm/switch";

export type CustomFieldType =
  | "text"
  | "long-text"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "select"
  | "multi-select"
  | "checkbox"
  | "url"
  | "email";

export interface CustomFieldOption {
  id: string;
  label: string;
}

export interface CustomFieldDefinition {
  label: string;
  /** API key, snake_case, unique per object. */
  key: string;
  type: CustomFieldType;
  description?: string;
  required: boolean;
  /** For select / multi-select. */
  options: CustomFieldOption[];
  /** For currency. */
  currency?: string;
  /** For number / currency / percent. */
  min?: number;
  max?: number;
  decimals?: number;
}

export interface CustomFieldEditorProps {
  /** Existing definition to edit; omit to create. */
  initial?: Partial<CustomFieldDefinition>;
  /** Keys already used on this object; used for uniqueness validation. */
  existingKeys?: string[];
  /** True when editing a field that already holds data: key and type become read-only. */
  locked?: boolean;
  onSave: (field: CustomFieldDefinition) => void | Promise<void>;
  onCancel?: () => void;
  objectName?: string;
  className?: string;
}

const typeOptions: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Single-line text" },
  { value: "long-text", label: "Multi-line text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown (single)" },
  { value: "multi-select", label: "Dropdown (multiple)" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
];

const currencies = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"].map((c) => ({
  value: c,
  label: c,
}));

export const toFieldKey = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "f_$1")
    .slice(0, 40);

const isNumeric = (t: CustomFieldType) => t === "number" || t === "currency" || t === "percent";
const isChoice = (t: CustomFieldType) => t === "select" || t === "multi-select";
let seq = 0;
const newId = () => `opt_${Date.now().toString(36)}_${seq++}`;

/** Validates a definition. Returns a map of field → message. */
export function validateField(
  f: CustomFieldDefinition,
  existingKeys: string[] = [],
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.label.trim()) e.label = "Label is required";
  else if (f.label.length > 60) e.label = "Keep labels under 60 characters";
  if (!f.key) e.key = "Key is required";
  else if (!/^[a-z][a-z0-9_]*$/.test(f.key))
    e.key = "Use lowercase letters, digits and underscores; start with a letter";
  else if (existingKeys.includes(f.key)) e.key = `"${f.key}" is already used on this object`;
  if (isChoice(f.type)) {
    const labels = f.options.map((o) => o.label.trim().toLowerCase());
    if (f.options.length < 2) e.options = "Add at least two options";
    else if (labels.some((l) => !l)) e.options = "Options can't be blank";
    else if (new Set(labels).size !== labels.length) e.options = "Options must be unique";
  }
  if (isNumeric(f.type) && f.min != null && f.max != null && f.min > f.max)
    e.range = "Min must be less than max";
  return e;
}

/**
 * Admin editor for defining a custom field: label with auto-generated API key, type, choice options
 * (add / rename / reorder / remove, Enter adds next), number range and precision, currency,
 * required flag, live validation and a preview of the rendered control.
 */
export function CustomFieldEditor({
  initial,
  existingKeys = [],
  locked,
  onSave,
  onCancel,
  objectName = "Deal",
  className,
}: CustomFieldEditorProps) {
  const [f, setF] = React.useState<CustomFieldDefinition>(() => ({
    label: "",
    key: "",
    type: "text",
    required: false,
    options: [],
    decimals: 0,
    currency: "USD",
    ...initial,
  }));
  const [keyTouched, setKeyTouched] = React.useState(!!initial?.key);
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const optRefs = React.useRef<Map<string, HTMLInputElement>>(new Map());
  const focusNext = React.useRef<string | null>(null);
  const uid = React.useId();

  React.useEffect(() => {
    if (focusNext.current) {
      optRefs.current.get(focusNext.current)?.focus();
      focusNext.current = null;
    }
  });

  const otherKeys = existingKeys.filter((k) => k !== initial?.key);
  const errors = validateField(f, otherKeys);
  const show = (k: string) => (submitted || k === "key" ? errors[k] : undefined);
  const patch = (p: Partial<CustomFieldDefinition>) => setF((prev) => ({ ...prev, ...p }));

  const setType = (t: CustomFieldType) => {
    patch({
      type: t,
      options:
        isChoice(t) && f.options.length === 0
          ? [
              { id: newId(), label: "" },
              { id: newId(), label: "" },
            ]
          : f.options,
      decimals: t === "currency" ? 2 : t === "percent" ? 1 : f.decimals,
    });
  };

  const addOption = (after?: number) => {
    const id = newId();
    focusNext.current = id;
    const opts = [...f.options];
    opts.splice(after == null ? opts.length : after + 1, 0, { id, label: "" });
    patch({ options: opts });
  };
  const moveOption = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= f.options.length) return;
    const opts = [...f.options];
    const a = opts[i];
    const b = opts[j];
    if (!a || !b) return;
    opts[i] = b;
    opts[j] = a;
    patch({ options: opts });
    focusNext.current = a.id;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        ...f,
        label: f.label.trim(),
        options: isChoice(f.type) ? f.options.map((o) => ({ ...o, label: o.label.trim() })) : [],
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save field");
    } finally {
      setSaving(false);
    }
  };

  const preview = (() => {
    const pid = `${uid}-preview`;
    const common = { id: pid, disabled: true };
    switch (f.type) {
      case "long-text":
        return (
          <textarea
            {...common}
            rows={2}
            className="w-full rounded-crm border border-crm-input/60 bg-crm-raised px-3 py-2 text-sm"
            placeholder="Enter text"
          />
        );
      case "checkbox":
        return (
          <span className="inline-flex items-center gap-2 text-sm text-crm-soft">
            <span className="size-4 rounded border border-crm-input" /> {f.label || "Checkbox"}
          </span>
        );
      case "select":
      case "multi-select":
        return (
          <div className="flex flex-wrap gap-1">
            {f.options
              .filter((o) => o.label.trim())
              .map((o) => (
                <span
                  key={o.id}
                  className="rounded-full border border-crm-border bg-crm-raised px-2 py-0.5 text-xs text-crm-soft"
                >
                  {o.label}
                </span>
              ))}
            {!f.options.some((o) => o.label.trim()) ? (
              <span className="text-xs text-crm-subtle">No options yet</span>
            ) : null}
          </div>
        );
      case "currency":
        return (
          <Input
            {...common}
            prefix={(0)
              .toLocaleString("en-US", { style: "currency", currency: f.currency ?? "USD" })
              .replace(/[\d.,\s]/g, "")}
            placeholder={(0).toFixed(f.decimals ?? 2)}
          />
        );
      case "percent":
        return <Input {...common} placeholder={`${(0).toFixed(f.decimals ?? 0)} %`} />;
      case "date":
        return <Input {...common} type="date" />;
      default:
        return (
          <Input
            {...common}
            placeholder={
              f.type === "email"
                ? "name@company.com"
                : f.type === "url"
                  ? "https://"
                  : f.type === "number"
                    ? "0"
                    : "Enter text"
            }
          />
        );
    }
  })();

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn(
        "grid gap-6 font-crm text-crm-fg md:grid-cols-[minmax(0,1fr)_260px]",
        className,
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Field label" htmlFor={`${uid}-label`} required error={show("label")}>
            <Input
              id={`${uid}-label`}
              value={f.label}
              maxLength={80}
              invalid={!!show("label")}
              aria-describedby={`${uid}-label-msg`}
              placeholder="e.g. Contract term"
              onChange={(e) => {
                const label = e.target.value;
                patch(keyTouched || locked ? { label } : { label, key: toFieldKey(label) });
              }}
            />
          </FormField>
          <FormField
            label="API key"
            htmlFor={`${uid}-key`}
            required
            error={f.key ? show("key") : undefined}
            hint={locked ? "Can't change once data exists" : "Used in imports, API and formulas"}
          >
            <Input
              id={`${uid}-key`}
              value={f.key}
              readOnly={locked}
              invalid={!!(f.key && show("key"))}
              aria-describedby={`${uid}-key-msg`}
              className="font-mono text-xs"
              onChange={(e) => {
                setKeyTouched(true);
                patch({ key: e.target.value.toLowerCase().replace(/\s+/g, "_") });
              }}
            />
          </FormField>
        </div>
        <FormField
          label="Type"
          htmlFor={`${uid}-type`}
          hint={locked ? "Type is locked because records already use this field" : undefined}
        >
          <Select
            id={`${uid}-type`}
            options={typeOptions}
            value={f.type}
            disabled={locked}
            onValueChange={(v) => setType(v as CustomFieldType)}
          />
        </FormField>

        {isChoice(f.type) ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-xs text-crm-soft">Options</legend>
            <ol className="flex flex-col gap-1.5">
              {f.options.map((o, i) => (
                <li key={o.id} className="flex items-center gap-1.5">
                  <span className="w-5 text-right text-xs text-crm-subtle tabular-nums">
                    {i + 1}
                  </span>
                  <Input
                    ref={(el) => {
                      if (el) optRefs.current.set(o.id, el);
                      else optRefs.current.delete(o.id);
                    }}
                    aria-label={`Option ${i + 1}`}
                    value={o.label}
                    placeholder={`Option ${i + 1}`}
                    className="h-8"
                    onChange={(e) =>
                      patch({
                        options: f.options.map((x) =>
                          x.id === o.id ? { ...x, label: e.target.value } : x,
                        ),
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOption(i);
                      } else if (e.key === "Backspace" && !o.label && f.options.length > 1) {
                        e.preventDefault();
                        focusNext.current =
                          i > 0 ? (f.options[i - 1]?.id ?? null) : (f.options[1]?.id ?? null);
                        patch({ options: f.options.filter((x) => x.id !== o.id) });
                      } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                        e.preventDefault();
                        moveOption(i, e.key === "ArrowUp" ? -1 : 1);
                      }
                    }}
                  />
                  <IconButton
                    label={`Move ${o.label || `option ${i + 1}`} up`}
                    disabled={i === 0}
                    onClick={() => moveOption(i, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </IconButton>
                  <IconButton
                    label={`Move ${o.label || `option ${i + 1}`} down`}
                    disabled={i === f.options.length - 1}
                    onClick={() => moveOption(i, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </IconButton>
                  <IconButton
                    label={`Remove ${o.label || `option ${i + 1}`}`}
                    onClick={() => patch({ options: f.options.filter((x) => x.id !== o.id) })}
                  >
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="ghost" onClick={() => addOption()}>
                <Plus className="size-3.5" aria-hidden /> Add option
              </Button>
              <span className="text-[11px] text-crm-subtle">Enter adds · Alt+↑↓ reorders</span>
            </div>
            {show("options") ? (
              <p role="alert" className="text-xs text-crm-danger">
                {errors.options}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {isNumeric(f.type) ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {f.type === "currency" ? (
              <FormField label="Currency" htmlFor={`${uid}-cur`}>
                <Select
                  id={`${uid}-cur`}
                  options={currencies}
                  value={f.currency}
                  onValueChange={(v) => patch({ currency: v })}
                />
              </FormField>
            ) : null}
            <FormField label="Decimals" htmlFor={`${uid}-dec`}>
              <Input
                id={`${uid}-dec`}
                type="number"
                min={0}
                max={6}
                value={f.decimals ?? 0}
                onChange={(e) =>
                  patch({ decimals: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })
                }
              />
            </FormField>
            <FormField label="Min" htmlFor={`${uid}-min`}>
              <Input
                id={`${uid}-min`}
                type="number"
                value={f.min ?? ""}
                invalid={!!show("range")}
                onChange={(e) =>
                  patch({ min: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </FormField>
            <FormField label="Max" htmlFor={`${uid}-max`} error={show("range")}>
              <Input
                id={`${uid}-max`}
                type="number"
                value={f.max ?? ""}
                invalid={!!show("range")}
                aria-describedby={`${uid}-max-msg`}
                onChange={(e) =>
                  patch({ max: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </FormField>
          </div>
        ) : null}

        <FormField
          label="Help text"
          htmlFor={`${uid}-desc`}
          hint={`${(f.description ?? "").length}/140`}
        >
          <Input
            id={`${uid}-desc`}
            maxLength={140}
            value={f.description ?? ""}
            placeholder="Shown under the field on the record"
            onChange={(e) => patch({ description: e.target.value })}
          />
        </FormField>
        <Switch
          checked={f.required}
          onCheckedChange={(required) => patch({ required })}
          label="Required"
          description={`Block saving a ${objectName.toLowerCase()} without this value`}
        />
        {saveError ? (
          <p role="alert" className="text-xs text-crm-danger">
            {saveError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-crm-border pt-4">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" variant="primary" loading={saving}>
            {initial?.key ? "Save changes" : "Create field"}
          </Button>
        </div>
      </div>

      <aside
        aria-label="Preview"
        className="flex h-fit flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-4"
      >
        <span className="crm-eyebrow text-crm-subtle">Preview on {objectName}</span>
        <label htmlFor={`${uid}-preview`} className="text-xs text-crm-soft">
          {f.label || "Untitled field"}
          {f.required ? <span className="text-crm-danger"> *</span> : null}
        </label>
        {preview}
        {f.description ? <p className="text-[11px] text-crm-subtle">{f.description}</p> : null}
        <code className="mt-2 truncate rounded bg-crm-muted px-1.5 py-1 font-mono text-[11px] text-crm-soft">
          {objectName.toLowerCase()}.{f.key || "field_key"}
        </code>
      </aside>
    </form>
  );
}
