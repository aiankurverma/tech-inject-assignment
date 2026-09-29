import {
  allocate,
  convert,
  discountAmount,
  formatBp,
  multiply,
  parseRate,
  scale,
  RATE_SCALE,
} from "@/components/crm/pro-cpq-quote-builder/money";
import type {
  ApprovalPolicy,
  ApprovalResult,
  BundleOption,
  CpqBundle,
  CpqProduct,
  FxTable,
  PricedLine,
  QuoteDraft,
  QuoteTotals,
} from "@/components/crm/pro-cpq-quote-builder/types";

/** Rate to convert 1 unit of `from` into `to` via the FX table's base currency. */
export function fxRate(fx: FxTable, from: string, to: string): bigint {
  if (from === to) return RATE_SCALE;
  const toBase = (c: string) => (c === fx.base ? RATE_SCALE : parseRate(fx.rates[c] ?? "0"));
  const a = toBase(from);
  const b = toBase(to);
  if (a === 0n || b === 0n) throw new RangeError(`Missing FX rate for ${from} -> ${to}`);
  return (a * RATE_SCALE) / b;
}

/**
 * List total for `qty` units in the product's own currency.
 * - flat: unitPrice x qty
 * - tiered (graduated): sum of units in each band x that band's price
 * - volume: every unit at the price of the band the total qty lands in
 */
export function listTotalFor(product: CpqProduct, qty: number): number {
  const q = Math.max(0, Math.trunc(qty));
  if (product.model === "flat" || !product.tiers?.length) return multiply(product.unitPrice, q);
  const tiers = product.tiers;
  if (product.model === "volume") {
    const tier = tiers.find((t) => t.upTo === null || q <= t.upTo) ?? tiers[tiers.length - 1]!;
    return multiply(tier.unitPrice, q);
  }
  let remaining = q;
  let prevCap = 0;
  let total = 0;
  for (const t of tiers) {
    if (remaining <= 0) break;
    const band = t.upTo === null ? remaining : Math.min(remaining, t.upTo - prevCap);
    total += multiply(t.unitPrice, band);
    remaining -= band;
    prevCap = t.upTo ?? prevCap;
  }
  return total;
}

/** Describe tiers for tooltips/PDF, e.g. "1-10 @ $12 · 11+ @ $9". */
export function describeTiers(product: CpqProduct, fmt: (minor: number) => string): string {
  if (product.model === "flat" || !product.tiers?.length) return `${fmt(product.unitPrice)} / unit`;
  let from = 1;
  return product.tiers
    .map((t) => {
      const label = t.upTo === null ? `${from}+` : `${from}-${t.upTo}`;
      from = (t.upTo ?? from) + 1;
      return `${label} @ ${fmt(t.unitPrice)}`;
    })
    .join(" · ");
}

function termMultiplier(product: CpqProduct, termMonths: number): number {
  if (product.billing === "one-time") return 1;
  if (product.billing === "annual") return Math.max(1, Math.round(termMonths / 12));
  return Math.max(1, termMonths);
}

/**
 * Price every line in O(n). Header discount is allocated across lines with the largest-remainder
 * method so the line nets always sum exactly to the quote net.
 */
export function priceQuote(
  quote: QuoteDraft,
  catalog: ReadonlyMap<string, CpqProduct>,
  fx: FxTable,
  policy: ApprovalPolicy,
): { lines: PricedLine[]; totals: QuoteTotals } {
  const rateCache = new Map<string, bigint>();
  const rate = (from: string) => {
    let r = rateCache.get(from);
    if (r === undefined) {
      r = fxRate(fx, from, quote.currency);
      rateCache.set(from, r);
    }
    return r;
  };

  const partial: Omit<PricedLine, "headerDiscount" | "netTotal">[] = [];
  for (const line of quote.lines) {
    const product = catalog.get(line.productId);
    if (!product) continue;
    const r = rate(product.currency);
    const nativeList = listTotalFor(product, line.quantity);
    const perTerm = convert(nativeList, product.currency, quote.currency, r);
    const listTotal = multiply(perTerm, termMultiplier(product, line.termMonths));
    const unitPrice = line.quantity > 0 ? scale(perTerm, 1, line.quantity) : 0;
    const discountBp = Math.min(10_000, Math.max(0, line.discountBp));
    const lineDiscount = discountAmount(listTotal, discountBp);
    const ceilingBp = product.maxRepDiscountBp ?? policy.repMaxDiscountBp;
    partial.push({
      line,
      product,
      unitPrice,
      listTotal,
      lineDiscount,
      ceilingBp,
      needsApproval: discountBp > ceilingBp,
    });
  }

  const afterLine = partial.map((p) => p.listTotal - p.lineDiscount);
  const subtotal = afterLine.reduce((a, v) => a + v, 0);
  const headerDiscountTotal = discountAmount(subtotal, quote.headerDiscountBp);
  const shares = allocate(headerDiscountTotal, afterLine);

  const totals: QuoteTotals = {
    list: 0,
    lineDiscounts: 0,
    headerDiscount: headerDiscountTotal,
    net: 0,
    oneTime: 0,
    recurringMonthly: 0,
    annualContractValue: 0,
    effectiveDiscountBp: 0,
  };
  const lines: PricedLine[] = partial.map((p, i) => {
    const headerDiscount = shares[i] ?? 0;
    const netTotal = afterLine[i]! - headerDiscount;
    totals.list += p.listTotal;
    totals.lineDiscounts += p.lineDiscount;
    totals.net += netTotal;
    if (p.product.billing === "one-time") totals.oneTime += netTotal;
    else {
      const months = Math.max(1, p.line.termMonths);
      const monthly = scale(netTotal, 1, months);
      totals.recurringMonthly += monthly;
      totals.annualContractValue += multiply(monthly, 12);
    }
    return { ...p, headerDiscount, netTotal };
  });
  totals.effectiveDiscountBp =
    totals.list > 0 ? Math.round(((totals.list - totals.net) * 10_000) / totals.list) : 0;
  return { lines, totals };
}

/** Evaluate approval thresholds: per-line ceilings, quote-level tiers and large-deal size. */
export function evaluateApproval(
  lines: readonly PricedLine[],
  totals: QuoteTotals,
  policy: ApprovalPolicy,
  fmt: (minor: number) => string,
): ApprovalResult {
  const approvers = new Set<string>();
  const reasons: string[] = [];
  const sorted = [...policy.tiers].sort((a, b) => a.minDiscountBp - b.minDiscountBp);
  const over = lines.filter((l) => l.needsApproval);
  if (over.length > 0) {
    reasons.push(`${over.length.toLocaleString()} line(s) exceed the rep discount ceiling`);
    const first = sorted[0];
    if (first) approvers.add(first.approver);
  }
  const reached = sorted.filter((t) => totals.effectiveDiscountBp >= t.minDiscountBp);
  const top = reached[reached.length - 1];
  if (top) {
    approvers.add(top.approver);
    reasons.push(
      `Effective discount ${formatBp(totals.effectiveDiscountBp)} ≥ ${formatBp(top.minDiscountBp)}`,
    );
  }
  if (policy.largeDealMinor !== undefined && totals.net >= policy.largeDealMinor) {
    const last = sorted[sorted.length - 1];
    if (last) approvers.add(last.approver);
    reasons.push(`Deal size ≥ ${fmt(policy.largeDealMinor)}`);
  }
  return { required: approvers.size > 0, approvers: [...approvers], reasons };
}

export interface BundleSelection {
  selected: Record<string, boolean>;
  qty: Record<string, number>;
}

export function defaultSelection(bundle: CpqBundle): BundleSelection {
  const selected: Record<string, boolean> = {};
  const qty: Record<string, number> = {};
  for (const o of bundle.options) {
    selected[o.id] = Boolean(o.required || o.defaultSelected);
    qty[o.id] = o.defaultQty ?? 1;
  }
  return { selected, qty };
}

export interface RuleViolation {
  optionIds: string[];
  message: string;
}

/** Validate a bundle configuration against its option rules. */
export function validateBundle(
  bundle: CpqBundle,
  sel: BundleSelection,
  label: (o: BundleOption) => string,
): RuleViolation[] {
  const byId = new Map(bundle.options.map((o) => [o.id, o]));
  const name = (id: string) => {
    const o = byId.get(id);
    return o ? label(o) : id;
  };
  const out: RuleViolation[] = [];
  for (const o of bundle.options) {
    if (o.required && !sel.selected[o.id]) {
      out.push({ optionIds: [o.id], message: `${label(o)} is required` });
    }
  }
  for (const rule of bundle.rules ?? []) {
    switch (rule.kind) {
      case "requires":
        if (sel.selected[rule.option] && !sel.selected[rule.requires]) {
          out.push({
            optionIds: [rule.option, rule.requires],
            message: rule.message ?? `${name(rule.option)} requires ${name(rule.requires)}`,
          });
        }
        break;
      case "excludes":
        if (sel.selected[rule.option] && sel.selected[rule.excludes]) {
          out.push({
            optionIds: [rule.option, rule.excludes],
            message:
              rule.message ?? `${name(rule.option)} cannot be combined with ${name(rule.excludes)}`,
          });
        }
        break;
      case "minQty":
        if (sel.selected[rule.option] && (sel.qty[rule.option] ?? 0) < rule.min) {
          out.push({
            optionIds: [rule.option],
            message: rule.message ?? `${name(rule.option)} needs at least ${rule.min} units`,
          });
        }
        break;
      case "pickOne": {
        const count = rule.options.filter((id) => sel.selected[id]).length;
        if (count !== 1) {
          out.push({
            optionIds: rule.options,
            message: rule.message ?? `Choose exactly one of ${rule.options.map(name).join(", ")}`,
          });
        }
        break;
      }
    }
  }
  return out;
}
