import * as React from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { z } from "zod";
import { cn } from "@/lib/utils";
import type { QuoteHeader } from "@/components/crm/pro-cpq-quote-builder/types";

export const quoteHeaderSchema = z.object({
  customer: z.string().trim().min(2, "Customer name is required"),
  contactEmail: z.string().trim().email("Enter a valid email"),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  paymentTerms: z.enum(["net15", "net30", "net45", "net60"]),
  notes: z.string().max(2000, "Keep notes under 2,000 characters"),
});

/** Minimal zod -> react-hook-form resolver (the @hookform/resolvers/zod subpath is not exposed). */
const resolver: Resolver<QuoteHeader> = async (values) => {
  const r = quoteHeaderSchema.safeParse(values);
  if (r.success) return { values: r.data, errors: {} };
  const errors: FieldErrors<QuoteHeader> = {};
  for (const issue of r.error.issues) {
    const key = issue.path[0] as keyof QuoteHeader;
    if (!errors[key]) errors[key] = { type: issue.code, message: issue.message };
  }
  return { values: {}, errors };
};

const field =
  "h-8 w-full rounded-crm border bg-crm-input px-2.5 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50";

export interface QuoteHeaderFormProps {
  value: QuoteHeader;
  disabled?: boolean;
  onValidChange: (header: QuoteHeader) => void;
}

/** Customer/terms header. Valid edits are pushed up on blur; invalid fields show inline errors. */
export function QuoteHeaderForm({ value, disabled, onValidChange }: QuoteHeaderFormProps) {
  const id = React.useId();
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<QuoteHeader>({ defaultValues: value, resolver, mode: "onBlur" });
  React.useEffect(() => reset(value), [value, reset]);
  const push = handleSubmit(onValidChange);

  const err = (k: keyof QuoteHeader) =>
    errors[k] ? (
      <p id={`${id}-${k}-err`} className="mt-1 text-[11px] text-crm-danger">
        {errors[k]?.message}
      </p>
    ) : null;
  const a11y = (k: keyof QuoteHeader) => ({
    id: `${id}-${k}`,
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `${id}-${k}-err` : undefined,
    className: cn(field, errors[k] ? "border-crm-danger" : "border-crm-border"),
    disabled,
  });
  const lbl = "mb-1 block text-[11px] font-medium text-crm-muted-fg";

  return (
    <form
      noValidate
      onBlur={() => void push()}
      onSubmit={(e) => {
        e.preventDefault();
        void push();
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Quote details"
    >
      <div>
        <label htmlFor={`${id}-customer`} className={lbl}>
          Customer
        </label>
        <input {...register("customer")} {...a11y("customer")} />
        {err("customer")}
      </div>
      <div>
        <label htmlFor={`${id}-contactEmail`} className={lbl}>
          Contact email
        </label>
        <input type="email" {...register("contactEmail")} {...a11y("contactEmail")} />
        {err("contactEmail")}
      </div>
      <div>
        <label htmlFor={`${id}-validUntil`} className={lbl}>
          Valid until
        </label>
        <input type="date" {...register("validUntil")} {...a11y("validUntil")} />
        {err("validUntil")}
      </div>
      <div>
        <label htmlFor={`${id}-paymentTerms`} className={lbl}>
          Payment terms
        </label>
        <select {...register("paymentTerms")} {...a11y("paymentTerms")}>
          <option value="net15">Net 15</option>
          <option value="net30">Net 30</option>
          <option value="net45">Net 45</option>
          <option value="net60">Net 60</option>
        </select>
        {err("paymentTerms")}
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <label htmlFor={`${id}-notes`} className={lbl}>
          Notes on quote
        </label>
        <textarea
          rows={2}
          {...register("notes")}
          {...a11y("notes")}
          className={cn(a11y("notes").className, "h-auto py-1.5")}
        />
        {err("notes")}
      </div>
    </form>
  );
}
