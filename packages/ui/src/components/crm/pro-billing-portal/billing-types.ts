export type BillingInterval = "month" | "year";

export interface BillingPlan {
  id: string;
  name: string;
  description?: string;
  /** Price per interval in minor units. */
  prices: Partial<Record<BillingInterval, number>>;
  features: string[];
  highlighted?: boolean;
}

export interface Subscription {
  planId: string;
  interval: BillingInterval;
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
  seats?: number;
}

/** Tokenised payment method — never raw card numbers; only provider token + display metadata. */
export interface PaymentMethod {
  id: string;
  token: string;
  kind: "card" | "sepa" | "ach";
  brand?: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault?: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: "paid" | "open" | "void" | "uncollectible";
  pdfUrl?: string;
}

export interface BillingDetails {
  companyName: string;
  email: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: string;
  taxId?: string;
}

export interface UsageMeter {
  id: string;
  label: string;
  used: number;
  limit: number | null;
  unit?: string;
}

export interface BillingOverview {
  subscription: Subscription;
  plans: BillingPlan[];
  paymentMethods: PaymentMethod[];
  details: BillingDetails;
  usage: UsageMeter[];
  /** Prepaid credit balance in minor units. */
  creditBalance: number;
}

/**
 * Backend adapter. Wire these to your billing provider (Stripe, Paddle, Chargebee, your API).
 * Adding a card should happen in the provider's hosted element; `onAddPaymentMethod` is a hook for that.
 */
export interface BillingApi {
  getOverview: () => Promise<BillingOverview>;
  /** Cursor-paginated invoice history. */
  listInvoices: (cursor?: string) => Promise<{ invoices: Invoice[]; nextCursor?: string }>;
  changePlan: (planId: string, interval: BillingInterval) => Promise<void>;
  cancelSubscription?: () => Promise<void>;
  setDefaultPaymentMethod: (id: string) => Promise<void>;
  removePaymentMethod: (id: string) => Promise<void>;
  updateDetails: (details: BillingDetails) => Promise<void>;
  downloadInvoice?: (invoice: Invoice) => Promise<void> | void;
}

export const billingKeys = {
  overview: ["kitbase-billing", "overview"] as const,
  invoices: ["kitbase-billing", "invoices"] as const,
};
