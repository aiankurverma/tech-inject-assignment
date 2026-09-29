import { z } from "zod";
import { format, isValid, parseISO } from "date-fns";
import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type FieldType =
  "text" | "textarea" | "email" | "url" | "phone" | "money" | "number" | "date" | "picklist";

export interface PicklistOption {
  value: string;
  label: string;
  /** Tailwind classes for the pill, e.g. "bg-crm-success/15 text-crm-success". */
  tone?: string;
}

/** Stored value shapes: money/number -> number | null, date -> "yyyy-MM-dd" | null, others -> string. */
export interface RecordFieldDef<T> {
  name: Extract<keyof T, string>;
  label: string;
  type: FieldType;
  required?: boolean;
  readOnly?: boolean;
  /** Group heading on the Details tab. */
  section?: string;
  /** Span both columns in the Details grid. */
  wide?: boolean;
  placeholder?: string;
  help?: string;
  options?: PicklistOption[];
  /** ISO 4217, money only. Default "USD". */
  currency?: string;
  /** Phone only: country used to parse national numbers. Default "US". */
  defaultCountry?: CountryCode;
  min?: number;
  max?: number;
  /** Replace the generated validator. Must accept the stored value shape. */
  schema?: z.ZodType;
}

const req = "Required";

function fieldSchema<T>(f: RecordFieldDef<T>): z.ZodType {
  if (f.schema) return f.schema;
  const optionalString = (s: z.ZodString) => (f.required ? s.min(1, req) : s.or(z.literal("")));
  switch (f.type) {
    case "text":
    case "textarea":
      return f.required ? z.string().trim().min(1, req) : z.string();
    case "email":
      return optionalString(z.string().trim().email("Enter a valid email address"));
    case "url":
      return optionalString(z.string().trim().url("Enter a full URL, including https://"));
    case "phone": {
      const country = f.defaultCountry ?? "US";
      const s = z
        .string()
        .trim()
        .refine((v) => v === "" || isValidPhoneNumber(v, country), "Enter a valid phone number");
      return f.required ? s.refine((v) => v !== "", req) : s;
    }
    case "money":
    case "number": {
      let n = z.number({ message: "Enter a number" }).finite();
      if (f.min !== undefined) n = n.min(f.min, `Must be at least ${f.min}`);
      if (f.max !== undefined) n = n.max(f.max, `Must be at most ${f.max}`);
      return f.required ? n : n.nullable();
    }
    case "date": {
      const d = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
        .refine((v) => isValid(parseISO(v)), "Pick a valid date");
      return f.required ? d : d.nullable();
    }
    case "picklist": {
      const values = new Set((f.options ?? []).map((o) => o.value));
      const s = z
        .string()
        .refine((v) => v === "" || values.has(v), "Choose one of the listed options");
      return f.required ? s.refine((v) => v !== "", req) : s;
    }
  }
}

export function buildRecordSchema<T>(fields: RecordFieldDef<T>[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) if (!f.readOnly) shape[f.name] = fieldSchema(f);
  return z.object(shape).passthrough();
}

const moneyFmt = new Map<string, Intl.NumberFormat>();
export function formatMoney(value: number, currency = "USD") {
  let f = moneyFmt.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 });
    moneyFmt.set(currency, f);
  }
  return f.format(value);
}

export function formatPhone(value: string, country: CountryCode = "US") {
  const p = parsePhoneNumberFromString(value, country);
  if (!p) return value;
  return p.country === country ? p.formatNational() : p.formatInternational();
}

/** Canonical form sent to the server (E.164 for phones, trimmed strings). */
export function normalizeValue<T>(f: RecordFieldDef<T>, value: unknown): unknown {
  if (f.type === "phone" && typeof value === "string" && value) {
    return parsePhoneNumberFromString(value, f.defaultCountry ?? "US")?.number ?? value;
  }
  if (typeof value === "string" && f.type !== "textarea") return value.trim();
  return value;
}

/** Human-readable display string; empty string when there is no value. */
export function displayValue<T>(f: RecordFieldDef<T>, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  switch (f.type) {
    case "money":
      return typeof value === "number" ? formatMoney(value, f.currency) : String(value);
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "date": {
      const d = parseISO(String(value));
      return isValid(d) ? format(d, "d MMM yyyy") : String(value);
    }
    case "phone":
      return formatPhone(String(value), f.defaultCountry);
    case "picklist":
      return f.options?.find((o) => o.value === value)?.label ?? String(value);
    default:
      return String(value);
  }
}
