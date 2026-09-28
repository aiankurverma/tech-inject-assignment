import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Archive,
  ArchiveRestore,
  Calendar,
  CheckSquare,
  Hash,
  List,
  Link2,
  Mail,
  Plus,
  Type,
  DollarSign,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";
import { Switch } from "@/components/crm/switch";
import { Tag } from "@/components/crm/tag";

export type CustomFieldType =
  "text" | "number" | "currency" | "date" | "select" | "multiselect" | "checkbox" | "email" | "url";

export interface CustomField {
  id: string;
  label: string;
  /** snake_case key used by the API and imports. Immutable after creation. */
  apiName: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  helpText?: string;
  archived?: boolean;
  /** Share of records that have a value, 0..1. */
  fillRate?: number;
}

export interface SettingsCustomFieldsProps {
  /** Object key -> label, e.g. { contact: "Contacts", deal: "Deals" } */
  objects: Record<string, string>;
  fields?: Record<string, CustomField[]>;
  defaultFields?: Record<string, CustomField[]>;
  onFieldsChange?: (f: Record<string, CustomField[]>) => void;
  /** Keys reserved by built-in fields (email, name, owner...). */
  reservedApiNames?: string[];
  maxFieldsPerObject?: number;
  className?: string;
}

const TYPES: { value: CustomFieldType; label: string; icon: React.ReactNode }[] = [
  { value: "text", label: "Text", icon: <Type /> },
  { value: "number", label: "Number", icon: <Hash /> },
  { value: "currency", label: "Currency", icon: <DollarSign /> },
  { value: "date", label: "Date", icon: <Calendar /> },
  { value: "select", label: "Single select", icon: <List /> },
  { value: "multiselect", label: "Multi select", icon: <List /> },
  { value: "checkbox", label: "Checkbox", icon: <CheckSquare /> },
  { value: "email", label: "Email", icon: <Mail /> },
  { value: "url", label: "URL", icon: <Link2 /> },
];
const typeMeta = (t: CustomFieldType) => TYPES.find((x) => x.value === t) ?? TYPES[0]!;

/** "Annual Revenue (USD)" -> "annual_revenue_usd" */
export function toApiName(label: string) {
  const s = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[0-9]/.test(s) ? `f_${s}` : s;
}

interface Draft {
  label: string;
  apiName: string;
  apiTouched: boolean;
  type: CustomFieldType;
  required: boolean;
  options: string[];
  optionDraft: string;
  helpText: string;
}

const EMPTY: Draft = {
  label: "",
  apiName: "",
  apiTouched: false,
  type: "text",
  required: false,
  options: [],
  optionDraft: "",
  helpText: "",
};

/** Custom field manager per CRM object: typed fields, auto snake_case API names with reserved/duplicate checks, select options, required, reorder, archive/restore, fill-rate. */
export function SettingsCustomFields({
  objects,
  fields,
  defaultFields = {},
  onFieldsChange,
  reservedApiNames = ["id", "name", "email", "owner", "created_at", "updated_at"],
  maxFieldsPerObject = 50,
  className,
}: SettingsCustomFieldsProps) {
  const [inner, setInner] = React.useState(defaultFields);
  const all = fields ?? inner;
  const commit = (next: Record<string, CustomField[]>) => {
    if (fields === undefined) setInner(next);
    onFieldsChange?.(next);
  };
  const objectKeys = Object.keys(objects);
  const [obj, setObj] = React.useState(objectKeys[0] ?? "");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const list = all[obj] ?? [];
  const setList = (l: CustomField[]) => commit({ ...all, [obj]: l });
  const activeCount = list.filter((f) => !f.archived).length;
  const visible = list.filter((f) => showArchived || !f.archived);
  const needsOptions = draft && (draft.type === "select" || draft.type === "multiselect");

  function validate(d: Draft): string | null {
    if (!d.label.trim()) return "Label is required.";
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(d.apiName))
      return "API name must be 2-40 chars: a-z, 0-9, _ and start with a letter.";
    if (reservedApiNames.includes(d.apiName))
      return `"${d.apiName}" is reserved by a built-in field.`;
    if (list.some((f) => f.apiName === d.apiName))
      return `API name "${d.apiName}" is already used (archived fields keep their name).`;
    if ((d.type === "select" || d.type === "multiselect") && d.options.length < 2)
      return "Add at least two options.";
    if (activeCount >= maxFieldsPerObject) return `Limit of ${maxFieldsPerObject} fields reached.`;
    return null;
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const err = validate(draft);
    if (err) return setError(err);
    const f: CustomField = {
      id: `cf-${Date.now()}`,
      label: draft.label.trim(),
      apiName: draft.apiName,
      type: draft.type,
      required: draft.required,
      options: needsOptions ? draft.options : undefined,
      helpText: draft.helpText.trim() || undefined,
      fillRate: 0,
    };
    setList([...list, f]);
    setDraft(null);
    setError(null);
  }

  function addOption() {
    if (!draft) return;
    const o = draft.optionDraft.trim();
    if (!o || draft.options.some((x) => x.toLowerCase() === o.toLowerCase())) return;
    setDraft({ ...draft, options: [...draft.options, o], optionDraft: "" });
  }

  function move(id: string, dir: -1 | 1) {
    const i = list.findIndex((f) => f.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = list.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    setList(next);
  }

  const patch = (id: string, p: Partial<CustomField>) =>
    setList(list.map((f) => (f.id === id ? { ...f, ...p } : f)));

  return (
    <section className={cn("flex flex-col gap-4 font-crm", className)} aria-labelledby="cf-h">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Settings</p>
          <h2 id="cf-h" className="text-lg font-semibold text-crm-fg">
            Custom fields
          </h2>
          <p className="text-xs text-crm-soft">
            {activeCount} of {maxFieldsPerObject} fields on {objects[obj]}
          </p>
        </div>
        <Button
          variant="primary"
          disabled={!!draft || activeCount >= maxFieldsPerObject}
          onClick={() => {
            setDraft(EMPTY);
            setError(null);
          }}
        >
          <Plus /> New field
        </Button>
      </header>

      <div role="tablist" aria-label="Objects" className="flex gap-1 border-b border-crm-border">
        {objectKeys.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={obj === k}
            onClick={() => {
              setObj(k);
              setDraft(null);
            }}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              obj === k
                ? "border-crm-primary text-crm-fg"
                : "border-transparent text-crm-soft hover:text-crm-fg",
            )}
          >
            {objects[k]}
            <span className="ml-1.5 text-xs text-crm-subtle tabular-nums">
              {(all[k] ?? []).filter((f) => !f.archived).length}
            </span>
          </button>
        ))}
      </div>

      {draft ? (
        <form
          onSubmit={create}
          aria-label="New custom field"
          className="flex flex-col gap-3 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-xs text-crm-soft">
              Label
              <Input
                autoFocus
                value={draft.label}
                placeholder="Annual revenue"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    label: e.target.value,
                    apiName: draft.apiTouched ? draft.apiName : toApiName(e.target.value),
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-crm-soft">
              API name
              <Input
                value={draft.apiName}
                className="font-mono"
                onChange={(e) =>
                  setDraft({ ...draft, apiName: e.target.value.toLowerCase(), apiTouched: true })
                }
              />
            </label>
            <div className="flex flex-col gap-1.5 text-xs text-crm-soft">
              <span id="cf-type-l">Type</span>
              <Select
                aria-label="Field type"
                value={draft.type}
                onValueChange={(v) => setDraft({ ...draft, type: v as CustomFieldType })}
                options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
          </div>
          {needsOptions ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input
                  aria-label="New option"
                  placeholder="Add option and press Enter"
                  value={draft.optionDraft}
                  onChange={(e) => setDraft({ ...draft, optionDraft: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button type="button" size="lg" onClick={addOption}>
                  Add
                </Button>
              </div>
              <ul className="flex flex-wrap gap-1.5" aria-label="Options">
                {draft.options.map((o) => (
                  <li key={o}>
                    <Tag color="blue" className="gap-1 pr-0.5">
                      {o}
                      <button
                        type="button"
                        aria-label={`Remove ${o}`}
                        onClick={() =>
                          setDraft({ ...draft, options: draft.options.filter((x) => x !== o) })
                        }
                      >
                        <X className="size-3" />
                      </button>
                    </Tag>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Input
            aria-label="Help text"
            placeholder="Help text shown under the field (optional)"
            value={draft.helpText}
            onChange={(e) => setDraft({ ...draft, helpText: e.target.value })}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Switch
              size="sm"
              label="Required on create"
              checked={draft.required}
              onCheckedChange={(v) => setDraft({ ...draft, required: v })}
            />
            <span className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create field
              </Button>
            </span>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-crm-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}

      <div className="flex justify-end">
        <Switch
          size="sm"
          label={`Show archived (${list.length - activeCount})`}
          checked={showArchived}
          onCheckedChange={setShowArchived}
        />
      </div>

      <ul className="divide-y divide-crm-border rounded-xl border border-crm-border bg-crm-card shadow-crm-raised">
        {visible.length === 0 ? (
          <li className="p-10 text-center text-sm text-crm-soft">
            No custom fields on {objects[obj]} yet.
          </li>
        ) : null}
        {visible.map((f, i) => {
          const meta = typeMeta(f.type);
          const fill = Math.round((f.fillRate ?? 0) * 100);
          return (
            <li
              key={f.id}
              className={cn(
                "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                f.archived && "opacity-50",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-crm-raised text-crm-soft shadow-crm-raised [&_svg]:size-4"
                  aria-hidden
                >
                  {meta.icon}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-crm-fg">
                    <span className="truncate">{f.label}</span>
                    {f.required ? (
                      <Tag size="sm" color="orange">
                        Required
                      </Tag>
                    ) : null}
                    {f.archived ? <Tag size="sm">Archived</Tag> : null}
                  </p>
                  <p className="truncate text-xs text-crm-subtle">
                    <span className="font-mono">{f.apiName}</span> · {meta.label}
                    {f.options?.length ? ` · ${f.options.length} options` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="flex w-28 items-center gap-2 text-xs text-crm-soft"
                  title="Records with a value"
                >
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-crm-muted">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        fill < 20 ? "bg-crm-warning" : "bg-crm-primary",
                      )}
                      style={{ width: `${fill}%` }}
                    />
                  </span>
                  <span className="tabular-nums">{fill}%</span>
                </span>
                {!f.archived ? (
                  <Switch
                    size="sm"
                    aria-label={`${f.label} required`}
                    checked={f.required}
                    onCheckedChange={(v) => patch(f.id, { required: v })}
                  />
                ) : null}
                <button
                  type="button"
                  aria-label={`Move ${f.label} up`}
                  disabled={i === 0}
                  onClick={() => move(f.id, -1)}
                  className="rounded p-1 text-crm-subtle hover:text-crm-fg disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${f.label} down`}
                  disabled={i === visible.length - 1}
                  onClick={() => move(f.id, 1)}
                  className="rounded p-1 text-crm-subtle hover:text-crm-fg disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={f.archived ? `Restore ${f.label}` : `Archive ${f.label}`}
                  onClick={() => patch(f.id, { archived: !f.archived, required: false })}
                  className="rounded p-1 text-crm-subtle hover:text-crm-fg"
                >
                  {f.archived ? (
                    <ArchiveRestore className="size-3.5" />
                  ) : (
                    <Archive className="size-3.5" />
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
