import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowRight, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { SearchInput } from "@/components/crm/search-input";
import { Select } from "@/components/crm/select";
import { WordDiff } from "@/components/crm/pro-record-merge/word-diff";
import {
  applyBulkOp,
  buildSchema,
  describeOp,
  display,
  type BulkOp,
  type FieldValue,
  type MergeField,
  type MergeRecord,
  zodFormResolver,
} from "@/components/crm/pro-record-merge/model";

export interface BulkEditProps {
  records: MergeRecord[];
  fields: MergeField[];
  titleKey: string;
  /** Columns shown in the record list besides the title. */
  columns?: string[];
  onApply: (op: BulkOp, ids: string[], label: string) => void;
  disabled?: boolean;
}

interface Change {
  id: string;
  title: string;
  before: FieldValue;
  after: FieldValue;
}

const ROW = 36;
const kinds = [
  { value: "set", label: "Set to" },
  { value: "clear", label: "Clear" },
  { value: "replace", label: "Find and replace" },
  { value: "addTag", label: "Add tag" },
  { value: "removeTag", label: "Remove tag" },
] as const;

const opSchema = z.object({
  field: z.string().min(1, "Choose a field"),
  kind: z.enum(["set", "clear", "replace", "addTag", "removeTag"]),
  value: z.string(),
  find: z.string(),
});
type OpForm = z.infer<typeof opSchema>;

/** Select records (virtualised, 10k+), describe one field operation, preview the diff, apply. */
export function BulkEdit({
  records,
  fields,
  titleKey,
  columns = [],
  onApply,
  disabled,
}: BulkEditProps) {
  const editable = React.useMemo(() => fields.filter((f) => f.bulkEditable !== false), [fields]);
  const fieldByKey = React.useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const valueSchemas = React.useMemo(() => buildSchema(fields).shape, [fields]);
  const [query, setQuery] = React.useState("");
  const deferred = React.useDeferredValue(query);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const anchor = React.useRef<number | null>(null);

  const filtered = React.useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return records;
    const keys = [titleKey, ...columns];
    return records.filter((r) => keys.some((k) => display(r.values[k]).toLowerCase().includes(q)));
  }, [records, deferred, titleKey, columns]);

  const form = useForm<OpForm>({
    resolver: zodFormResolver<OpForm>(
      opSchema.superRefine((v, ctx) => {
        const f = fieldByKey.get(v.field);
        if (!f) return;
        if (v.kind === "replace" && !v.find)
          ctx.addIssue({ code: "custom", path: ["find"], message: "Enter text to find" });
        if ((v.kind === "addTag" || v.kind === "removeTag") && f.type !== "tags")
          ctx.addIssue({
            code: "custom",
            path: ["kind"],
            message: `${f.label} is not a tag field`,
          });
        if ((v.kind === "addTag" || v.kind === "removeTag") && !v.value.trim())
          ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a tag" });
        if (v.kind === "set") {
          const res = valueSchemas[v.field]?.safeParse(v.value);
          if (res && !res.success)
            ctx.addIssue({
              code: "custom",
              path: ["value"],
              message: res.error.issues[0]?.message ?? "Invalid value",
            });
        }
        if (v.kind === "clear" && f.required)
          ctx.addIssue({ code: "custom", path: ["kind"], message: `${f.label} is required` });
      }),
    ),
    mode: "onChange",
    defaultValues: { field: editable[0]?.key ?? "", kind: "set", value: "", find: "" },
  });
  const watched = useWatch({ control: form.control });
  const { errors } = form.formState;

  const op = React.useMemo<BulkOp | null>(() => {
    const { field, kind, value = "", find = "" } = watched;
    if (!field || !kind) return null;
    if (kind === "clear") return { kind, field };
    if (kind === "replace") return find ? { kind, field, find, value } : null;
    return { kind, field, value };
  }, [watched]);

  // Preview: O(selected) per change of the op, never O(n^2).
  const changes = React.useMemo<Change[]>(() => {
    if (!op || !selected.size) return [];
    const f = fieldByKey.get(op.field);
    const out: Change[] = [];
    for (const r of records) {
      if (!selected.has(r.id)) continue;
      const before = r.values[op.field];
      const after = applyBulkOp(before, op, f?.type);
      if (after !== before && display(after) !== display(before))
        out.push({ id: r.id, title: display(r.values[titleKey]) || r.id, before, after });
    }
    return out;
  }, [op, selected, records, fieldByKey, titleKey]);

  const listRef = React.useRef<HTMLDivElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const list = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW,
    overscan: 10,
    getItemKey: (i) => filtered[i]?.id ?? i,
  });
  const preview = useVirtualizer({
    count: changes.length,
    getScrollElement: () => previewRef.current,
    estimateSize: () => ROW,
    overscan: 10,
    getItemKey: (i) => changes[i]?.id ?? i,
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someSelected = filtered.some((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) for (const r of filtered) next.delete(r.id);
      else for (const r of filtered) next.add(r.id);
      return next;
    });
  const toggle = (index: number, shift: boolean) => {
    const r = filtered[index];
    if (!r) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const on = !prev.has(r.id);
      if (shift && anchor.current != null) {
        const [a, b] = [Math.min(anchor.current, index), Math.max(anchor.current, index)];
        for (let i = a; i <= b; i++) {
          const id = filtered[i]?.id;
          if (id) {
            if (on) next.add(id);
            else next.delete(id);
          }
        }
      } else if (on) next.add(r.id);
      else next.delete(r.id);
      return next;
    });
    anchor.current = index;
  };

  const headerRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someSelected && !allFilteredSelected;
  }, [someSelected, allFilteredSelected]);

  const submit = form.handleSubmit(() => {
    if (!op || !changes.length) return;
    const label = `${describeOp(op, fieldByKey.get(op.field)?.label ?? op.field)} on ${changes.length.toLocaleString()} record${
      changes.length === 1 ? "" : "s"
    }`;
    onApply(
      op,
      changes.map((c) => c.id),
      label,
    );
    form.reset({ ...form.getValues(), value: "", find: "" });
  });

  const field = fieldByKey.get(watched.field ?? "");
  const kind = watched.kind ?? "set";
  const template = `32px minmax(180px,1.4fr) ${columns.map(() => "minmax(120px,1fr)").join(" ")}`;

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      {/* Record picker */}
      <section aria-label="Records" className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <SearchInput
            size="sm"
            value={query}
            onValueChange={setQuery}
            placeholder="Filter records"
            aria-label="Filter records"
            className="flex-1"
          />
          <span
            className="text-xs whitespace-nowrap text-crm-muted-fg tabular-nums"
            aria-live="polite"
          >
            {selected.size.toLocaleString()} selected · {filtered.length.toLocaleString()} shown
          </span>
          {selected.size > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          )}
        </div>
        <div
          role="grid"
          aria-label="Records to edit"
          aria-rowcount={filtered.length + 1}
          aria-multiselectable
          className="overflow-hidden rounded-crm border border-crm-border"
        >
          <div
            role="row"
            aria-rowindex={1}
            className="grid items-center gap-2 border-b border-crm-border bg-crm-raised px-2 text-[11px] text-crm-muted-fg"
            style={{ gridTemplateColumns: template, height: ROW }}
          >
            <span role="columnheader">
              <input
                ref={headerRef}
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAll}
                aria-label={allFilteredSelected ? "Deselect all shown" : "Select all shown"}
                className="size-3.5 accent-crm-primary"
              />
            </span>
            <span role="columnheader">{fieldByKey.get(titleKey)?.label ?? "Name"}</span>
            {columns.map((c) => (
              <span role="columnheader" key={c}>
                {fieldByKey.get(c)?.label ?? c}
              </span>
            ))}
          </div>
          <div ref={listRef} className="h-[360px] overflow-auto [scrollbar-width:thin]">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-xs text-crm-muted-fg">No records match.</p>
            ) : (
              <div className="relative" style={{ height: list.getTotalSize() }}>
                {list.getVirtualItems().map((item) => {
                  const r = filtered[item.index] as MergeRecord;
                  const on = selected.has(r.id);
                  return (
                    <div
                      key={item.key}
                      role="row"
                      aria-rowindex={item.index + 2}
                      aria-selected={on}
                      className={cn(
                        "absolute inset-x-0 top-0 grid items-center gap-2 border-b border-crm-border/50 px-2 text-xs",
                        on ? "bg-crm-primary/10" : "hover:bg-crm-raised",
                      )}
                      style={{
                        gridTemplateColumns: template,
                        height: ROW,
                        transform: `translateY(${item.start}px)`,
                      }}
                    >
                      <span role="gridcell">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => undefined}
                          onClick={(e) => toggle(item.index, e.shiftKey)}
                          aria-label={`Select ${display(r.values[titleKey]) || r.id}`}
                          className="size-3.5 accent-crm-primary"
                        />
                      </span>
                      <span role="gridcell" className="truncate text-crm-fg">
                        {display(r.values[titleKey]) || r.id}
                      </span>
                      {columns.map((c) => (
                        <span role="gridcell" key={c} className="truncate text-crm-soft">
                          {display(r.values[c]) || <span className="text-crm-faint">—</span>}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <p className="text-[11px] text-crm-muted-fg">Shift-click to select a range.</p>
      </section>

      {/* Operation + preview */}
      <form
        noValidate
        onSubmit={submit}
        aria-label="Bulk update"
        className="flex min-w-0 flex-col gap-2"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-crm-muted-fg">
            Field
            <Controller
              control={form.control}
              name="field"
              render={({ field: f }) => (
                <Select
                  aria-label="Field"
                  value={f.value}
                  onValueChange={(v) => {
                    f.onChange(v);
                    if (fieldByKey.get(v)?.type !== "tags" && /Tag$/.test(form.getValues("kind")))
                      form.setValue("kind", "set", { shouldValidate: true });
                  }}
                  options={editable.map((x) => ({ value: x.key, label: x.label }))}
                />
              )}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-crm-muted-fg">
            Operation
            <Controller
              control={form.control}
              name="kind"
              render={({ field: f }) => (
                <Select
                  aria-label="Operation"
                  value={f.value}
                  onValueChange={f.onChange}
                  invalid={!!errors.kind}
                  options={kinds
                    .filter((k) => field?.type === "tags" || !k.value.endsWith("Tag"))
                    .map((k) => ({ value: k.value, label: k.label }))}
                />
              )}
            />
          </label>
          {kind === "replace" && (
            <label className="col-span-2 flex flex-col gap-1 text-[11px] text-crm-muted-fg">
              Find
              <input
                {...form.register("find")}
                className={inputCls(!!errors.find)}
                aria-invalid={!!errors.find || undefined}
              />
            </label>
          )}
          {kind !== "clear" && (
            <label className="col-span-2 flex flex-col gap-1 text-[11px] text-crm-muted-fg">
              {kind === "replace" ? "Replace with" : kind.endsWith("Tag") ? "Tag" : "New value"}
              {kind === "set" && field?.options ? (
                <Controller
                  control={form.control}
                  name="value"
                  render={({ field: f }) => (
                    <Select
                      aria-label="New value"
                      value={f.value}
                      onValueChange={f.onChange}
                      options={field.options!.map((o) => ({ value: o, label: o }))}
                    />
                  )}
                />
              ) : (
                <input
                  {...form.register("value")}
                  className={inputCls(!!errors.value)}
                  aria-invalid={!!errors.value || undefined}
                  placeholder={
                    field?.type === "tags" && kind === "set" ? "Comma separated" : undefined
                  }
                />
              )}
            </label>
          )}
          {(errors.value || errors.find || errors.kind) && (
            <p role="alert" className="col-span-2 text-[11px] text-crm-danger">
              {errors.value?.message ?? errors.find?.message ?? errors.kind?.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-crm-soft" aria-live="polite">
            Preview: {changes.length.toLocaleString()} of {selected.size.toLocaleString()} selected
            will change
          </span>
        </div>
        <div
          ref={previewRef}
          role="list"
          aria-label="Change preview"
          className="h-[260px] overflow-auto rounded-crm border border-crm-border bg-crm-card [scrollbar-width:thin]"
        >
          {changes.length === 0 ? (
            <p className="p-6 text-center text-xs text-crm-muted-fg">
              {selected.size
                ? "Nothing would change with this operation."
                : "Select records to preview changes."}
            </p>
          ) : (
            <div className="relative" style={{ height: preview.getTotalSize() }}>
              {preview.getVirtualItems().map((item) => {
                const c = changes[item.index] as Change;
                return (
                  <div
                    key={item.key}
                    role="listitem"
                    className="absolute inset-x-0 top-0 grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_12px_minmax(0,1fr)] items-center gap-2 border-b border-crm-border/50 px-2 text-xs"
                    style={{ height: ROW, transform: `translateY(${item.start}px)` }}
                  >
                    <span className="truncate text-crm-soft">{c.title}</span>
                    <span className="truncate text-crm-muted-fg line-through decoration-crm-danger/60">
                      {display(c.before) || "—"}
                    </span>
                    <ArrowRight className="size-3 text-crm-muted-fg" aria-label="becomes" />
                    <WordDiff
                      base={display(c.before)}
                      value={display(c.after)}
                      className="truncate"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={disabled || changes.length === 0}
        >
          <Wand2 className="size-3.5" aria-hidden /> Apply to {changes.length.toLocaleString()}{" "}
          record
          {changes.length === 1 ? "" : "s"}
        </Button>
      </form>
    </div>
  );
}

function inputCls(error: boolean) {
  return cn(
    "h-[30px] rounded-crm border bg-crm-bg px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
    error ? "border-crm-danger/60" : "border-crm-input",
  );
}
