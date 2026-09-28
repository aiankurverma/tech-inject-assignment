import * as React from "react";
import { ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaxRate {
  id: string;
  /** e.g. "CGST", "State sales tax", "VAT". */
  label: string;
  /** Percentage, e.g. 9 for 9%. */
  rate: number;
  /** Jurisdiction shown as a caption, e.g. "Karnataka", "CA". */
  jurisdiction?: string;
  /** Compound taxes are charged on base + previously applied taxes (e.g. Quebec QST). */
  compound?: boolean;
}

export interface TaxableLine {
  id: string;
  description: string;
  /** Net amount (after discounts) in minor-free decimal units. */
  amount: number;
  /** Ids of TaxRate that apply; omitted = all rates. */
  taxIds?: string[];
  /** Line is tax exempt (e.g. exported services). */
  exempt?: boolean;
}

export interface TaxLineResult {
  rate: TaxRate;
  taxable: number;
  tax: number;
  lines: { id: string; description: string; taxable: number; tax: number }[];
}

export interface TaxComputation {
  subtotal: number;
  exemptTotal: number;
  byRate: TaxLineResult[];
  totalTax: number;
  total: number;
  /** Net amount when prices were entered tax-inclusive. */
  inclusive: boolean;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Compute taxes per rate. Simple rates apply to the net line amount, compound rates to
 * net + the simple taxes already on that line. With `inclusive`, line amounts are gross and
 * the net is backed out first.
 */
export function computeTaxes(
  lines: TaxableLine[],
  rates: TaxRate[],
  inclusive = false,
): TaxComputation {
  const byRate = new Map<string, TaxLineResult>(
    rates.map((r) => [r.id, { rate: r, taxable: 0, tax: 0, lines: [] }]),
  );
  let subtotal = 0;
  let exemptTotal = 0;
  for (const line of lines) {
    const applicable = line.exempt
      ? []
      : rates.filter((r) => !line.taxIds || line.taxIds.includes(r.id));
    const simple = applicable.filter((r) => !r.compound);
    const compound = applicable.filter((r) => r.compound);
    let net = line.amount;
    if (inclusive && applicable.length) {
      const simpleFactor = 1 + simple.reduce((s, r) => s + r.rate / 100, 0);
      const compoundFactor = compound.reduce((f, r) => f * (1 + r.rate / 100), 1);
      net = line.amount / (simpleFactor * compoundFactor);
    }
    subtotal += net;
    if (line.exempt) exemptTotal += net;
    let running = net;
    for (const r of simple) {
      const t = net * (r.rate / 100);
      running += t;
      const agg = byRate.get(r.id)!;
      agg.taxable += net;
      agg.tax += t;
      agg.lines.push({ id: line.id, description: line.description, taxable: net, tax: t });
    }
    for (const r of compound) {
      const t = running * (r.rate / 100);
      const agg = byRate.get(r.id)!;
      agg.taxable += running;
      agg.tax += t;
      agg.lines.push({ id: line.id, description: line.description, taxable: running, tax: t });
      running += t;
    }
  }
  const results = [...byRate.values()]
    .filter((r) => r.lines.length)
    .map((r) => ({
      ...r,
      taxable: round2(r.taxable),
      tax: round2(r.tax),
      lines: r.lines.map((l) => ({ ...l, taxable: round2(l.taxable), tax: round2(l.tax) })),
    }));
  const totalTax = round2(results.reduce((s, r) => s + r.tax, 0));
  const sub = round2(subtotal);
  return {
    subtotal: sub,
    exemptTotal: round2(exemptTotal),
    byRate: results,
    totalTax,
    total: round2(sub + totalTax),
    inclusive,
  };
}

export interface TaxBreakdownProps {
  lines: TaxableLine[];
  rates: TaxRate[];
  currency?: string;
  locale?: string;
  /** Line amounts already include tax. */
  inclusive?: boolean;
  /** Reverse charge / tax-exempt customer: shows the note and zeroes tax. */
  exemptReason?: string;
  /** Show per-line detail under each tax row (expandable). */
  expandable?: boolean;
  loading?: boolean;
  error?: string;
  onComputed?: (c: TaxComputation) => void;
  className?: string;
}

/** Tax lines grouped by rate/jurisdiction with compound, inclusive and exempt handling, and expandable per-line detail. */
export function TaxBreakdown({
  lines,
  rates,
  currency = "USD",
  locale = "en-US",
  inclusive = false,
  exemptReason,
  expandable = true,
  loading,
  error,
  onComputed,
  className,
}: TaxBreakdownProps) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const calc = React.useMemo(
    () =>
      computeTaxes(
        exemptReason ? lines.map((l) => ({ ...l, exempt: true })) : lines,
        rates,
        inclusive,
      ),
    [lines, rates, inclusive, exemptReason],
  );
  const cb = React.useRef(onComputed);
  cb.current = onComputed;
  React.useEffect(() => cb.current?.(calc), [calc]);
  const fmt = React.useCallback(
    (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(n),
    [locale, currency],
  );
  const effective = calc.subtotal ? (calc.totalTax / calc.subtotal) * 100 : 0;

  return (
    <section
      aria-label="Tax breakdown"
      aria-busy={loading || undefined}
      className={cn(
        "rounded-crm border border-crm-border bg-crm-card font-crm text-sm text-crm-fg",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-crm-border px-4 py-3">
        <span className="crm-eyebrow text-crm-faint">Tax</span>
        <span className="text-xs text-crm-subtle">
          {inclusive ? "Prices include tax" : "Prices exclude tax"} · effective{" "}
          <span className="text-crm-soft tabular-nums">{effective.toFixed(2)}%</span>
        </span>
      </header>
      {error ? (
        <p role="alert" className="px-4 py-3 text-xs text-crm-danger">
          {error}
        </p>
      ) : loading ? (
        <div className="space-y-2 px-4 py-3" aria-label="Calculating tax">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-crm-muted" />
          ))}
        </div>
      ) : (
        <dl className="divide-y divide-crm-border">
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-crm-muted-fg">Subtotal{inclusive ? " (net)" : ""}</dt>
            <dd className="tabular-nums">{fmt(calc.subtotal)}</dd>
          </div>
          {exemptReason ? (
            <div className="flex items-start gap-2 px-4 py-2.5 text-xs text-crm-soft" role="note">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-crm-subtle" />
              {exemptReason}
            </div>
          ) : calc.byRate.length === 0 ? (
            <div className="px-4 py-2.5 text-xs text-crm-subtle">
              No taxes apply to these items.
            </div>
          ) : (
            calc.byRate.map((r) => {
              const isOpen = !!open[r.rate.id];
              const panelId = `tax-${r.rate.id}`;
              return (
                <div key={r.rate.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex min-w-0 items-center gap-1.5">
                      {expandable ? (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() => setOpen((o) => ({ ...o, [r.rate.id]: !isOpen }))}
                          className="-ml-1 rounded p-0.5 text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                        >
                          <ChevronRight
                            className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
                          />
                          <span className="sr-only">Toggle {r.rate.label} detail</span>
                        </button>
                      ) : null}
                      <span className="truncate text-crm-soft">
                        {r.rate.label} <span className="tabular-nums">{r.rate.rate}%</span>
                      </span>
                      {r.rate.jurisdiction ? (
                        <span className="crm-caption text-crm-subtle">{r.rate.jurisdiction}</span>
                      ) : null}
                      {r.rate.compound ? (
                        <span className="crm-caption rounded-full bg-crm-muted px-1.5 text-crm-chip">
                          compound
                        </span>
                      ) : null}
                    </dt>
                    <dd className="shrink-0 tabular-nums">{fmt(r.tax)}</dd>
                  </div>
                  {expandable && isOpen ? (
                    <ul id={panelId} className="mt-2 space-y-1 border-l border-crm-border pl-3">
                      {r.lines.map((l) => (
                        <li
                          key={l.id}
                          className="flex justify-between gap-3 text-xs text-crm-subtle"
                        >
                          <span className="truncate">
                            {l.description} · on {fmt(l.taxable)}
                          </span>
                          <span className="tabular-nums">{fmt(l.tax)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })
          )}
          {calc.exemptTotal > 0 && !exemptReason ? (
            <div className="flex justify-between px-4 py-2.5 text-xs text-crm-subtle">
              <dt>Exempt items</dt>
              <dd className="tabular-nums">{fmt(calc.exemptTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-crm-muted-fg">Total tax</dt>
            <dd className="tabular-nums">{fmt(calc.totalTax)}</dd>
          </div>
          <div className="flex justify-between px-4 py-3 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{fmt(calc.total)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
