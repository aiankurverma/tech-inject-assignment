import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientContext, QueryClientProvider } from "@tanstack/react-query";
import { useForm, type FieldErrors, type FieldValues, type Resolver } from "react-hook-form";
import type { ZodType } from "zod";
import * as Tabs from "@radix-ui/react-tabs";
import { AlertTriangle, Loader2, RotateCw, Save, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useOptimisticRecord } from "@/hooks/use-optimistic-record";
import { InlineField } from "@/components/crm/pro-record-page/inline-field";
import {
  buildRecordSchema,
  displayValue,
  normalizeValue,
  type RecordFieldDef,
} from "@/components/crm/pro-record-page/schema";

/**
 * Minimal zod -> react-hook-form resolver. The sandbox only exposes the root of
 * @hookform/resolvers (its /zod entry is not on the import allow-list), so this mirrors
 * zodResolver's contract: first issue per top-level field becomes that field's error.
 */
function zodSchemaResolver(schema: ZodType): Resolver<FieldValues> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data as FieldValues, errors: {} };
    const errors: FieldErrors<FieldValues> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "root");
      if (!errors[key]) errors[key] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors };
  };
}

export type {
  FieldType,
  PicklistOption,
  RecordFieldDef,
} from "@/components/crm/pro-record-page/schema";
export { formatMoney, formatPhone } from "@/components/crm/pro-record-page/schema";

export interface RelatedTab {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

export interface ProRecordPageProps<T extends object> {
  /** Cache key of this record, e.g. ["opportunity", id]. */
  queryKey: readonly unknown[];
  /** Initial data (and the source of truth when `loadRecord` is omitted). */
  record?: T;
  loadRecord?: (signal: AbortSignal) => Promise<T>;
  /** Persist changed fields. Reject to roll the optimistic update back. */
  onSave: (patch: Partial<T>, next: T) => Promise<T | void>;
  onSaved?: (record: T) => void;
  onSaveError?: (error: Error, patch: Partial<T>) => void;
  fields: RecordFieldDef<T>[];
  /** Field used as the page title. */
  titleField: Extract<keyof T, string>;
  /** Small label above the title, e.g. "Opportunity". */
  objectLabel?: string;
  icon?: ReactNode;
  /** Key fields shown in the header strip. */
  headerFields?: Extract<keyof T, string>[];
  actions?: ReactNode;
  related?: RelatedTab[];
  /** Right-hand column, typically <ProActivityTimeline />. */
  activity?: ReactNode;
  /** "batch": collect edits and save together (default). "field": save each field on commit. */
  saveMode?: "batch" | "field";
  readOnly?: boolean;
  tab?: string;
  defaultTab?: string;
  onTabChange?: (tab: string) => void;
  queryClient?: QueryClient;
  className?: string;
}

/** Salesforce-style record page: key-field header, typed inline editing, related tabs, activity slot. */
export function ProRecordPage<T extends object>({ queryClient, ...props }: ProRecordPageProps<T>) {
  const ctx = useContext(QueryClientContext);
  const [own] = useState(() => (queryClient || ctx ? null : new QueryClient()));
  const client = queryClient ?? own;
  if (client)
    return (
      <QueryClientProvider client={client}>
        <RecordPage {...props} />
      </QueryClientProvider>
    );
  return <RecordPage {...props} />;
}

function emptyFor<T>(f: RecordFieldDef<T>) {
  return f.type === "money" || f.type === "number" || f.type === "date" ? null : "";
}

function RecordPage<T extends object>({
  queryKey,
  record,
  loadRecord,
  onSave,
  onSaved,
  onSaveError,
  fields,
  titleField,
  objectLabel,
  icon,
  headerFields = [],
  actions,
  related = [],
  activity,
  saveMode = "batch",
  readOnly,
  tab: tabProp,
  defaultTab = "details",
  onTabChange,
  className,
}: Omit<ProRecordPageProps<T>, "queryClient">) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const { query, mutation } = useOptimisticRecord<T>({
    queryKey,
    record,
    loadRecord,
    onSave,
    onSaved,
    onSaveError: (e, p) => {
      setSaveError(e.message || "Save failed");
      onSaveError?.(e, p);
    },
  });
  const data = query.data;
  const byName = useMemo(() => new Map(fields.map((f) => [f.name as string, f])), [fields]);
  const schema = useMemo(() => buildRecordSchema(fields), [fields]);

  const values = useMemo(() => {
    const out: FieldValues = {};
    const src = (data ?? {}) as Record<string, unknown>;
    for (const f of fields) out[f.name] = src[f.name] ?? emptyFor(f);
    return out;
  }, [data, fields]);

  const form = useForm<FieldValues>({
    resolver: zodSchemaResolver(schema),
    values,
    // background refetches must not wipe what the user is typing
    resetOptions: { keepDirtyValues: true },
    mode: "onChange",
  });
  const { dirtyFields, isValid } = form.formState;
  const dirtyNames = Object.keys(dirtyFields).filter((k) => dirtyFields[k]);
  const dirtyCount = dirtyNames.length;

  const save = useCallback(
    (only?: string[]) =>
      form.handleSubmit((vals) => {
        const names = only ?? Object.keys(form.formState.dirtyFields);
        if (!names.length) return;
        const patch: Record<string, unknown> = {};
        for (const n of names) {
          const f = byName.get(n);
          if (f && !f.readOnly) patch[n] = normalizeValue(f, vals[n]);
        }
        setSaveError(null);
        // Optimistic: the form becomes clean at once; on failure the edits come back as dirty.
        form.reset({ ...form.getValues(), ...patch }, { keepDirtyValues: !!only });
        mutation.mutate(patch as Partial<T>, {
          onError: () => {
            for (const [k, v] of Object.entries(patch))
              form.setValue(k, v, { shouldDirty: true, shouldValidate: true });
          },
        });
      })(),
    [form, byName, mutation],
  );

  const discard = () => {
    form.reset(values);
    setSaveError(null);
  };

  useEffect(() => {
    if (!dirtyCount) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  const [tab, setTab] = useControllableState(tabProp, defaultTab, onTabChange);
  const locked = readOnly || !data;
  const sections = useMemo(() => {
    const m = new Map<string, RecordFieldDef<T>[]>();
    for (const f of fields) {
      const k = f.section ?? "Details";
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return [...m];
  }, [fields]);

  if (query.isPending) return <PageSkeleton className={className} />;
  if (query.isError && !data)
    return (
      <div
        role="alert"
        className={cn(shell, "items-center justify-center gap-3 p-10 text-center", className)}
      >
        <AlertTriangle className="size-6 text-crm-danger" />
        <p className="text-sm font-medium">Couldn't load this record</p>
        <p className="text-xs text-crm-muted-fg">{query.error.message}</p>
        <button type="button" className={ghostBtn} onClick={() => void query.refetch()}>
          <RotateCw className="size-3.5" /> Try again
        </button>
      </div>
    );

  const src = (data ?? {}) as Record<string, unknown>;
  const title = String(form.watch(titleField) ?? src[titleField] ?? "Untitled");

  return (
    <div
      className={cn(shell, className)}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (dirtyCount && saveMode === "batch") void save();
        }
      }}
    >
      <header className="border-b border-crm-border px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          {icon && (
            <span className="grid size-10 shrink-0 place-items-center rounded-crm bg-crm-primary/15 text-crm-primary">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {objectLabel && <p className="crm-eyebrow text-crm-muted-fg">{objectLabel}</p>}
            <h1 className="truncate text-xl font-semibold text-crm-fg">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mutation.isPending && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 text-xs text-crm-muted-fg"
              >
                <Loader2 className="size-3.5 animate-spin" /> Saving…
              </span>
            )}
            {actions}
          </div>
        </div>
        {headerFields.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-x-10">
            {headerFields.map((n) => {
              const f = byName.get(n);
              if (!f) return null;
              const v = src[n];
              const pill =
                f.type === "picklist" ? f.options?.find((o) => o.value === v) : undefined;
              return (
                <div key={n} className="min-w-0">
                  <dt className="text-xs text-crm-muted-fg">{f.label}</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-crm-fg">
                    {pill?.tone ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", pill.tone)}>
                        {pill.label}
                      </span>
                    ) : (
                      displayValue(f, v) || "—"
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </header>

      {saveError && (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-crm-danger/30 bg-crm-danger/10 px-5 py-2 text-sm text-crm-danger"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            Changes were not saved: {saveError}. Your edits are kept below.
          </span>
          <button type="button" className={ghostBtn} onClick={() => void save()}>
            <RotateCw className="size-3.5" /> Retry
          </button>
        </div>
      )}

      <div
        className={cn(
          "grid min-h-0 flex-1",
          activity && "lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]",
        )}
      >
        <Tabs.Root value={tab} onValueChange={setTab} className="flex min-w-0 flex-col">
          <Tabs.List
            aria-label="Record sections"
            className="flex gap-1 overflow-x-auto border-b border-crm-border px-4"
          >
            {[{ id: "details", label: "Details" }, ...related].map((t) => (
              <Tabs.Trigger
                key={t.id}
                value={t.id}
                className="relative inline-flex h-10 shrink-0 items-center gap-1.5 px-2 text-sm text-crm-muted-fg outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-crm-ring data-[state=active]:text-crm-fg data-[state=active]:after:absolute data-[state=active]:after:inset-x-1 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-crm-primary"
              >
                {t.label}
                {"count" in t && t.count !== undefined && (
                  <span className="rounded-full bg-crm-muted px-1.5 text-[11px] tabular-nums text-crm-soft">
                    {t.count.toLocaleString()}
                  </span>
                )}
                {t.id === "details" && dirtyCount > 0 && (
                  <span
                    className="size-1.5 rounded-full bg-crm-warning"
                    aria-label={`${dirtyCount} unsaved`}
                  />
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="details" className="flex-1 outline-none">
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="space-y-6 p-5"
            >
              {sections.map(([name, fs]) => (
                <fieldset key={name} className="min-w-0">
                  <legend className="mb-3 crm-eyebrow text-crm-muted-fg">{name}</legend>
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    {fs.map((f) => (
                      <InlineField
                        key={f.name}
                        field={f}
                        control={form.control}
                        trigger={form.trigger}
                        disabled={locked}
                        onCommitted={saveMode === "field" ? (n) => void save([n]) : undefined}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
            </form>
          </Tabs.Content>
          {related.map((t) => (
            <Tabs.Content key={t.id} value={t.id} className="min-h-0 flex-1 outline-none">
              {t.content}
            </Tabs.Content>
          ))}
        </Tabs.Root>

        {activity && (
          <aside
            aria-label="Activity"
            className="min-w-0 border-t border-crm-border p-4 lg:border-l lg:border-t-0"
          >
            {activity}
          </aside>
        )}
      </div>

      {saveMode === "batch" && dirtyCount > 0 && (
        <div
          role="region"
          aria-label="Unsaved changes"
          className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-crm-border bg-crm-raised/95 px-5 py-3 backdrop-blur animate-crm-in"
        >
          <span className="size-2 rounded-full bg-crm-warning" aria-hidden />
          <p className="flex-1 text-sm text-crm-fg">
            {dirtyCount} unsaved {dirtyCount === 1 ? "change" : "changes"}
            <span className="ml-2 hidden text-xs text-crm-muted-fg sm:inline">
              {dirtyNames.map((n) => byName.get(n)?.label ?? n).join(", ")}
            </span>
          </p>
          <button type="button" className={ghostBtn} onClick={discard}>
            <Undo2 className="size-3.5" /> Discard
          </button>
          <button
            type="button"
            disabled={!isValid || mutation.isPending}
            onClick={() => void save()}
            className="inline-flex h-8 items-center gap-1.5 rounded-crm bg-crm-primary px-3 text-sm font-medium text-crm-primary-fg shadow-crm-primary hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-50"
          >
            <Save className="size-3.5" /> Save
            <kbd className="ml-1 hidden rounded border border-white/20 px-1 text-[10px] sm:inline">
              Ctrl S
            </kbd>
          </button>
        </div>
      )}
    </div>
  );
}

const shell =
  "relative flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised";
const ghostBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-crm px-2.5 text-sm text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring";

function PageSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading record"
      className={cn(shell, "animate-pulse gap-4 p-5", className)}
    >
      <span className="h-3 w-24 rounded bg-crm-muted" />
      <span className="h-6 w-72 rounded bg-crm-muted" />
      <div className="flex gap-10">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="h-8 w-28 rounded bg-crm-muted/70" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="h-12 rounded bg-crm-muted/50" />
        ))}
      </div>
    </div>
  );
}
