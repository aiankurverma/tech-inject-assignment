/** Domain types for the CPQ quote builder. All money is integer minor units of `currency`. */

export type PricingModel =
  /** Flat unit price. */
  | "flat"
  /** Graduated: each unit priced by the tier it falls in (1-10 at $10, 11-50 at $8...). */
  | "tiered"
  /** Volume: the tier reached by the total quantity prices every unit. */
  | "volume";

export interface PriceTier {
  /** Inclusive upper bound of the tier; null = unbounded. */
  upTo: number | null;
  /** Unit price in minor units for units in this tier. */
  unitPrice: number;
}

export type BillingTerm = "one-time" | "monthly" | "annual";

export interface CpqProduct {
  id: string;
  sku: string;
  name: string;
  family: string;
  /** Currency of the price book entry (quote converts to the quote currency). */
  currency: string;
  model: PricingModel;
  /** Used when model === "flat". */
  unitPrice: number;
  /** Used when model is tiered/volume. Sorted ascending by upTo, last may be null. */
  tiers?: PriceTier[];
  billing: BillingTerm;
  /** Max discount (bp) a rep may give without approval, overrides policy default. */
  maxRepDiscountBp?: number;
  minQty?: number;
  inactive?: boolean;
}

/** Option rules evaluated when configuring a bundle. */
export type OptionRule =
  | { kind: "requires"; option: string; requires: string; message?: string }
  | { kind: "excludes"; option: string; excludes: string; message?: string }
  | { kind: "minQty"; option: string; min: number; message?: string }
  | { kind: "pickOne"; options: string[]; message?: string };

export interface BundleOption {
  /** Option id, unique within the bundle. */
  id: string;
  productId: string;
  label?: string;
  required?: boolean;
  defaultSelected?: boolean;
  defaultQty?: number;
  /** Quantity follows the bundle's primary quantity (e.g. per-seat add-ons). */
  qtyFollowsPrimary?: boolean;
}

export interface CpqBundle {
  id: string;
  name: string;
  description?: string;
  options: BundleOption[];
  rules?: OptionRule[];
}

export interface QuoteLine {
  id: string;
  productId: string;
  /** Bundle instance id when the line came from a bundle. */
  bundleKey?: string;
  bundleName?: string;
  quantity: number;
  /** Rep discount in basis points (0-10000). */
  discountBp: number;
  /** Subscription term in months (1 for one-time). */
  termMonths: number;
}

export interface QuoteHeader {
  customer: string;
  contactEmail: string;
  validUntil: string;
  paymentTerms: "net15" | "net30" | "net45" | "net60";
  notes: string;
}

export interface QuoteDraft {
  id: string;
  number: string;
  currency: string;
  header: QuoteHeader;
  lines: QuoteLine[];
  /** Header-level discount in bp applied after line discounts, allocated back to lines. */
  headerDiscountBp: number;
}

export interface QuoteVersion {
  version: number;
  createdAt: string;
  label: string;
  snapshot: QuoteDraft;
  totalMinor: number;
  currency: string;
}

export interface ApprovalTier {
  /** Discount (effective bp against list) at or above which this level is required. */
  minDiscountBp: number;
  approver: string;
}

export interface ApprovalPolicy {
  /** Default rep ceiling when a product has no maxRepDiscountBp. */
  repMaxDiscountBp: number;
  tiers: ApprovalTier[];
  /** Deals above this total (in quote currency minor units) need the top approver. */
  largeDealMinor?: number;
}

/** FX table: price of 1 unit of the key currency in the base currency, e.g. { EUR: "1.08" }. */
export interface FxTable {
  base: string;
  rates: Record<string, string>;
}

export interface PricedLine {
  line: QuoteLine;
  product: CpqProduct;
  /** Effective unit price in quote currency (tier-aware, before discount). */
  unitPrice: number;
  listTotal: number;
  lineDiscount: number;
  headerDiscount: number;
  netTotal: number;
  /** Discount the rep may give on this line without approval. */
  ceilingBp: number;
  needsApproval: boolean;
}

export interface QuoteTotals {
  list: number;
  lineDiscounts: number;
  headerDiscount: number;
  net: number;
  oneTime: number;
  recurringMonthly: number;
  annualContractValue: number;
  effectiveDiscountBp: number;
}

export interface ApprovalResult {
  required: boolean;
  approvers: string[];
  reasons: string[];
}
