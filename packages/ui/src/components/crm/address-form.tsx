import * as React from "react";
import { Copy, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormField, Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";

export interface Address {
  country: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
}

export type AddressErrors = Partial<Record<keyof Address, string>>;

interface CountryRule {
  name: string;
  regionLabel: string;
  postalLabel: string;
  postal: RegExp;
  postalExample: string;
  regions?: { value: string; label: string }[];
  /** Region field hidden (e.g. many UK addresses do not use counties). */
  regionOptional?: boolean;
  /** Formatter for the single-line preview, used for labels and invoices. */
  format: (a: Address) => string[];
}

const opts = (s: string) =>
  s.split("|").map((pair) => {
    const [value = "", label = ""] = pair.split(":");
    return { value, label };
  });

export const ADDRESS_COUNTRIES: Record<string, CountryRule> = {
  US: {
    name: "United States",
    regionLabel: "State",
    postalLabel: "ZIP code",
    postal: /^\d{5}(-\d{4})?$/,
    postalExample: "94107 or 94107-1234",
    regions: opts(
      "AZ:Arizona|CA:California|CO:Colorado|FL:Florida|GA:Georgia|IL:Illinois|MA:Massachusetts|NY:New York|TX:Texas|WA:Washington",
    ),
    format: (a) => [a.line1, a.line2, `${a.city}, ${a.region} ${a.postalCode}`, "United States"],
  },
  CA: {
    name: "Canada",
    regionLabel: "Province",
    postalLabel: "Postal code",
    postal: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/,
    postalExample: "M5V 2T6",
    regions: opts("AB:Alberta|BC:British Columbia|MB:Manitoba|NS:Nova Scotia|ON:Ontario|QC:Quebec"),
    format: (a) => [
      a.line1,
      a.line2,
      `${a.city} ${a.region}  ${a.postalCode.toUpperCase()}`,
      "Canada",
    ],
  },
  GB: {
    name: "United Kingdom",
    regionLabel: "County",
    postalLabel: "Postcode",
    postal: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
    postalExample: "SW1A 1AA",
    regionOptional: true,
    format: (a) => [
      a.line1,
      a.line2,
      a.city.toUpperCase(),
      a.region,
      a.postalCode.toUpperCase(),
      "United Kingdom",
    ],
  },
  IN: {
    name: "India",
    regionLabel: "State",
    postalLabel: "PIN code",
    postal: /^[1-9]\d{5}$/,
    postalExample: "110001",
    regions: opts(
      "DL:Delhi|HR:Haryana|KA:Karnataka|MH:Maharashtra|TN:Tamil Nadu|TG:Telangana|UP:Uttar Pradesh|WB:West Bengal",
    ),
    format: (a) => [a.line1, a.line2, `${a.city} - ${a.postalCode}`, `${a.region}, India`],
  },
  DE: {
    name: "Germany",
    regionLabel: "State",
    postalLabel: "PLZ",
    postal: /^\d{5}$/,
    postalExample: "10115",
    regionOptional: true,
    format: (a) => [a.line1, a.line2, `${a.postalCode} ${a.city}`, "Germany"],
  },
};

export const EMPTY_ADDRESS: Address = {
  country: "US",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
};

/** Pure validation, usable on the server as well. Returns an empty object when valid. */
export function validateAddress(a: Address): AddressErrors {
  const rule = ADDRESS_COUNTRIES[a.country];
  const e: AddressErrors = {};
  if (!rule) e.country = "Choose a supported country";
  if (!a.line1.trim()) e.line1 = "Street address is required";
  else if (a.line1.length > 100) e.line1 = "Keep it under 100 characters";
  if (!a.city.trim()) e.city = "City is required";
  if (rule && !rule.regionOptional && !a.region) e.region = `${rule.regionLabel} is required`;
  if (rule) {
    if (!a.postalCode.trim()) e.postalCode = `${rule.postalLabel} is required`;
    else if (!rule.postal.test(a.postalCode.trim()))
      e.postalCode = `Use the format ${rule.postalExample}`;
  }
  return e;
}

/** Format an address as display lines for the given country convention. */
export function formatAddress(a: Address): string[] {
  const rule = ADDRESS_COUNTRIES[a.country];
  return (rule ? rule.format(a) : [a.line1, a.line2, a.city, a.region, a.postalCode])
    .map((l) => l.trim())
    .filter((l) => l && !/^[,\s-]+$/.test(l));
}

export interface AddressFormProps {
  value?: Address;
  defaultValue?: Partial<Address>;
  onChange?: (address: Address, errors: AddressErrors) => void;
  /** Limit selectable countries (ISO codes). */
  countries?: string[];
  /** Force-show all errors, e.g. after a submit attempt. */
  showAllErrors?: boolean;
  /** Offer "Same as" copying from another address (billing ← shipping). */
  copyFrom?: { label: string; address: Address };
  disabled?: boolean;
  /** Prefix for field ids so two forms can live on one page. */
  idPrefix?: string;
  /** Show the formatted label preview. */
  showPreview?: boolean;
  className?: string;
}

/**
 * Country-aware address editor: labels, region lists, postal-code patterns and the printed
 * format change with the country. Validates on blur (or all at once via `showAllErrors`),
 * normalises postal codes, supports autofill tokens and copy-from another address.
 */
export function AddressForm({
  value,
  defaultValue,
  onChange,
  countries = Object.keys(ADDRESS_COUNTRIES),
  showAllErrors,
  copyFrom,
  disabled,
  idPrefix = "addr",
  showPreview = true,
  className,
}: AddressFormProps) {
  const [inner, setInner] = React.useState<Address>({ ...EMPTY_ADDRESS, ...defaultValue });
  const addr = value ?? inner;
  const [touched, setTouched] = React.useState<Partial<Record<keyof Address, boolean>>>({});
  const errors = React.useMemo(() => validateAddress(addr), [addr]);
  const rule = ADDRESS_COUNTRIES[addr.country] ?? (ADDRESS_COUNTRIES.US as CountryRule);

  const commit = (next: Address) => {
    if (value === undefined) setInner(next);
    onChange?.(next, validateAddress(next));
  };
  const set = (key: keyof Address, v: string) => commit({ ...addr, [key]: v });
  const err = (k: keyof Address) => (showAllErrors || touched[k] ? errors[k] : undefined);
  const blur = (k: keyof Address) => () => setTouched((t) => ({ ...t, [k]: true }));
  const id = (k: string) => `${idPrefix}-${k}`;
  const described = (k: keyof Address) => (err(k) ? `${id(k)}-msg` : undefined);

  const normalisePostal = () => {
    let p = addr.postalCode.trim().toUpperCase();
    if (
      (addr.country === "GB" || addr.country === "CA") &&
      /^[A-Z0-9]{5,7}$/.test(p) &&
      !p.includes(" ")
    )
      p = `${p.slice(0, -3)} ${p.slice(-3)}`;
    if (p !== addr.postalCode) set("postalCode", p);
    setTouched((t) => ({ ...t, postalCode: true }));
  };

  const lines = formatAddress(addr);
  const complete = Object.keys(errors).length === 0;

  return (
    <fieldset
      disabled={disabled}
      className={cn("flex flex-col gap-4 font-crm disabled:opacity-60", className)}
    >
      {copyFrom ? (
        <button
          type="button"
          onClick={() => {
            commit({ ...copyFrom.address });
            setTouched({});
          }}
          className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs text-crm-soft outline-none hover:text-crm-fg focus-visible:underline"
        >
          <Copy className="size-3.5" /> Same as {copyFrom.label}
        </button>
      ) : null}
      <FormField label="Country / region" htmlFor={id("country")} required error={err("country")}>
        <Select
          id={id("country")}
          value={addr.country}
          disabled={disabled}
          onValueChange={(c) => commit({ ...addr, country: c, region: "", postalCode: "" })}
          options={countries.flatMap((c) => {
            const r = ADDRESS_COUNTRIES[c];
            return r ? [{ value: c, label: r.name }] : [];
          })}
        />
      </FormField>
      <FormField label="Street address" htmlFor={id("line1")} required error={err("line1")}>
        <Input
          id={id("line1")}
          autoComplete="address-line1"
          value={addr.line1}
          maxLength={120}
          invalid={Boolean(err("line1"))}
          aria-describedby={described("line1")}
          onChange={(e) => set("line1", e.target.value)}
          onBlur={blur("line1")}
          placeholder="Street and number"
        />
      </FormField>
      <FormField label="Apartment, suite, floor" htmlFor={id("line2")} hint="Optional">
        <Input
          id={id("line2")}
          autoComplete="address-line2"
          value={addr.line2}
          onChange={(e) => set("line2", e.target.value)}
          aria-describedby={`${id("line2")}-msg`}
        />
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="City" htmlFor={id("city")} required error={err("city")}>
          <Input
            id={id("city")}
            autoComplete="address-level2"
            value={addr.city}
            invalid={Boolean(err("city"))}
            aria-describedby={described("city")}
            onChange={(e) => set("city", e.target.value)}
            onBlur={blur("city")}
          />
        </FormField>
        <FormField
          label={rule.regionLabel}
          htmlFor={id("region")}
          required={!rule.regionOptional}
          error={err("region")}
        >
          {rule.regions ? (
            <Select
              id={id("region")}
              value={addr.region || undefined}
              invalid={Boolean(err("region"))}
              disabled={disabled}
              placeholder={`Select ${rule.regionLabel.toLowerCase()}`}
              onValueChange={(v) => {
                set("region", v);
                setTouched((t) => ({ ...t, region: true }));
              }}
              options={rule.regions}
            />
          ) : (
            <Input
              id={id("region")}
              autoComplete="address-level1"
              value={addr.region}
              onChange={(e) => set("region", e.target.value)}
              onBlur={blur("region")}
            />
          )}
        </FormField>
        <FormField
          label={rule.postalLabel}
          htmlFor={id("postalCode")}
          required
          error={err("postalCode")}
          hint={`e.g. ${rule.postalExample}`}
        >
          <Input
            id={id("postalCode")}
            autoComplete="postal-code"
            inputMode={["US", "IN", "DE"].includes(addr.country) ? "numeric" : "text"}
            value={addr.postalCode}
            invalid={Boolean(err("postalCode"))}
            aria-describedby={`${id("postalCode")}-msg`}
            onChange={(e) => set("postalCode", e.target.value)}
            onBlur={normalisePostal}
          />
        </FormField>
      </div>
      {showPreview ? (
        <div
          className="flex gap-3 rounded-xl border border-crm-border bg-crm-card p-3"
          aria-live="polite"
        >
          <MapPin
            className={cn(
              "mt-0.5 size-4 shrink-0",
              complete ? "text-crm-success" : "text-crm-subtle",
            )}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="crm-eyebrow text-[11px] text-crm-faint">
              {complete ? "Label preview" : "Incomplete address"}
            </span>
            {lines.length ? (
              <address className="text-sm leading-5 whitespace-pre-line text-crm-soft not-italic">
                {lines.join("\n")}
              </address>
            ) : (
              <span className="text-sm text-crm-subtle">
                Start typing to see how this prints on invoices.
              </span>
            )}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
