import * as React from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import {
  billingKeys,
  type BillingApi,
  type BillingDetails,
} from "@/components/crm/pro-billing-portal/billing-types";

/** EU VAT / GB / US EIN / AU ABN / IN GSTIN shapes — a format check only; verify server-side (e.g. VIES). */
const TAX_ID = /^([A-Z]{2}[A-Z0-9]{2,13}|\d{2}-\d{7}|\d{11}|\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d])$/;

export const billingDetailsSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required"),
  email: z.string().trim().email("Enter a valid billing email"),
  line1: z.string().trim().min(3, "Street address is required"),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, "City is required"),
  postalCode: z.string().trim().min(3, "Postal code is required").max(10),
  country: z.string().length(2, "Choose a country"),
  taxId: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .refine((v) => v === "" || TAX_ID.test(v), "Tax ID format not recognised")
    .optional(),
});

/** Minimal zod → react-hook-form resolver (avoids a subpath import of @hookform/resolvers). */
const zodResolver =
  <T extends z.ZodTypeAny>(schema: T): Resolver<z.input<T>> =>
  async (values) => {
    const r = await schema.safeParseAsync(values);
    if (r.success) return { values: r.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of r.error.issues) {
      const k = issue.path.join(".");
      if (!errors[k]) errors[k] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as unknown as FieldErrors<z.input<T>> };
  };

export const COUNTRIES: [string, string][] = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["NL", "Netherlands"],
  ["IE", "Ireland"],
  ["ES", "Spain"],
  ["IN", "India"],
  ["AU", "Australia"],
  ["CA", "Canada"],
  ["SG", "Singapore"],
  ["JP", "Japan"],
];

const inputCls =
  "h-9 w-full rounded-crm border bg-crm-input px-2.5 text-sm text-crm-fg placeholder:text-crm-muted-fg focus:outline-none focus:ring-2 focus:ring-crm-ring disabled:opacity-60";

export function DetailsPanel({
  api,
  details,
  disabled,
}: {
  api: BillingApi;
  details: BillingDetails;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const form = useForm<z.input<typeof billingDetailsSchema>>({
    resolver: zodResolver(billingDetailsSchema),
    defaultValues: details,
    mode: "onBlur",
  });
  React.useEffect(() => form.reset(details), [details, form]);
  const save = useMutation({
    mutationFn: (v: BillingDetails) => api.updateDetails(v),
    onSuccess: (_, v) => {
      form.reset(v);
      return qc.invalidateQueries({ queryKey: billingKeys.overview });
    },
  });
  const { errors, isDirty } = form.formState;
  const id = React.useId();

  const field = (
    name: keyof BillingDetails,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => {
    const err = errors[name]?.message;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-${name}`} className="text-xs text-crm-muted-fg">
          {label}
        </label>
        <input
          id={`${id}-${name}`}
          aria-invalid={!!err}
          aria-describedby={err ? `${id}-${name}-err` : undefined}
          disabled={disabled}
          className={cn(inputCls, err ? "border-crm-danger" : "border-crm-border")}
          {...props}
          {...form.register(name)}
        />
        {err && (
          <p id={`${id}-${name}-err`} className="text-[11px] text-crm-danger">
            {String(err)}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => save.mutate(v as BillingDetails))}
      className="flex max-w-2xl flex-col gap-4"
    >
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Billing contact</legend>
        {field("companyName", "Company name", { autoComplete: "organization" })}
        {field("email", "Billing email", { type: "email", autoComplete: "email" })}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Address</legend>
        <div className="sm:col-span-2">
          {field("line1", "Street address", { autoComplete: "address-line1" })}
        </div>
        <div className="sm:col-span-2">
          {field("line2", "Apartment, suite (optional)", { autoComplete: "address-line2" })}
        </div>
        {field("city", "City", { autoComplete: "address-level2" })}
        {field("postalCode", "Postal code", { autoComplete: "postal-code" })}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-country`} className="text-xs text-crm-muted-fg">
            Country
          </label>
          <select
            id={`${id}-country`}
            disabled={disabled}
            className={cn(inputCls, "border-crm-border")}
            {...form.register("country")}
          >
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {field("taxId", "Tax ID / VAT (optional)", { placeholder: "e.g. DE123456789" })}
      </fieldset>
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={disabled || !isDirty}
          loading={save.isPending}
        >
          Save details
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!isDirty}
          onClick={() => form.reset(details)}
        >
          Reset
        </Button>
        <span aria-live="polite" className="text-xs">
          {save.isSuccess && !isDirty && <span className="text-crm-success">Saved</span>}
          {save.isError && <span className="text-crm-danger">{String(save.error)}</span>}
        </span>
      </div>
    </form>
  );
}
