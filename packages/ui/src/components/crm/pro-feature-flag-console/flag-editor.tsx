import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodFormResolver } from "@/hooks/zod-form-resolver";
import { z } from "zod";
import type { Field } from "react-querybuilder";
import { GitCompare, Loader2, RotateCcw } from "lucide-react";
import {
  RolloutSlider,
  VariantSplit,
} from "@/components/crm/pro-feature-flag-console/rollout-slider";
import { TargetingRules } from "@/components/crm/pro-feature-flag-console/targeting-rules";
import {
  DiffPreview,
  computeChanges,
  summarizeChanges,
} from "@/components/crm/pro-feature-flag-console/diff-preview";
import { FlagButton, FlagModal } from "@/components/crm/pro-feature-flag-console/modal";
import type {
  FeatureFlag,
  FlagEnvironment,
  FlagEnvironmentConfig,
} from "@/components/crm/pro-feature-flag-console/types";

function buildSchema(variantIds: string[]) {
  const variant = z.string().refine((v) => variantIds.includes(v), "Unknown variant");
  const ruleGroup: z.ZodType<unknown> = z
    .object({ combinator: z.string(), rules: z.array(z.any()) })
    .passthrough();
  return z
    .object({
      enabled: z.boolean(),
      rollout: z.number().int().min(0).max(100),
      split: z.record(z.number().int().min(0).max(100)),
      offVariant: variant,
      rules: z.array(
        z.object({
          id: z.string(),
          name: z.string().trim().min(1, "Name the rule"),
          serve: variant,
          query: ruleGroup,
        }),
      ),
    })
    .superRefine((v, ctx) => {
      const total = variantIds.reduce((a, id) => a + (v.split[id] ?? 0), 0);
      if (total !== 100)
        ctx.addIssue({
          code: "custom",
          path: ["split"],
          message: `Weights must total 100% (now ${total}%)`,
        });
      v.rules.forEach((r, i) => {
        const q = r.query as { rules: unknown[] };
        if (!q.rules.length)
          ctx.addIssue({
            code: "custom",
            path: ["rules", i, "query"],
            message: "Add at least one condition",
          });
      });
    });
}

export interface FlagEditorProps {
  flag: FeatureFlag;
  environment: FlagEnvironment;
  attributes: Field[];
  readOnly?: boolean;
  onSave: (
    config: FlagEnvironmentConfig,
    meta: { comment: string; changes: string[] },
  ) => Promise<void>;
  portalContainer?: HTMLElement | null;
}

/** Per-environment editor. Parent remounts it (key) when the flag or environment changes. */
export function FlagEditor({
  flag,
  environment,
  attributes,
  readOnly,
  onSave,
  portalContainer,
}: FlagEditorProps) {
  const original = flag.environments[environment.key];
  const variantIds = React.useMemo(() => flag.variants.map((v) => v.id), [flag.variants]);
  const schema = React.useMemo(() => buildSchema(variantIds), [variantIds]);
  const form = useForm<FlagEnvironmentConfig>({
    resolver: zodFormResolver(schema) as never,
    defaultValues: original,
    mode: "onChange",
  });
  const { control, handleSubmit, reset, formState, watch } = form;
  const [review, setReview] = React.useState<FlagEnvironmentConfig | null>(null);
  const [comment, setComment] = React.useState("");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const current = watch();

  if (!original) {
    return (
      <p className="p-4 text-[13px] text-crm-muted-fg">
        This flag is not configured in {environment.name}.
      </p>
    );
  }

  const ruleErrors: Record<number, string | undefined> = {};
  formState.errors.rules?.forEach?.((e, i) => {
    const q = e?.query as { message?: string } | undefined;
    ruleErrors[i] = e?.name?.message ?? q?.message ?? e?.serve?.message;
  });

  const confirm = async () => {
    if (!review) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(review, {
        comment: comment.trim(),
        changes: summarizeChanges(computeChanges(original, review)),
      });
      reset(review);
      setReview(null);
      setComment("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const section = "space-y-2.5 border-b border-crm-border px-4 py-4";
  const h = "text-[13px] font-semibold";

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={handleSubmit((v) => {
        // `enabled` is owned by the toggle, never by this draft (avoids clobbering a concurrent toggle).
        setReview({
          ...(JSON.parse(JSON.stringify(v)) as FlagEnvironmentConfig),
          enabled: original?.enabled ?? v.enabled,
        });
      })}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className={section} aria-labelledby="ff-rules">
          <div>
            <h3 id="ff-rules" className={h}>
              Targeting rules
            </h3>
            <p className="text-xs text-crm-muted-fg">
              Evaluated top to bottom; the first matching rule serves its variant.
            </p>
          </div>
          <Controller
            control={control}
            name="rules"
            render={({ field }) => (
              <TargetingRules
                rules={field.value}
                onChange={field.onChange}
                attributes={attributes}
                variants={flag.variants}
                disabled={readOnly}
                errors={ruleErrors}
              />
            )}
          />
        </section>

        <section className={section} aria-labelledby="ff-rollout">
          <div>
            <h3 id="ff-rollout" className={h}>
              Percentage rollout
            </h3>
            <p className="text-xs text-crm-muted-fg">
              Share of remaining traffic bucketed by a stable hash of the user key.
            </p>
          </div>
          <Controller
            control={control}
            name="rollout"
            render={({ field }) => (
              <RolloutSlider value={field.value} onChange={field.onChange} disabled={readOnly} />
            )}
          />
          {flag.variants.length > 1 ? (
            <>
              <h4 className="pt-2 text-xs font-medium text-crm-soft">
                Variant split inside the rollout
              </h4>
              <Controller
                control={control}
                name="split"
                render={({ field }) => (
                  <VariantSplit
                    variants={flag.variants}
                    split={field.value}
                    onChange={field.onChange}
                    disabled={readOnly}
                  />
                )}
              />
              {formState.errors.split ? (
                <p className="text-xs text-crm-danger">
                  {(formState.errors.split as { message?: string }).message}
                </p>
              ) : null}
            </>
          ) : null}
        </section>

        <section className={section} aria-labelledby="ff-off">
          <h3 id="ff-off" className={h}>
            Default / off variant
          </h3>
          <Controller
            control={control}
            name="offVariant"
            render={({ field }) => (
              <select
                value={field.value}
                onChange={field.onChange}
                disabled={readOnly}
                aria-labelledby="ff-off"
                className="h-8 rounded-md border border-crm-input bg-crm-bg px-2 text-[13px] focus:border-crm-ring focus:outline-none"
              >
                {flag.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.value})
                  </option>
                ))}
              </select>
            )}
          />
          <p className="text-xs text-crm-muted-fg">
            Summary: {current.rules?.length ?? 0} rule(s), then {current.rollout ?? 0}% rollout;
            everyone else gets {flag.variants.find((v) => v.id === current.offVariant)?.name ?? "?"}
            .
          </p>
        </section>
      </div>

      {!readOnly ? (
        <div className="flex items-center gap-2 border-t border-crm-border bg-crm-card px-4 py-2.5">
          <span className="text-xs text-crm-muted-fg">
            {formState.isDirty ? "Unsaved changes" : "No changes"}
          </span>
          <FlagButton
            className="ml-auto"
            disabled={!formState.isDirty}
            onClick={() => reset(original)}
          >
            <RotateCcw className="size-3.5" aria-hidden /> Discard
          </FlagButton>
          <FlagButton type="submit" variant="primary" disabled={!formState.isDirty}>
            <GitCompare className="size-3.5" aria-hidden /> Review changes
          </FlagButton>
        </div>
      ) : null}

      <FlagModal
        open={!!review}
        onOpenChange={(o) => !o && setReview(null)}
        locked={saving}
        container={portalContainer}
        title={`Save ${flag.key} in ${environment.name}`}
        description="JSON diff of the environment configuration that will be published to SDKs."
        className="w-[min(680px,calc(100vw-32px))]"
        footer={
          <>
            <FlagButton onClick={() => setReview(null)} disabled={saving}>
              Back to editing
            </FlagButton>
            <FlagButton
              variant="primary"
              onClick={confirm}
              disabled={saving || (environment.critical === true && !comment.trim())}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Publish to {environment.name}
            </FlagButton>
          </>
        }
      >
        <div className="space-y-4">
          <DiffPreview before={original} after={review} />
          <div className="space-y-1.5">
            <label htmlFor="ff-comment" className="text-[13px] font-medium">
              Change reason{" "}
              {environment.critical ? <span className="text-crm-danger">*</span> : "(optional)"}
            </label>
            <textarea
              id="ff-comment"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Ramp to 50% after error budget review (INC-2231)"
              className="w-full resize-none rounded-md border border-crm-input bg-crm-bg px-3 py-2 text-[13px] placeholder:text-crm-subtle focus:border-crm-ring focus:outline-none"
            />
          </div>
          {saveError ? (
            <p
              role="alert"
              className="rounded-md border border-crm-danger/40 bg-crm-danger/10 px-3 py-2 text-xs text-crm-danger"
            >
              {saveError}
            </p>
          ) : null}
        </div>
      </FlagModal>
    </form>
  );
}
