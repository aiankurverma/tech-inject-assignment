import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodFormResolver } from "@/hooks/zod-form-resolver";
import { z } from "zod";
import { addDays, format } from "date-fns";
import { Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { KeyButton, KeyModal } from "@/components/crm/pro-api-key-manager/modal";
import type { ApiKeyScope, CreateApiKeyInput } from "@/components/crm/pro-api-key-manager/types";

export const EXPIRY_PRESETS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "custom", label: "Custom date" },
  { value: "never", label: "No expiry" },
] as const;

function buildSchema(existingNames: Set<string>, allowNoExpiry: boolean) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(3, "Use at least 3 characters")
        .max(64, "Keep it under 64 characters")
        .refine((v) => !existingNames.has(v.toLowerCase()), "An active key already uses this name"),
      environment: z.enum(["live", "test"]),
      scopes: z.array(z.string()).min(1, "Select at least one scope"),
      expiry: z.enum(["7", "30", "90", "365", "custom", "never"]),
      customDate: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      if (v.expiry === "never" && !allowNoExpiry) {
        ctx.addIssue({ code: "custom", path: ["expiry"], message: "Your org requires an expiry" });
      }
      if (v.expiry === "custom") {
        const t = v.customDate ? Date.parse(v.customDate) : NaN;
        if (Number.isNaN(t))
          ctx.addIssue({ code: "custom", path: ["customDate"], message: "Pick a date" });
        else if (t <= Date.now())
          ctx.addIssue({ code: "custom", path: ["customDate"], message: "Must be in the future" });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export interface CreateKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopes: ApiKeyScope[];
  existingNames: string[];
  allowNoExpiry?: boolean;
  defaultExpiry?: FormValues["expiry"];
  onSubmit: (input: CreateApiKeyInput) => Promise<void>;
  container?: HTMLElement | null;
}

export function CreateKeyDialog({
  open,
  onOpenChange,
  scopes,
  existingNames,
  allowNoExpiry = true,
  defaultExpiry = "90",
  onSubmit,
  container,
}: CreateKeyDialogProps) {
  const schema = React.useMemo(
    () => buildSchema(new Set(existingNames.map((n) => n.toLowerCase())), allowNoExpiry),
    [existingNames, allowNoExpiry],
  );
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodFormResolver(schema),
    defaultValues: { name: "", environment: "test", scopes: [], expiry: defaultExpiry },
  });

  React.useEffect(() => {
    if (open) reset({ name: "", environment: "test", scopes: [], expiry: defaultExpiry });
  }, [open, reset, defaultExpiry]);

  const groups = React.useMemo(() => {
    const map = new Map<string, ApiKeyScope[]>();
    for (const s of scopes) {
      const g = s.group ?? "General";
      map.set(g, [...(map.get(g) ?? []), s]);
    }
    return [...map.entries()];
  }, [scopes]);

  const expiry = watch("expiry");
  const env = watch("environment");

  const submit = handleSubmit(async (v) => {
    const expiresAt =
      v.expiry === "never"
        ? null
        : v.expiry === "custom"
          ? new Date(`${v.customDate}T23:59:59`).toISOString()
          : addDays(new Date(), Number(v.expiry)).toISOString();
    try {
      await onSubmit({
        name: v.name.trim(),
        environment: v.environment,
        scopes: v.scopes,
        expiresAt,
      });
    } catch (e) {
      setError("root", { message: e instanceof Error ? e.message : "Could not create key" });
    }
  });

  const fieldCls =
    "h-9 w-full rounded-md border border-crm-input bg-crm-bg px-3 text-[13px] text-crm-fg placeholder:text-crm-subtle focus:border-crm-ring focus:outline-none aria-[invalid=true]:border-crm-danger";

  return (
    <KeyModal
      open={open}
      onOpenChange={onOpenChange}
      locked={isSubmitting}
      container={container}
      title="Create API key"
      description="Keys inherit your workspace permissions, narrowed to the scopes you choose."
      footer={
        <>
          <KeyButton onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </KeyButton>
          <KeyButton variant="primary" type="submit" form="create-api-key" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Create key
          </KeyButton>
        </>
      }
    >
      <form id="create-api-key" onSubmit={submit} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="ak-name" className="text-[13px] font-medium">
            Name
          </label>
          <input
            id="ak-name"
            autoFocus
            autoComplete="off"
            placeholder="e.g. Billing sync worker"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "ak-name-err" : undefined}
            className={fieldCls}
            {...register("name")}
          />
          {errors.name ? (
            <p id="ak-name-err" className="text-xs text-crm-danger">
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-[13px] font-medium">Environment</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["test", "live"] as const).map((e) => (
              <label
                key={e}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-crm-ring",
                  env === e
                    ? "border-crm-primary bg-crm-primary/10"
                    : "border-crm-border bg-crm-raised",
                )}
              >
                <input type="radio" value={e} className="sr-only" {...register("environment")} />
                <span
                  className={cn(
                    "size-2 rounded-full",
                    e === "live" ? "bg-crm-success" : "bg-crm-warning",
                  )}
                  aria-hidden
                />
                {e === "live" ? "Live" : "Test"}
                <span className="ml-auto font-mono text-[11px] text-crm-muted-fg">kb_{e}_</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Controller
          control={control}
          name="scopes"
          render={({ field }) => {
            const selected = new Set(field.value);
            const toggle = (ids: string | string[], on: boolean) => {
              const next = new Set(selected);
              for (const id of Array.isArray(ids) ? ids : [ids]) {
                if (on) next.add(id);
                else next.delete(id);
              }
              field.onChange(scopes.filter((s) => next.has(s.id)).map((s) => s.id));
            };
            return (
              <fieldset aria-describedby={errors.scopes ? "ak-scopes-err" : undefined}>
                <div className="mb-2 flex items-center justify-between">
                  <legend className="text-[13px] font-medium">Scopes</legend>
                  <span className="text-xs text-crm-muted-fg">
                    {selected.size} of {scopes.length} selected
                  </span>
                </div>
                <div className="space-y-3 rounded-md border border-crm-border bg-crm-raised p-3">
                  {groups.map(([group, items]) => {
                    const all = items.every((s) => selected.has(s.id));
                    return (
                      <div key={group}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-crm-muted-fg">
                            {group}
                          </span>
                          <button
                            type="button"
                            className="text-[11px] text-crm-soft hover:text-crm-fg"
                            onClick={() =>
                              toggle(
                                items.map((s) => s.id),
                                !all,
                              )
                            }
                          >
                            {all ? "Clear" : "Select all"}
                          </button>
                        </div>
                        <div className="grid gap-1 sm:grid-cols-2">
                          {items.map((s) => (
                            <label
                              key={s.id}
                              className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-crm-muted"
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(s.id)}
                                onChange={(e) => toggle(s.id, e.target.checked)}
                                className="mt-0.5 size-3.5 accent-[var(--color-crm-primary)]"
                              />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1">
                                  <span className="font-mono text-[12px]">{s.id}</span>
                                  {s.sensitive ? (
                                    <ShieldAlert
                                      className="size-3 text-crm-warning"
                                      aria-label="Sensitive"
                                    />
                                  ) : null}
                                </span>
                                {s.description ? (
                                  <span className="block text-[11px] text-crm-muted-fg">
                                    {s.description}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {errors.scopes ? (
                  <p id="ak-scopes-err" className="mt-1.5 text-xs text-crm-danger">
                    {errors.scopes.message}
                  </p>
                ) : null}
              </fieldset>
            );
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="ak-expiry" className="text-[13px] font-medium">
              Expires
            </label>
            <select
              id="ak-expiry"
              className={fieldCls}
              aria-invalid={!!errors.expiry}
              {...register("expiry")}
            >
              {EXPIRY_PRESETS.filter((p) => allowNoExpiry || p.value !== "never").map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {errors.expiry ? (
              <p className="text-xs text-crm-danger">{errors.expiry.message}</p>
            ) : null}
          </div>
          {expiry === "custom" ? (
            <div className="space-y-1.5">
              <label htmlFor="ak-date" className="text-[13px] font-medium">
                Expiry date
              </label>
              <input
                id="ak-date"
                type="date"
                min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                aria-invalid={!!errors.customDate}
                className={cn(fieldCls, "[color-scheme:dark]")}
                {...register("customDate")}
              />
              {errors.customDate ? (
                <p className="text-xs text-crm-danger">{errors.customDate.message}</p>
              ) : null}
            </div>
          ) : (
            <p className="self-end pb-2 text-xs text-crm-muted-fg">
              {expiry === "never"
                ? "Non-expiring keys should be rotated manually."
                : `Expires ${format(addDays(new Date(), Number(expiry)), "MMM d, yyyy")}`}
            </p>
          )}
        </div>

        {errors.root ? (
          <p
            role="alert"
            className="rounded-md border border-crm-danger/40 bg-crm-danger/10 px-3 py-2 text-xs text-crm-danger"
          >
            {errors.root.message}
          </p>
        ) : null}
      </form>
    </KeyModal>
  );
}
