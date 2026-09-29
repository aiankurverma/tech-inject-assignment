/** Money is always integer minor units (cents). */
export interface CartItem {
  id: string;
  name: string;
  variant?: string;
  unitPrice: number;
  quantity: number;
  taxCategory?: "standard" | "reduced" | "zero";
  image?: string;
}

export interface ShippingOption {
  id: string;
  label: string;
  eta: string;
  price: number;
  /** Restrict to these ISO countries. */
  countries?: string[];
}

export interface Coupon {
  code: string;
  kind: "percent" | "fixed" | "free_shipping";
  /** Percent (0-100) or minor units for fixed. */
  value: number;
  label: string;
  /** Minimum subtotal in minor units. */
  minSubtotal?: number;
}

export type CouponResult =
  | { ok: true; coupon: Coupon }
  | { ok: false; reason: "invalid" | "expired" | "minimum" | "error"; message: string };

export interface TaxRegion {
  label: string;
  standard: number;
  reduced: number;
  /** Prices already include tax (EU/UK consumer pricing). */
  inclusive: boolean;
  eu?: boolean;
}

export const DEFAULT_TAX: Record<string, TaxRegion> = {
  US: { label: "Sales tax", standard: 0.0825, reduced: 0.0825, inclusive: false },
  CA: { label: "GST/HST", standard: 0.13, reduced: 0.05, inclusive: false },
  GB: { label: "VAT", standard: 0.2, reduced: 0.05, inclusive: true },
  DE: { label: "MwSt.", standard: 0.19, reduced: 0.07, inclusive: true, eu: true },
  FR: { label: "TVA", standard: 0.2, reduced: 0.055, inclusive: true, eu: true },
  NL: { label: "BTW", standard: 0.21, reduced: 0.09, inclusive: true, eu: true },
  ES: { label: "IVA", standard: 0.21, reduced: 0.1, inclusive: true, eu: true },
  IT: { label: "IVA", standard: 0.22, reduced: 0.1, inclusive: true, eu: true },
  IE: { label: "VAT", standard: 0.23, reduced: 0.135, inclusive: true, eu: true },
  AU: { label: "GST", standard: 0.1, reduced: 0.1, inclusive: true },
  IN: { label: "GST", standard: 0.18, reduced: 0.05, inclusive: false },
  JP: { label: "Consumption tax", standard: 0.1, reduced: 0.08, inclusive: true },
};

export interface Totals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  taxLabel: string;
  taxInclusive: boolean;
  reverseCharge: boolean;
  total: number;
}

/**
 * Recalculate totals. Discounts are allocated to lines pro rata before tax; shipping is taxed
 * at the standard rate. Inclusive regions extract tax from gross; exclusive regions add it.
 * A valid VAT ID for an EU business in a different EU country than the seller is reverse charged.
 */
export function computeTotals(input: {
  items: CartItem[];
  shipping: number;
  coupon?: Coupon | null;
  country: string;
  sellerCountry: string;
  taxTable?: Record<string, TaxRegion>;
  businessVatValid?: boolean;
}): Totals {
  const table = input.taxTable ?? DEFAULT_TAX;
  const region = table[input.country] ?? {
    label: "Tax",
    standard: 0,
    reduced: 0,
    inclusive: false,
  };
  const seller = table[input.sellerCountry];
  const reverseCharge = Boolean(
    input.businessVatValid && region.eu && seller?.eu && input.country !== input.sellerCountry,
  );
  const subtotal = input.items.reduce((a, i) => a + i.unitPrice * i.quantity, 0);
  const c = input.coupon;
  const eligible = !c?.minSubtotal || subtotal >= c.minSubtotal;
  let discount = 0;
  let shipping = input.shipping;
  if (c && eligible) {
    if (c.kind === "percent") discount = Math.round((subtotal * Math.min(100, c.value)) / 100);
    else if (c.kind === "fixed") discount = Math.min(subtotal, c.value);
    else shipping = 0;
  }
  let tax = 0;
  if (!reverseCharge && subtotal > 0) {
    for (const item of input.items) {
      const line = item.unitPrice * item.quantity;
      const net = line - (discount * line) / subtotal;
      const rate =
        item.taxCategory === "zero"
          ? 0
          : item.taxCategory === "reduced"
            ? region.reduced
            : region.standard;
      tax += region.inclusive ? net - net / (1 + rate) : net * rate;
    }
    tax += region.inclusive
      ? shipping - shipping / (1 + region.standard)
      : shipping * region.standard;
  }
  tax = Math.round(tax);
  // Reverse charge on inclusive pricing: remove the tax that was baked into the price.
  let total = subtotal - discount + shipping + (region.inclusive ? 0 : tax);
  if (reverseCharge && region.inclusive) {
    let baked = 0;
    for (const item of input.items) {
      const line = item.unitPrice * item.quantity;
      const net = line - (discount * line) / subtotal;
      const rate =
        item.taxCategory === "zero"
          ? 0
          : item.taxCategory === "reduced"
            ? region.reduced
            : region.standard;
      baked += net - net / (1 + rate);
    }
    total -= Math.round(baked + shipping - shipping / (1 + region.standard));
  }
  return {
    subtotal,
    discount,
    shipping,
    tax,
    taxLabel: region.label,
    taxInclusive: region.inclusive && !reverseCharge,
    reverseCharge,
    total,
  };
}

export function moneyFormatter(locale: string, currency: string) {
  const f = new Intl.NumberFormat(locale, { style: "currency", currency });
  const digits = f.resolvedOptions().maximumFractionDigits ?? 2;
  return (minor: number) => f.format(minor / 10 ** digits);
}
