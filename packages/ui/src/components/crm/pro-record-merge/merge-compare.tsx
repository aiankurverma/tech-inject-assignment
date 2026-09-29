import * as React from "react";
import { useForm } from "react-hook-form";
import { AlertTriangle, Crown, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { WordDiff } from "@/components/crm/pro-record-merge/word-diff";
import { MergeAuditView } from "@/components/crm/pro-record-merge/merge-audit";
import {
  autoPicks,
  zodFormResolver,
  buildSchema,
  completeness,
  display,
  hasConflict,
  isEmpty,
  normalize,
  parseValue,
  type FieldPick,
  type MergeAudit,
  type MergeField,
  type MergeRecord,
  type MergeResult,
  type MergeStrategy,
} from "@/components/crm/pro-record-merge/model";

export interface MergeCompareProps {
  records: MergeRecord[];
  fields: MergeField[];
  recordLabel: (id: string) => string;
  onConfirm: (result: MergeResult) => void | Promise<void>;
  onCancel?: () => void;
  locale?: string;
  /** Override the timestamp written to the audit (tests, demos). */
  now?: () => Date;
}

const TEXTUAL = new Set(["text", "longtext", "url", "email", undefined]);

/**
 * Side-by-side compare of 2-4 records with a winner per field (radio group per row),
 * conflict highlighting with word diff against the primary, and an editable merged column
 * validated with react-hook-form + zod.
 */
export function MergeCompare({
  records,
  fields,
  recordLabel,
  onConfirm,
  onCancel,
  locale = "en-US",
  now = () => new Date(),
}: MergeCompareProps) {
  const initialSurvivor = React.useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          completeness(b, fields) - completeness(a, fields) ||
          Date.parse(a.createdAt ?? a.updatedAt) - Date.parse(b.createdAt ?? b.updatedAt),
      )[0]?.id ?? "",
    [records, fields],
  );
  const [survivorId, setSurvivorId] = React.useState(initialSurvivor);
  const [strategy, setStrategy] = React.useState<MergeStrategy>("primary");
  const [picks, setPicks] = React.useState<Record<string, FieldPick>>(() =>
    autoPicks(records, fields, initialSurvivor, "primary"),
  );
  const [conflictsOnly, setConflictsOnly] = React.useState(false);
  const [review, setReview] = React.useState<MergeResult | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const byId = React.useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const conflicts = React.useMemo(
    () => new Map(fields.map((f) => [f.key, hasConflict(records, f)])),
    [records, fields],
  );
  const conflictCount = [...conflicts.values()].filter(Boolean).length;
  const schema = React.useMemo(() => buildSchema(fields), [fields]);

  const valueFor = React.useCallback(
    (key: string, pick: FieldPick) => (pick === "custom" ? undefined : byId.get(pick)?.values[key]),
    [byId],
  );
  const form = useForm<Record<string, string>>({
    resolver: zodFormResolver(schema),
    mode: "onChange",
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.key, display(valueFor(f.key, picks[f.key] ?? initialSurvivor))]),
    ),
  });
  const { register, setValue, handleSubmit, formState } = form;

  const choose = (key: string, pick: FieldPick) => {
    setPicks((p) => ({ ...p, [key]: pick }));
    if (pick !== "custom")
      setValue(key, display(valueFor(key, pick)), { shouldValidate: true, shouldDirty: true });
  };
  const applyStrategy = (s: MergeStrategy, survivor = survivorId) => {
    setStrategy(s);
    const next = autoPicks(records, fields, survivor, s);
    setPicks(next);
    for (const f of fields)
      setValue(f.key, display(valueFor(f.key, next[f.key] as string)), { shouldValidate: true });
  };

  const buildResult = (values: Record<string, string>): MergeResult => {
    const survivor = byId.get(survivorId) as MergeRecord;
    const merged: MergeRecord["values"] = { ...survivor.values };
    const auditFields: MergeAudit["fields"] = [];
    let customEdits = 0;
    for (const f of fields) {
      const pick = picks[f.key] ?? survivorId;
      const raw = values[f.key] ?? "";
      // A picked value that the user then retyped counts as custom.
      const pickedValue = pick === "custom" ? undefined : valueFor(f.key, pick);
      const custom = pick === "custom" || normalize(raw, f.type) !== normalize(pickedValue, f.type);
      const value = custom ? parseValue(raw, f.type) : (pickedValue ?? null);
      if (custom) customEdits++;
      merged[f.key] = value;
      auditFields.push({
        key: f.key,
        label: f.label,
        value,
        pickedFrom: custom ? "custom" : pick,
        conflict: conflicts.get(f.key) === true,
        candidates: Object.fromEntries(records.map((r) => [r.id, r.values[f.key]])),
      });
    }
    const at = now().toISOString();
    return {
      survivor: { ...survivor, values: merged, updatedAt: at },
      removedIds: records.filter((r) => r.id !== survivorId).map((r) => r.id),
      audit: {
        survivorId,
        mergedIds: records.filter((r) => r.id !== survivorId).map((r) => r.id),
        mergedAt: at,
        fields: auditFields,
        conflictsResolved: conflictCount,
        customEdits,
      },
    };
  };

  const confirm = async () => {
    if (!review) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onConfirm(review);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Merge failed");
      setSaving(false);
    }
  };

  const onRadioKey = (e: React.KeyboardEvent<HTMLElement>, row: number, col: number) => {
    const move = (r: number, c: number) => {
      const el = e.currentTarget
        .closest("[data-merge-grid]")
        ?.querySelector<HTMLElement>(`[data-merge-cell="${r}:${c}"]`);
      if (el) {
        e.preventDefault();
        el.focus();
        if (
          el.getAttribute("aria-disabled") !== "true" &&
          (e.key === "ArrowLeft" || e.key === "ArrowRight")
        )
          el.click();
      }
    };
    if (e.key === "ArrowRight") move(row, col + 1);
    else if (e.key === "ArrowLeft") move(row, col - 1);
    else if (e.key === "ArrowDown") move(row + 1, col);
    else if (e.key === "ArrowUp") move(row - 1, col);
  };

  if (records.length < 2)
    return (
      <p className="rounded-crm border border-dashed border-crm-border p-6 text-center text-xs text-crm-muted-fg">
        Select at least two records to compare.
      </p>
    );

  if (review)
    return (
      <div className="flex flex-col gap-3">
        <MergeAuditView audit={review.audit} recordLabel={recordLabel} status="preview" />
        {saveError && (
          <p role="alert" className="text-xs text-crm-danger">
            {saveError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setReview(null)} disabled={saving}>
            Back to compare
          </Button>
          <Button size="sm" variant="primary" onClick={confirm} loading={saving}>
            Confirm merge
          </Button>
        </div>
      </div>
    );

  const template = `minmax(120px,160px) repeat(${records.length}, minmax(170px,1fr)) minmax(220px,1.2fr)`;
  const visibleFields = conflictsOnly ? fields.filter((f) => conflicts.get(f.key)) : fields;
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => setReview(buildResult(v)))}
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-crm-muted-fg">
          {conflictCount} conflicting field{conflictCount === 1 ? "" : "s"} of {fields.length}
        </span>
        <div role="group" aria-label="Auto-pick strategy" className="ml-auto flex gap-1">
          {(
            [
              ["primary", "Prefer primary"],
              ["recent", "Most recent"],
              ["complete", "Most complete"],
            ] as const
          ).map(([s, label]) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={strategy === s ? "muted" : "ghost"}
              aria-pressed={strategy === s}
              onClick={() => applyStrategy(s)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant={conflictsOnly ? "muted" : "ghost"}
          aria-pressed={conflictsOnly}
          onClick={() => setConflictsOnly((v) => !v)}
        >
          <AlertTriangle className="size-3.5" aria-hidden /> Conflicts only
        </Button>
      </div>

      <div className="overflow-x-auto [scrollbar-width:thin]" data-merge-grid>
        <div className="min-w-max">
          <div
            role="radiogroup"
            aria-label="Primary record (kept after merge)"
            className="grid gap-2 border-b border-crm-border pb-2"
            style={{ gridTemplateColumns: template }}
          >
            <span className="self-end text-[11px] text-crm-muted-fg">Field</span>
            {records.map((r, c) => {
              const primary = r.id === survivorId;
              return (
                <div
                  key={r.id}
                  role="radio"
                  aria-checked={primary}
                  tabIndex={primary ? 0 : -1}
                  data-merge-cell={`-1:${c}`}
                  onClick={() => {
                    setSurvivorId(r.id);
                    if (strategy === "primary") applyStrategy("primary", r.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.click();
                    } else onRadioKey(e, -1, c);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 rounded-crm border p-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
                    primary
                      ? "border-crm-primary/60 bg-crm-primary/10"
                      : "border-crm-border bg-crm-raised hover:border-crm-input",
                  )}
                >
                  <span className="flex items-center gap-1 font-medium text-crm-fg">
                    {primary && <Crown className="size-3 text-crm-warning" aria-hidden />}
                    <span className="truncate">{recordLabel(r.id)}</span>
                  </span>
                  <span className="text-[11px] text-crm-muted-fg">
                    {r.source ? `${r.source} · ` : ""}updated{" "}
                    {dateFmt.format(new Date(r.updatedAt))}
                  </span>
                  <span className="text-[11px] text-crm-soft">
                    {Math.round(completeness(r, fields) * 100)}% complete
                    {primary ? " · primary" : ""}
                  </span>
                </div>
              );
            })}
            <span className="self-end text-[11px] text-crm-muted-fg">Merged result</span>
          </div>

          {visibleFields.map((f, row) => {
            const conflict = conflicts.get(f.key) === true;
            const pick = picks[f.key];
            const baseline = display(byId.get(survivorId)?.values[f.key]);
            const error = formState.errors[f.key]?.message;
            const inputId = `merge-${f.key}`;
            return (
              <div
                key={f.key}
                className={cn(
                  "grid items-stretch gap-2 border-b border-crm-border/60 py-1.5",
                  conflict && "bg-crm-warning/[0.04]",
                )}
                style={{ gridTemplateColumns: template }}
              >
                <div className="flex items-start gap-1.5 pt-1.5 text-xs">
                  {conflict && (
                    <span
                      className="mt-1 size-1.5 shrink-0 rounded-full bg-crm-warning"
                      title="Values conflict"
                    />
                  )}
                  <label htmlFor={inputId} className="text-crm-soft">
                    {f.label}
                    {f.required && <span className="text-crm-danger"> *</span>}
                    {conflict && <span className="sr-only"> (conflict)</span>}
                  </label>
                </div>
                <div role="radiogroup" aria-label={`${f.label} source`} className="contents">
                  {records.map((r, c) => {
                    const v = r.values[f.key];
                    const empty = isEmpty(v);
                    const checked = pick === r.id;
                    const text = display(v);
                    return (
                      <div
                        key={r.id}
                        role="radio"
                        aria-checked={checked}
                        aria-disabled={empty || undefined}
                        aria-label={`${recordLabel(r.id)}: ${empty ? "empty" : text}`}
                        tabIndex={checked || (pick === "custom" && c === 0) ? 0 : -1}
                        data-merge-cell={`${row}:${c}`}
                        onClick={() => !empty && choose(f.key, r.id)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            if (!empty) choose(f.key, r.id);
                          } else onRadioKey(e, row, c);
                        }}
                        className={cn(
                          "flex min-h-8 items-start gap-2 rounded-crm border px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
                          empty
                            ? "cursor-not-allowed border-transparent text-crm-faint"
                            : "cursor-pointer",
                          !empty && checked && "border-crm-primary/60 bg-crm-primary/10",
                          !empty && !checked && "border-crm-border hover:border-crm-input",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 size-3 shrink-0 rounded-full border",
                            checked
                              ? "border-crm-primary bg-crm-primary shadow-[inset_0_0_0_2px_var(--color-crm-bg)]"
                              : "border-crm-input",
                          )}
                        />
                        {empty ? (
                          <span>—</span>
                        ) : conflict && r.id !== survivorId && TEXTUAL.has(f.type) ? (
                          <WordDiff base={baseline} value={text} className="break-words" />
                        ) : (
                          <span
                            className={cn(
                              "break-words",
                              conflict &&
                                r.id !== survivorId &&
                                normalize(v, f.type) !== normalize(baseline, f.type) &&
                                "text-crm-warning",
                            )}
                          >
                            {text}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="relative">
                    {f.type === "longtext" ? (
                      <textarea
                        id={inputId}
                        rows={2}
                        aria-invalid={!!error || undefined}
                        {...register(f.key, {
                          onChange: () => setPicks((p) => ({ ...p, [f.key]: "custom" })),
                        })}
                        className={inputCls(!!error)}
                      />
                    ) : (
                      <input
                        id={inputId}
                        type="text"
                        inputMode={f.type === "number" ? "decimal" : undefined}
                        aria-invalid={!!error || undefined}
                        {...register(f.key, {
                          onChange: () => setPicks((p) => ({ ...p, [f.key]: "custom" })),
                        })}
                        className={inputCls(!!error)}
                      />
                    )}
                    {pick === "custom" && (
                      <PencilLine
                        className="pointer-events-none absolute top-2 right-2 size-3 text-crm-warning"
                        aria-label="Edited"
                      />
                    )}
                  </div>
                  {error && (
                    <span role="alert" className="text-[11px] text-crm-danger">
                      {String(error)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={!formState.isValid && formState.isSubmitted}
        >
          Review merge of {records.length} records
        </Button>
      </div>
    </form>
  );
}

function inputCls(error: boolean) {
  return cn(
    "w-full resize-y rounded-crm border bg-crm-bg px-2 py-1.5 pr-6 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
    error ? "border-crm-danger/60" : "border-crm-input",
  );
}
