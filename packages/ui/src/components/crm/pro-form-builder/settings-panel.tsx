import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hasOptions,
  type FieldOption,
  type FormField,
  type FormPage,
} from "@/components/crm/pro-form-renderer/schema";
import { labelForType, useBuilder, findField } from "@/components/crm/pro-form-builder/store";
import { LogicEditor } from "@/components/crm/pro-form-builder/logic-editor";

const inputCls =
  "h-8 w-full rounded-crm border border-crm-input/60 bg-crm-raised px-2.5 text-xs text-crm-fg outline-none placeholder:text-crm-subtle hover:border-crm-input focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40 aria-[invalid=true]:border-crm-danger disabled:opacity-50 [color-scheme:dark]";

function Row({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-[11px] font-medium text-crm-soft">
        {label}
      </label>
      {children}
      {error || hint ? (
        <p
          className={cn("text-[11px]", error ? "text-crm-danger" : "text-crm-subtle")}
          role={error ? "alert" : undefined}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-crm py-1 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50"
    >
      {label}
      <span
        className={cn(
          "relative h-4 w-7 rounded-full transition-colors",
          checked ? "bg-crm-primary" : "bg-crm-track",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3 rounded-full bg-white transition-[left]",
            checked ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "option";

type Tab = "general" | "validation" | "options" | "logic";

export interface SettingsPanelProps {
  disabled?: boolean;
  /** Names offered in the async validator picker. */
  asyncValidatorNames?: string[];
}

/** Right-hand inspector for the selected field, page, or (with nothing selected) the form. */
export function SettingsPanel({ disabled, asyncValidatorNames }: SettingsPanelProps) {
  const selection = useBuilder((s) => s.selection);
  const schema = useBuilder((s) => s.schema);

  if (selection?.kind === "field") {
    const hit = findField(schema, selection.id);
    if (hit) {
      const order = schema.pages.flatMap((p) => p.fields);
      const at = order.findIndex((f) => f.id === hit.field.id);
      return (
        <FieldSettings
          key={hit.field.id}
          field={hit.field}
          sources={order.slice(0, at)}
          disabled={disabled}
          asyncValidatorNames={asyncValidatorNames}
        />
      );
    }
  }
  if (selection?.kind === "page") {
    const page = schema.pages.find((p) => p.id === selection.id);
    if (page) {
      const i = schema.pages.indexOf(page);
      const sources = schema.pages.slice(0, i).flatMap((p) => p.fields);
      return (
        <PageSettings key={page.id} page={page} index={i} sources={sources} disabled={disabled} />
      );
    }
  }
  return <FormSettings disabled={disabled} />;
}

function FormSettings({ disabled }: { disabled?: boolean }) {
  const schema = useBuilder((s) => s.schema);
  const edit = useBuilder((s) => s.edit);
  const id = React.useId();
  return (
    <div className="flex flex-col gap-3">
      <PanelTitle title="Form settings" subtitle="Select a field or page to edit it" />
      <Row label="Title" htmlFor={`${id}-t`}>
        <input
          id={`${id}-t`}
          className={inputCls}
          value={schema.title}
          disabled={disabled}
          onChange={(e) => edit((d) => void (d.title = e.target.value), { coalesce: "form:title" })}
        />
      </Row>
      <Row label="Description" htmlFor={`${id}-d`}>
        <textarea
          id={`${id}-d`}
          rows={3}
          className={cn(inputCls, "h-auto py-1.5")}
          value={schema.description ?? ""}
          disabled={disabled}
          onChange={(e) =>
            edit((d) => void (d.description = e.target.value || undefined), {
              coalesce: "form:desc",
            })
          }
        />
      </Row>
      <Row label="Submit button label" htmlFor={`${id}-s`}>
        <input
          id={`${id}-s`}
          className={inputCls}
          value={schema.settings?.submitLabel ?? ""}
          placeholder="Submit"
          disabled={disabled}
          onChange={(e) =>
            edit((d) => void ((d.settings ??= {}).submitLabel = e.target.value || undefined), {
              coalesce: "form:submit",
            })
          }
        />
      </Row>
      <Row label="Success message" htmlFor={`${id}-m`}>
        <input
          id={`${id}-m`}
          className={inputCls}
          value={schema.settings?.successMessage ?? ""}
          placeholder="Thanks, your response was recorded."
          disabled={disabled}
          onChange={(e) =>
            edit((d) => void ((d.settings ??= {}).successMessage = e.target.value || undefined), {
              coalesce: "form:success",
            })
          }
        />
      </Row>
      <Toggle
        label="Show progress bar"
        checked={schema.settings?.showProgress !== false}
        disabled={disabled}
        onChange={(v) => edit((d) => void ((d.settings ??= {}).showProgress = v))}
      />
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          ["Pages", schema.pages.length],
          ["Fields", schema.pages.reduce((n, p) => n + p.fields.length, 0)],
          [
            "Rules",
            schema.pages.reduce(
              (n, p) =>
                n +
                p.fields.filter((f) => f.logic?.rules.length).length +
                (p.logic?.rules.length ? 1 : 0),
              0,
            ),
          ],
        ].map(([k, v]) => (
          <div key={k} className="rounded-crm bg-crm-raised px-2 py-2 shadow-crm-raised">
            <dt className="text-[11px] text-crm-subtle">{k}</dt>
            <dd className="text-sm font-semibold text-crm-fg tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-crm-fg">{title}</p>
      {subtitle ? <p className="text-[11px] text-crm-subtle">{subtitle}</p> : null}
    </div>
  );
}

function PageSettings({
  page,
  index,
  sources,
  disabled,
}: {
  page: FormPage;
  index: number;
  sources: FormField[];
  disabled?: boolean;
}) {
  const updatePage = useBuilder((s) => s.updatePage);
  const movePage = useBuilder((s) => s.movePage);
  const count = useBuilder((s) => s.schema.pages.length);
  const id = React.useId();
  return (
    <div className="flex flex-col gap-3">
      <PanelTitle title={`Page ${index + 1}`} subtitle={`${page.fields.length} fields`} />
      <Row label="Page title" htmlFor={`${id}-t`}>
        <input
          id={`${id}-t`}
          className={inputCls}
          value={page.title}
          disabled={disabled}
          onChange={(e) => updatePage(page.id, { title: e.target.value })}
        />
      </Row>
      <Row label="Description" htmlFor={`${id}-d`}>
        <input
          id={`${id}-d`}
          className={inputCls}
          value={page.description ?? ""}
          disabled={disabled}
          onChange={(e) => updatePage(page.id, { description: e.target.value || undefined })}
        />
      </Row>
      <div className="flex gap-2">
        <button
          type="button"
          className={smallBtn}
          disabled={disabled || index === 0}
          onClick={() => movePage(page.id, index - 1)}
        >
          <ArrowUp className="size-3" aria-hidden /> Move earlier
        </button>
        <button
          type="button"
          className={smallBtn}
          disabled={disabled || index === count - 1}
          onClick={() => movePage(page.id, index + 1)}
        >
          <ArrowDown className="size-3" aria-hidden /> Move later
        </button>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-crm-border pt-3">
        <p className="text-[11px] font-medium text-crm-soft">Page logic (skip when not matched)</p>
        <LogicEditor
          sources={sources}
          value={page.logic}
          subject="this page"
          disabled={disabled}
          onChange={(logic) => updatePage(page.id, { logic })}
        />
      </div>
    </div>
  );
}

const smallBtn =
  "flex cursor-pointer items-center gap-1 rounded-full bg-crm-raised px-2.5 py-1 text-[11px] text-crm-fg shadow-crm-raised outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-40";

function FieldSettings({
  field: f,
  sources,
  disabled,
  asyncValidatorNames,
}: {
  field: FormField;
  sources: FormField[];
  disabled?: boolean;
  asyncValidatorNames?: string[];
}) {
  const update = useBuilder((s) => s.updateField);
  const allNames = useBuilder((s) =>
    s.schema.pages
      .flatMap((p) => p.fields.filter((x) => x.id !== f.id).map((x) => x.name))
      .join("\u0000"),
  );
  const set = React.useCallback((patch: Partial<FormField>) => update(f.id, patch), [update, f.id]);
  const id = React.useId();
  const tabs: Tab[] = [
    "general",
    ...(f.type === "heading" ? [] : (["validation"] as Tab[])),
    ...(hasOptions(f.type) ? (["options"] as Tab[]) : []),
    "logic",
  ];
  const [tab, setTab] = React.useState<Tab>("general");
  const current = tabs.includes(tab) ? tab : "general";
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const nameTaken = allNames.split("\u0000").includes(f.name);
  const nameError =
    f.type === "heading"
      ? undefined
      : !/^[A-Za-z_][A-Za-z0-9_]*$/.test(f.name)
        ? "Letters, numbers and _ only; cannot start with a number"
        : nameTaken
          ? "Another field already uses this key"
          : undefined;

  const v = f.validation ?? {};
  const setV = (patch: Partial<NonNullable<FormField["validation"]>>) =>
    set({ validation: { ...v, ...patch } });

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <PanelTitle title={f.label || "Untitled field"} subtitle={labelForType(f.type)} />
      <div
        role="tablist"
        aria-label="Field settings"
        className="flex gap-0.5 rounded-full bg-crm-raised p-0.5 shadow-crm-raised"
      >
        {tabs.map((t, i) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            id={`${id}-tab-${t}`}
            type="button"
            role="tab"
            aria-selected={current === t}
            aria-controls={`${id}-panel`}
            tabIndex={current === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const n = (i + d + tabs.length) % tabs.length;
              setTab(tabs[n]!);
              tabRefs.current[n]?.focus();
            }}
            className={cn(
              "flex-1 cursor-pointer rounded-full px-2 py-1 text-[11px] capitalize outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              current === t ? "bg-crm-muted text-crm-fg" : "text-crm-muted-fg hover:text-crm-fg",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${current}`}
        className="flex flex-col gap-3"
      >
        {current === "general" ? (
          <>
            <Row label={f.type === "heading" ? "Heading" : "Label"} htmlFor={`${id}-l`}>
              <input
                id={`${id}-l`}
                className={inputCls}
                value={f.label}
                disabled={disabled}
                onChange={(e) => set({ label: e.target.value })}
              />
            </Row>
            {f.type !== "heading" ? (
              <Row
                label="Response key"
                htmlFor={`${id}-n`}
                error={nameError}
                hint="Used in the submitted JSON and in logic rules"
              >
                <input
                  id={`${id}-n`}
                  className={cn(inputCls, "font-mono")}
                  value={f.name}
                  aria-invalid={!!nameError}
                  disabled={disabled}
                  onChange={(e) => set({ name: e.target.value.replace(/\s+/g, "_") })}
                />
              </Row>
            ) : null}
            {!["heading", "consent", "checkbox", "radio", "rating", "file"].includes(f.type) ? (
              <Row label="Placeholder" htmlFor={`${id}-p`}>
                <input
                  id={`${id}-p`}
                  className={inputCls}
                  value={f.placeholder ?? ""}
                  disabled={disabled}
                  onChange={(e) => set({ placeholder: e.target.value || undefined })}
                />
              </Row>
            ) : null}
            <Row label="Help text" htmlFor={`${id}-h`}>
              <input
                id={`${id}-h`}
                className={inputCls}
                value={f.helpText ?? ""}
                disabled={disabled}
                onChange={(e) => set({ helpText: e.target.value || undefined })}
              />
            </Row>
            {f.type !== "heading" ? (
              <>
                <Toggle
                  label="Required"
                  checked={!!f.required}
                  disabled={disabled}
                  onChange={(required) => set({ required })}
                />
                <Toggle
                  label="Half width (two per row)"
                  checked={f.width === "half"}
                  disabled={disabled}
                  onChange={(half) => set({ width: half ? "half" : "full" })}
                />
              </>
            ) : null}
            {asyncValidatorNames?.length && f.type !== "heading" ? (
              <Row
                label="Server check"
                htmlFor={`${id}-a`}
                hint="Runs asynchronously when the respondent leaves the field"
              >
                <select
                  id={`${id}-a`}
                  className={inputCls}
                  value={f.asyncValidator ?? ""}
                  disabled={disabled}
                  onChange={(e) => set({ asyncValidator: e.target.value || undefined })}
                >
                  <option value="">None</option>
                  {asyncValidatorNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Row>
            ) : null}
          </>
        ) : null}

        {current === "validation" ? (
          <ValidationSettings field={f} v={v} setV={setV} set={set} disabled={disabled} id={id} />
        ) : null}

        {current === "options" ? (
          <OptionsEditor
            options={f.options ?? []}
            disabled={disabled}
            onChange={(options) => set({ options })}
          />
        ) : null}

        {current === "logic" ? (
          <LogicEditor
            sources={sources}
            value={f.logic}
            subject="this field"
            disabled={disabled}
            onChange={(logic) => set({ logic })}
          />
        ) : null}
      </div>
    </div>
  );
}

function ValidationSettings({
  field: f,
  v,
  setV,
  set,
  disabled,
  id,
}: {
  field: FormField;
  v: NonNullable<FormField["validation"]>;
  setV: (p: Partial<NonNullable<FormField["validation"]>>) => void;
  set: (p: Partial<FormField>) => void;
  disabled?: boolean;
  id: string;
}) {
  const textual = ["text", "textarea", "email", "phone", "url"].includes(f.type);
  let patternError: string | undefined;
  if (v.pattern) {
    try {
      new RegExp(v.pattern);
    } catch {
      patternError = "Not a valid regular expression";
    }
  }
  const numberPair = (
    a: "min" | "max" | "minLength" | "maxLength" | "minItems" | "maxItems",
    b: typeof a,
    la: string,
    lb: string,
  ) => (
    <div className="grid grid-cols-2 gap-2">
      {[
        [a, la],
        [b, lb],
      ].map(([k, l]) => (
        <Row key={k} label={l!} htmlFor={`${id}-${k}`}>
          <input
            id={`${id}-${k}`}
            type="number"
            className={inputCls}
            value={v[k as typeof a] ?? ""}
            disabled={disabled}
            onChange={(e) => setV({ [k as typeof a]: num(e.target.value) })}
          />
        </Row>
      ))}
    </div>
  );
  return (
    <>
      {textual ? numberPair("minLength", "maxLength", "Min length", "Max length") : null}
      {textual ? (
        <>
          <Row
            label="Pattern (regex)"
            htmlFor={`${id}-re`}
            error={patternError}
            hint="e.g. ^[A-Z]{2}\d{6}$"
          >
            <input
              id={`${id}-re`}
              className={cn(inputCls, "font-mono")}
              value={v.pattern ?? ""}
              aria-invalid={!!patternError}
              disabled={disabled}
              onChange={(e) => setV({ pattern: e.target.value || undefined })}
            />
          </Row>
          {v.pattern ? (
            <Row label="Pattern error message" htmlFor={`${id}-rm`}>
              <input
                id={`${id}-rm`}
                className={inputCls}
                value={v.patternMessage ?? ""}
                disabled={disabled}
                onChange={(e) => setV({ patternMessage: e.target.value || undefined })}
              />
            </Row>
          ) : null}
        </>
      ) : null}
      {f.type === "number" ? numberPair("min", "max", "Minimum", "Maximum") : null}
      {f.type === "rating" ? (
        <Row label="Stars" htmlFor={`${id}-stars`}>
          <input
            id={`${id}-stars`}
            type="number"
            min={3}
            max={10}
            className={inputCls}
            value={v.max ?? 5}
            disabled={disabled}
            onChange={(e) => setV({ max: Math.max(3, Math.min(10, Number(e.target.value) || 5)) })}
          />
        </Row>
      ) : null}
      {f.type === "multiselect" || (f.type === "checkbox" && f.options?.length)
        ? numberPair("minItems", "maxItems", "Min selected", "Max selected")
        : null}
      {f.type === "file" ? (
        <>
          <Row
            label="Accepted types"
            htmlFor={`${id}-acc`}
            hint="Comma separated: application/pdf, image/*, .docx"
          >
            <input
              id={`${id}-acc`}
              className={inputCls}
              defaultValue={f.file?.accept?.join(", ") ?? ""}
              disabled={disabled}
              onBlur={(e) =>
                set({
                  file: {
                    ...f.file,
                    accept: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Max size (MB)" htmlFor={`${id}-mb`}>
              <input
                id={`${id}-mb`}
                type="number"
                min={1}
                className={inputCls}
                value={f.file?.maxSizeMb ?? ""}
                disabled={disabled}
                onChange={(e) => set({ file: { ...f.file, maxSizeMb: num(e.target.value) } })}
              />
            </Row>
            <Row label="Max files" htmlFor={`${id}-mf`}>
              <input
                id={`${id}-mf`}
                type="number"
                min={1}
                className={inputCls}
                value={f.file?.maxFiles ?? ""}
                disabled={disabled}
                onChange={(e) => set({ file: { ...f.file, maxFiles: num(e.target.value) } })}
              />
            </Row>
          </div>
        </>
      ) : null}
      {["date", "select", "radio", "consent"].includes(f.type) ||
      (f.type === "checkbox" && !f.options?.length) ? (
        <p className="text-[11px] text-crm-subtle">
          Only the Required toggle applies to this field type.
        </p>
      ) : null}
    </>
  );
}

/** Option list editor: rename, reorder, remove, add, and bulk paste one option per line. */
function OptionsEditor({
  options,
  onChange,
  disabled,
}: {
  options: FieldOption[];
  onChange: (o: FieldOption[]) => void;
  disabled?: boolean;
}) {
  const [bulk, setBulk] = React.useState<string | null>(null);
  const dupes = React.useMemo(() => {
    const seen = new Set<string>();
    const out = new Set<string>();
    for (const o of options) (seen.has(o.value) ? out : seen).add(o.value);
    return out;
  }, [options]);
  const patch = (i: number, p: Partial<FieldOption>) =>
    onChange(options.map((o, j) => (j === i ? { ...o, ...p } : o)));
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  if (bulk !== null) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          aria-label="Options, one per line"
          rows={10}
          className={cn(inputCls, "h-auto py-1.5")}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className={smallBtn}
            onClick={() => {
              const lines = bulk
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
              const used = new Set<string>();
              onChange(
                lines.map((label) => {
                  let value = slugify(label);
                  for (let i = 2; used.has(value); i++) value = `${slugify(label)}_${i}`;
                  used.add(value);
                  return { label, value };
                }),
              );
              setBulk(null);
            }}
          >
            Apply {bulk.split("\n").filter((l) => l.trim()).length} options
          </button>
          <button type="button" className={smallBtn} onClick={() => setBulk(null)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" aria-label="Options">
        {options.map((o, i) => (
          <li key={i} className="flex items-center gap-1">
            <input
              aria-label={`Option ${i + 1} label`}
              className={cn(inputCls, "flex-1")}
              value={o.label}
              disabled={disabled}
              onChange={(e) => patch(i, { label: e.target.value })}
            />
            <input
              aria-label={`Option ${i + 1} value`}
              aria-invalid={dupes.has(o.value) || !o.value}
              className={cn(inputCls, "w-24 font-mono")}
              value={o.value}
              disabled={disabled}
              onChange={(e) => patch(i, { value: e.target.value })}
            />
            <button
              type="button"
              aria-label={`Move option ${i + 1} up`}
              disabled={disabled || i === 0}
              onClick={() => swap(i, i - 1)}
              className="cursor-pointer rounded p-1 text-crm-muted-fg hover:text-crm-fg disabled:opacity-30"
            >
              <ArrowUp className="size-3" />
            </button>
            <button
              type="button"
              aria-label={`Move option ${i + 1} down`}
              disabled={disabled || i === options.length - 1}
              onClick={() => swap(i, i + 1)}
              className="cursor-pointer rounded p-1 text-crm-muted-fg hover:text-crm-fg disabled:opacity-30"
            >
              <ArrowDown className="size-3" />
            </button>
            <button
              type="button"
              aria-label={`Remove option ${i + 1}`}
              disabled={disabled || options.length <= 1}
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="cursor-pointer rounded p-1 text-crm-muted-fg hover:text-crm-danger disabled:opacity-30"
            >
              <Trash2 className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      {dupes.size ? (
        <p role="alert" className="text-[11px] text-crm-danger">
          Option values must be unique.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className={smallBtn}
          disabled={disabled}
          onClick={() => {
            let n = options.length + 1;
            while (options.some((o) => o.value === `option_${n}`)) n++;
            onChange([...options, { label: `Option ${n}`, value: `option_${n}` }]);
          }}
        >
          <Plus className="size-3" aria-hidden /> Add option
        </button>
        <button
          type="button"
          className={smallBtn}
          disabled={disabled}
          onClick={() => setBulk(options.map((o) => o.label).join("\n"))}
        >
          Bulk edit
        </button>
      </div>
    </div>
  );
}
