import * as React from "react";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import {
  STEPS,
  checkoutSchema,
  checkPhone,
  checkVatId,
  normalizeVatId,
  type CheckoutField,
  type CheckoutValues,
  type StepId,
} from "@/components/crm/pro-checkout-flow/schema";
import {
  computeTotals,
  moneyFormatter,
  type CartItem,
  type CouponResult,
  type ShippingOption,
  type TaxRegion,
  type Totals,
} from "@/components/crm/pro-checkout-flow/pricing";
import { OrderSummary, type CouponState } from "@/components/crm/pro-checkout-flow/order-summary";
import { ErrorSummary, Field, inputCls } from "@/components/crm/pro-checkout-flow/fields";

export type { CartItem, ShippingOption, CouponResult, TaxRegion, Totals, CheckoutValues, StepId };
export { computeTotals, checkVatId, checkPhone };
export { DEFAULT_TAX } from "@/components/crm/pro-checkout-flow/pricing";

export interface PaymentSlotContext {
  amount: number;
  currency: string;
  /** The provider element reports whether its fields are complete. */
  setReady: (ready: boolean) => void;
  disabled: boolean;
}

export interface PaymentMethod {
  id: string;
  label: string;
  description?: string;
  /** Render the provider's element (Stripe Elements, Adyen, PayPal button...). Not bundled. */
  render?: (ctx: PaymentSlotContext) => React.ReactNode;
}

export interface CheckoutOrder {
  values: CheckoutValues;
  items: CartItem[];
  totals: Totals;
  couponCode?: string;
  /** Phone number in E.164. */
  phoneE164?: string;
}

export interface ProCheckoutFlowProps {
  items: CartItem[];
  currency?: string;
  locale?: string;
  sellerCountry?: string;
  countries?: { code: string; name: string }[];
  shippingOptions: ShippingOption[];
  paymentMethods: PaymentMethod[];
  taxTable?: Record<string, TaxRegion>;
  defaultValues?: Partial<CheckoutValues>;
  onApplyCoupon?: (code: string) => Promise<CouponResult> | CouponResult;
  /** Optional remote VAT check (e.g. VIES), run after the syntax check passes. */
  verifyVatId?: (vatId: string, country: string) => Promise<boolean>;
  /** Resolve to finish, or return { error } to show a submission error. */
  onPlaceOrder: (order: CheckoutOrder) => Promise<void | { error: string }>;
  step?: StepId;
  defaultStep?: StepId;
  onStepChange?: (step: StepId) => void;
  termsHref?: string;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "IE", name: "Ireland" },
  { code: "AU", name: "Australia" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
];

const EMPTY: CheckoutValues = {
  email: "",
  phone: "",
  marketing: false,
  firstName: "",
  lastName: "",
  country: "US",
  line1: "",
  line2: "",
  city: "",
  postalCode: "",
  shippingId: "",
  business: false,
  company: "",
  vatId: "",
  paymentMethod: "",
  acceptTerms: false,
};

function flatErrors(errors: FieldErrors<CheckoutValues>, only?: readonly CheckoutField[]) {
  const order = STEPS.flatMap((s) => s.fields as readonly CheckoutField[]);
  return order
    .filter((n) => (!only || only.includes(n)) && errors[n]?.message)
    .map((n) => ({ name: n, message: String(errors[n]!.message) }));
}

/**
 * Multi-step checkout: contact, shipping, payment, review. react-hook-form + zod validation,
 * libphonenumber-js phone checks, VAT ID syntax (+ optional remote) with EU reverse charge,
 * coupon states, sticky summary with live tax recalculation and a payment provider slot.
 */
export function ProCheckoutFlow({
  items,
  currency = "USD",
  locale = "en-US",
  sellerCountry = "US",
  countries = DEFAULT_COUNTRIES,
  shippingOptions,
  paymentMethods,
  taxTable,
  defaultValues,
  onApplyCoupon,
  verifyVatId,
  onPlaceOrder,
  step: stepProp,
  defaultStep = "contact",
  onStepChange,
  termsHref = "#",
  disabled,
  className,
}: ProCheckoutFlowProps) {
  const formId = React.useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const [innerStep, setInnerStep] = React.useState<StepId>(defaultStep);
  const step = stepProp ?? innerStep;
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const [reached, setReached] = React.useState(stepIndex);
  const [shownErrors, setShownErrors] = React.useState<{ name: CheckoutField; message: string }[]>(
    [],
  );
  const [coupon, setCoupon] = React.useState<CouponState>({ status: "idle" });
  const [paymentReady, setPaymentReady] = React.useState<Record<string, boolean>>({});
  const [submit, setSubmit] = React.useState<
    { status: "idle" | "submitting" | "done" } | { status: "error"; message: string }
  >({ status: "idle" });
  const [vatRemote, setVatRemote] = React.useState<{
    id: string;
    state: "checking" | "valid" | "invalid";
  } | null>(null);

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      ...EMPTY,
      shippingId: shippingOptions[0]?.id ?? "",
      paymentMethod: paymentMethods[0]?.id ?? "",
      ...defaultValues,
    },
    mode: "onTouched",
  });
  const { register, control, trigger, setValue, setFocus, getValues, formState } = form;
  const errors = formState.errors;
  const [country, shippingId, business, vatId, paymentMethod] = useWatch({
    control,
    name: ["country", "shippingId", "business", "vatId", "paymentMethod"],
  });

  const money = React.useMemo(() => moneyFormatter(locale, currency), [locale, currency]);
  const availableShipping = React.useMemo(
    () => shippingOptions.filter((o) => !o.countries || o.countries.includes(country)),
    [shippingOptions, country],
  );
  React.useEffect(() => {
    if (availableShipping.length && !availableShipping.some((o) => o.id === shippingId))
      setValue("shippingId", availableShipping[0]!.id);
  }, [availableShipping, shippingId, setValue]);

  const vatSyntaxOk = Boolean(business && vatId && checkVatId(vatId, country).ok);
  React.useEffect(() => {
    if (!verifyVatId || !vatSyntaxOk || !vatId) return setVatRemote(null);
    const id = normalizeVatId(vatId);
    let live = true;
    setVatRemote({ id, state: "checking" });
    const t = setTimeout(() => {
      verifyVatId(id, country).then(
        (ok) => live && setVatRemote({ id, state: ok ? "valid" : "invalid" }),
        () => live && setVatRemote({ id, state: "invalid" }),
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [verifyVatId, vatSyntaxOk, vatId, country]);
  const vatValid = vatSyntaxOk && (!verifyVatId || vatRemote?.state === "valid");

  const shippingPrice = availableShipping.find((o) => o.id === shippingId)?.price ?? 0;
  const appliedCoupon = coupon.status === "applied" ? coupon.coupon : null;
  const totals = React.useMemo(
    () =>
      computeTotals({
        items,
        shipping: shippingPrice,
        coupon: appliedCoupon,
        country,
        sellerCountry,
        taxTable,
        businessVatValid: vatValid,
      }),
    [items, shippingPrice, appliedCoupon, country, sellerCountry, taxTable, vatValid],
  );

  const goTo = (id: StepId) => {
    const i = STEPS.findIndex((s) => s.id === id);
    setReached((r) => Math.max(r, i));
    setShownErrors([]);
    if (stepProp === undefined) setInnerStep(id);
    onStepChange?.(id);
  };

  const method = paymentMethods.find((m) => m.id === paymentMethod);
  const next = async () => {
    const fields = STEPS[stepIndex]!.fields as readonly CheckoutField[];
    const ok = await trigger([...fields], { shouldFocus: false });
    const extra: { name: CheckoutField; message: string }[] = [];
    if (step === "payment" && method?.render && !paymentReady[method.id])
      extra.push({ name: "paymentMethod", message: "Complete your payment details" });
    if (step === "payment" && business && vatId && verifyVatId && vatRemote?.state === "invalid")
      extra.push({ name: "vatId", message: "This VAT number is not registered" });
    if (!ok || extra.length) {
      setShownErrors([...flatErrors(form.formState.errors, fields), ...extra]);
      return;
    }
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) goTo(nextStep.id);
  };

  const placeOrder = form.handleSubmit(
    async (values) => {
      setSubmit({ status: "submitting" });
      try {
        const phone = checkPhone(values.phone, values.country);
        const res = await onPlaceOrder({
          values: { ...values, vatId: values.vatId ? normalizeVatId(values.vatId) : values.vatId },
          items,
          totals,
          couponCode: appliedCoupon?.code,
          phoneE164: phone.ok ? phone.e164 : undefined,
        });
        if (res && "error" in res) setSubmit({ status: "error", message: res.error });
        else setSubmit({ status: "done" });
      } catch (e) {
        setSubmit({
          status: "error",
          message: (e as Error).message || "Payment failed. Try again.",
        });
      }
    },
    (errs) => {
      const list = flatErrors(errs);
      setShownErrors(list);
      const first = list[0];
      const owner =
        first && STEPS.find((s) => (s.fields as readonly string[]).includes(first.name));
      if (owner && owner.id !== step && owner.id !== "review") goTo(owner.id);
    },
  );

  const jump = (name: CheckoutField) => {
    const owner = STEPS.find((s) => (s.fields as readonly string[]).includes(name));
    if (owner && owner.id !== step) goTo(owner.id);
    requestAnimationFrame(() => {
      try {
        setFocus(name);
      } catch {
        document.getElementById(`${formId}-${name}`)?.focus();
      }
    });
  };

  const busy = disabled || submit.status === "submitting";
  const err = (n: CheckoutField) => errors[n]?.message as string | undefined;
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  if (submit.status === "done") {
    const v = getValues();
    return (
      <div
        role="status"
        className={cn(
          "rounded-crm border border-crm-border bg-crm-card p-8 text-center font-crm",
          className,
        )}
      >
        <p className="text-lg font-medium text-crm-fg">Order confirmed</p>
        <p className="mt-1 text-sm text-crm-muted-fg">
          A receipt for {money(totals.total)} is on its way to {v.email}.
        </p>
      </div>
    );
  }

  const stepMeta = STEPS[stepIndex]!;

  return (
    <div
      className={cn(
        "grid gap-6 font-crm text-crm-fg lg:grid-cols-[minmax(0,1fr)_340px]",
        className,
      )}
    >
      <form
        noValidate
        onSubmit={(e) =>
          step === "review" ? void placeOrder(e) : (e.preventDefault(), void next())
        }
        className="min-w-0 space-y-5"
        aria-busy={busy || undefined}
      >
        <nav aria-label="Checkout progress">
          <ol className="flex items-center gap-2 text-xs">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const can = i <= reached && !busy;
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!can || i === stepIndex}
                    aria-current={i === stepIndex ? "step" : undefined}
                    onClick={() => goTo(s.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2 py-1 disabled:cursor-default",
                      i === stepIndex
                        ? "bg-crm-primary/15 text-crm-fg"
                        : done
                          ? "text-crm-soft hover:text-crm-fg"
                          : "text-crm-subtle",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-5 place-items-center rounded-full border text-[10px]",
                        i === stepIndex
                          ? "border-crm-primary bg-crm-primary text-crm-primary-fg"
                          : done
                            ? "border-crm-success text-crm-success"
                            : "border-crm-input",
                      )}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {s.label}
                    {done && <span className="sr-only"> (completed)</span>}
                  </button>
                  {i < STEPS.length - 1 && <span aria-hidden className="h-px w-5 bg-crm-border" />}
                </li>
              );
            })}
          </ol>
        </nav>

        <ErrorSummary formId={formId} errors={shownErrors} onJump={jump} />
        {submit.status === "error" && (
          <div
            role="alert"
            className="rounded-crm border border-crm-danger/50 bg-crm-danger/10 p-3 text-sm text-crm-danger"
          >
            {submit.message}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.fieldset
            key={step}
            disabled={busy}
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -12 }}
            transition={{ duration: 0.16 }}
            className="space-y-4 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised"
          >
            <legend className="sr-only">{stepMeta.label}</legend>
            <h2 ref={headingRef} tabIndex={-1} className="text-sm font-medium outline-none">
              {stepMeta.label}
            </h2>

            {step === "contact" && (
              <>
                <Field formId={formId} name="email" error={err("email")}>
                  {(a) => (
                    <input
                      {...a}
                      {...register("email")}
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      className={inputCls}
                    />
                  )}
                </Field>
                <Field
                  formId={formId}
                  name="phone"
                  error={err("phone")}
                  hint="Used by the courier for delivery updates only."
                >
                  {(a) => (
                    <input
                      {...a}
                      {...register("phone", {
                        onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                          const p = checkPhone(e.target.value, getValues("country"));
                          if (p.ok) setValue("phone", p.intl, { shouldValidate: true });
                        },
                      })}
                      type="tel"
                      autoComplete="tel"
                      className={inputCls}
                    />
                  )}
                </Field>
                <label className="flex items-center gap-2 text-xs text-crm-soft">
                  <input
                    type="checkbox"
                    {...register("marketing")}
                    className="size-4 accent-crm-primary"
                  />
                  Email me about new products and offers
                </label>
              </>
            )}

            {step === "shipping" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field formId={formId} name="firstName" error={err("firstName")}>
                    {(a) => (
                      <input
                        {...a}
                        {...register("firstName")}
                        autoComplete="given-name"
                        className={inputCls}
                      />
                    )}
                  </Field>
                  <Field formId={formId} name="lastName" error={err("lastName")}>
                    {(a) => (
                      <input
                        {...a}
                        {...register("lastName")}
                        autoComplete="family-name"
                        className={inputCls}
                      />
                    )}
                  </Field>
                </div>
                <Field
                  formId={formId}
                  name="country"
                  error={err("country")}
                  hint="Tax and delivery options update for the destination."
                >
                  {(a) => (
                    <select
                      {...a}
                      {...register("country", { onChange: () => void trigger("phone") })}
                      autoComplete="country"
                      className={inputCls}
                    >
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field formId={formId} name="line1" error={err("line1")}>
                  {(a) => (
                    <input
                      {...a}
                      {...register("line1")}
                      autoComplete="address-line1"
                      className={inputCls}
                    />
                  )}
                </Field>
                <Field formId={formId} name="line2" label="Apartment, suite (optional)">
                  {(a) => (
                    <input
                      {...a}
                      {...register("line2")}
                      autoComplete="address-line2"
                      className={inputCls}
                    />
                  )}
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field formId={formId} name="city" error={err("city")}>
                    {(a) => (
                      <input
                        {...a}
                        {...register("city")}
                        autoComplete="address-level2"
                        className={inputCls}
                      />
                    )}
                  </Field>
                  <Field formId={formId} name="postalCode" error={err("postalCode")}>
                    {(a) => (
                      <input
                        {...a}
                        {...register("postalCode")}
                        autoComplete="postal-code"
                        className={inputCls}
                      />
                    )}
                  </Field>
                </div>
                <fieldset className="space-y-2">
                  <legend
                    id={`${formId}-shippingId`}
                    tabIndex={-1}
                    className="mb-1 text-xs text-crm-soft"
                  >
                    Delivery method
                  </legend>
                  {availableShipping.length === 0 && (
                    <p className="text-xs text-crm-warning">
                      We don&apos;t deliver to this country yet.
                    </p>
                  )}
                  {availableShipping.map((o) => (
                    <label
                      key={o.id}
                      className="flex cursor-pointer items-center gap-3 rounded-crm border border-crm-border px-3 py-2 text-sm has-[:checked]:border-crm-primary has-[:checked]:bg-crm-primary/10"
                    >
                      <input
                        type="radio"
                        value={o.id}
                        {...register("shippingId")}
                        className="accent-crm-primary"
                      />
                      <span className="flex-1">
                        {o.label}
                        <span className="block text-xs text-crm-muted-fg">{o.eta}</span>
                      </span>
                      <span className="tabular-nums">
                        {o.price === 0 ? "Free" : money(o.price)}
                      </span>
                    </label>
                  ))}
                  {err("shippingId") && (
                    <p className="text-xs text-crm-danger">{err("shippingId")}</p>
                  )}
                </fieldset>
              </>
            )}

            {step === "payment" && (
              <>
                <label className="flex items-center gap-2 text-xs text-crm-soft">
                  <input
                    type="checkbox"
                    {...register("business")}
                    className="size-4 accent-crm-primary"
                  />
                  I&apos;m buying for a business (add VAT ID for invoice / reverse charge)
                </label>
                {business && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field formId={formId} name="company" error={err("company")}>
                      {(a) => (
                        <input
                          {...a}
                          {...register("company")}
                          autoComplete="organization"
                          className={inputCls}
                        />
                      )}
                    </Field>
                    <Field
                      formId={formId}
                      name="vatId"
                      label="VAT ID (optional)"
                      error={err("vatId")}
                      hint={
                        vatRemote?.state === "checking"
                          ? "Checking registration..."
                          : vatValid
                            ? totals.reverseCharge
                              ? "Valid - VAT will be reverse charged."
                              : "Valid VAT number."
                            : vatRemote?.state === "invalid"
                              ? "Not found in the VAT register."
                              : `Format: ${country === "GR" ? "EL" : country} + number`
                      }
                    >
                      {(a) => (
                        <input
                          {...a}
                          {...register("vatId")}
                          spellCheck={false}
                          className={cn(inputCls, "uppercase")}
                        />
                      )}
                    </Field>
                  </div>
                )}
                <div
                  role="radiogroup"
                  aria-labelledby={`${formId}-paymentMethod`}
                  className="space-y-2"
                >
                  <p id={`${formId}-paymentMethod`} tabIndex={-1} className="text-xs text-crm-soft">
                    Payment method
                  </p>
                  {paymentMethods.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-crm border border-crm-border has-[:checked]:border-crm-primary"
                    >
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                        <input
                          type="radio"
                          value={m.id}
                          {...register("paymentMethod")}
                          className="accent-crm-primary"
                        />
                        <span className="flex-1">
                          {m.label}
                          {m.description && (
                            <span className="block text-xs text-crm-muted-fg">{m.description}</span>
                          )}
                        </span>
                      </label>
                      {paymentMethod === m.id && m.render && (
                        <div className="border-t border-crm-border p-3">
                          {m.render({
                            amount: totals.total,
                            currency,
                            disabled: Boolean(busy),
                            setReady: (r) =>
                              setPaymentReady((p) => (p[m.id] === r ? p : { ...p, [m.id]: r })),
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === "review" && (
              <ReviewStep
                values={getValues()}
                countries={countries}
                method={method}
                shipping={availableShipping.find((o) => o.id === shippingId)}
                onEdit={goTo}
              />
            )}
            {step === "review" && (
              <Field formId={formId} name="acceptTerms" label="Terms" error={err("acceptTerms")}>
                {(a) => (
                  <label className="flex items-center gap-2 text-xs text-crm-soft">
                    <input
                      {...a}
                      type="checkbox"
                      {...register("acceptTerms")}
                      className="size-4 accent-crm-primary"
                    />
                    <span>
                      I agree to the{" "}
                      <a href={termsHref} className="underline" target="_blank" rel="noreferrer">
                        terms of sale
                      </a>
                    </span>
                  </label>
                )}
              </Field>
            )}
          </motion.fieldset>
        </AnimatePresence>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={stepIndex === 0 || busy}
            onClick={() => goTo(STEPS[stepIndex - 1]!.id)}
          >
            Back
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submit.status === "submitting"}
            disabled={disabled || (step === "shipping" && !availableShipping.length)}
          >
            {step === "review"
              ? `Pay ${money(totals.total)}`
              : `Continue to ${STEPS[stepIndex + 1]!.label.toLowerCase()}`}
          </Button>
        </div>
      </form>

      <OrderSummary
        items={items}
        totals={totals}
        money={money}
        coupon={coupon}
        onApplyCoupon={onApplyCoupon}
        onCouponChange={setCoupon}
        disabled={busy}
      />
    </div>
  );
}

function ReviewStep({
  values,
  countries,
  method,
  shipping,
  onEdit,
}: {
  values: CheckoutValues;
  countries: { code: string; name: string }[];
  method?: PaymentMethod;
  shipping?: ShippingOption;
  onEdit: (s: StepId) => void;
}) {
  const blocks: { step: StepId; title: string; lines: string[] }[] = [
    { step: "contact", title: "Contact", lines: [values.email, values.phone] },
    {
      step: "shipping",
      title: "Ship to",
      lines: [
        `${values.firstName} ${values.lastName}`,
        [values.line1, values.line2].filter(Boolean).join(", "),
        `${values.postalCode} ${values.city}, ${countries.find((c) => c.code === values.country)?.name ?? values.country}`,
        shipping ? `${shipping.label} · ${shipping.eta}` : "",
      ],
    },
    {
      step: "payment",
      title: "Payment",
      lines: [
        method?.label ?? "",
        values.business
          ? [values.company, values.vatId && normalizeVatId(values.vatId)]
              .filter(Boolean)
              .join(" · ")
          : "",
      ],
    },
  ];
  return (
    <dl className="divide-y divide-crm-border rounded-crm border border-crm-border text-sm">
      {blocks.map((b) => (
        <div key={b.step} className="flex items-start gap-3 p-3">
          <dt className="w-20 shrink-0 text-xs text-crm-muted-fg">{b.title}</dt>
          <dd className="min-w-0 flex-1 space-y-0.5">
            {b.lines.filter(Boolean).map((l, i) => (
              <p key={i} className="truncate">
                {l}
              </p>
            ))}
          </dd>
          <button
            type="button"
            onClick={() => onEdit(b.step)}
            className="text-xs text-crm-soft underline hover:text-crm-fg"
          >
            Edit<span className="sr-only"> {b.title}</span>
          </button>
        </div>
      ))}
    </dl>
  );
}
