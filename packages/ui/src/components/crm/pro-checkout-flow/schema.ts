import { z } from "zod";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** EU VAT number shapes (syntax only; pass `verifyVatId` for a VIES lookup). */
export const VAT_PATTERNS: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE[01]\d{9}$/,
  BG: /^BG\d{9,10}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  EL: /^EL\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
  HR: /^HR\d{11}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE\d{7}[A-W][A-I]?$|^IE\d[A-Z+*]\d{5}[A-W]$/,
  IT: /^IT\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SE: /^SE\d{12}$/,
  SI: /^SI\d{8}$/,
  SK: /^SK\d{10}$/,
  GB: /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
  CH: /^CHE\d{9}(MWST|TVA|IVA)?$/,
  NO: /^NO\d{9}MVA$/,
};

/** Normalise a VAT ID ("de 123 456-789" -> "DE123456789"; Greece uses EL). */
export function normalizeVatId(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9+*]/g, "");
}

/** Syntactic VAT ID check against the country of the billing address. */
export function checkVatId(raw: string, country: string): { ok: boolean; reason?: string } {
  const v = normalizeVatId(raw);
  const prefix = country === "GR" ? "EL" : country;
  const pattern = VAT_PATTERNS[prefix];
  if (!pattern) return { ok: false, reason: `VAT IDs are not supported for ${country}` };
  if (!v.startsWith(prefix)) return { ok: false, reason: `Must start with ${prefix}` };
  return pattern.test(v) ? { ok: true } : { ok: false, reason: `Not a valid ${prefix} VAT number` };
}

export function checkPhone(raw: string, country: string) {
  const p = parsePhoneNumberFromString(raw, country as CountryCode);
  return p && p.isValid()
    ? { ok: true as const, e164: p.number, intl: p.formatInternational() }
    : { ok: false as const };
}

export const checkoutSchema = z
  .object({
    email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
    phone: z.string().trim().min(1, "Enter a phone number for delivery updates"),
    marketing: z.boolean(),
    firstName: z.string().trim().min(1, "Enter your first name"),
    lastName: z.string().trim().min(1, "Enter your last name"),
    country: z.string().length(2, "Choose a country"),
    line1: z.string().trim().min(3, "Enter a street address"),
    line2: z.string().optional(),
    city: z.string().trim().min(1, "Enter a city"),
    postalCode: z.string().trim().min(2, "Enter a postal code"),
    shippingId: z.string().min(1, "Choose a delivery method"),
    business: z.boolean(),
    company: z.string().optional(),
    vatId: z.string().optional(),
    paymentMethod: z.string().min(1, "Choose a payment method"),
    acceptTerms: z.boolean().refine((v) => v, "Accept the terms to continue"),
  })
  .superRefine((v, ctx) => {
    if (v.phone && !checkPhone(v.phone, v.country).ok)
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid phone number for this country",
      });
    if (v.business) {
      if (!v.company?.trim())
        ctx.addIssue({ code: "custom", path: ["company"], message: "Enter the company name" });
      if (v.vatId?.trim()) {
        const r = checkVatId(v.vatId, v.country);
        if (!r.ok) ctx.addIssue({ code: "custom", path: ["vatId"], message: r.reason! });
      }
    }
  });

export type CheckoutValues = z.infer<typeof checkoutSchema>;
export type CheckoutField = keyof CheckoutValues;

export const STEPS = [
  { id: "contact", label: "Contact", fields: ["email", "phone", "marketing"] },
  {
    id: "shipping",
    label: "Shipping",
    fields: [
      "firstName",
      "lastName",
      "country",
      "line1",
      "line2",
      "city",
      "postalCode",
      "shippingId",
    ],
  },
  { id: "payment", label: "Payment", fields: ["business", "company", "vatId", "paymentMethod"] },
  { id: "review", label: "Review", fields: ["acceptTerms"] },
] as const satisfies readonly { id: string; label: string; fields: readonly CheckoutField[] }[];

export type StepId = (typeof STEPS)[number]["id"];

export const FIELD_LABELS: Record<CheckoutField, string> = {
  email: "Email",
  phone: "Phone",
  marketing: "Marketing",
  firstName: "First name",
  lastName: "Last name",
  country: "Country",
  line1: "Address",
  line2: "Apartment, suite",
  city: "City",
  postalCode: "Postal code",
  shippingId: "Delivery method",
  business: "Business purchase",
  company: "Company",
  vatId: "VAT ID",
  paymentMethod: "Payment method",
  acceptTerms: "Terms",
};
