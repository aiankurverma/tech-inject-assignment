import * as React from "react";
import {
  FileDown,
  History,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { BundlePicker } from "@/components/crm/pro-cpq-quote-builder/bundle-picker";
import { LineGrid } from "@/components/crm/pro-cpq-quote-builder/line-grid";
import { QuoteHeaderForm } from "@/components/crm/pro-cpq-quote-builder/quote-header-form";
import { downloadQuotePdf } from "@/components/crm/pro-cpq-quote-builder/quote-pdf";
import { formatBp, formatMoney } from "@/components/crm/pro-cpq-quote-builder/money";
import { evaluateApproval, priceQuote } from "@/components/crm/pro-cpq-quote-builder/pricing";
import type {
  ApprovalPolicy,
  CpqBundle,
  CpqProduct,
  FxTable,
  QuoteDraft,
  QuoteLine,
  QuoteVersion,
} from "@/components/crm/pro-cpq-quote-builder/types";
import { useCpqQuote } from "@/hooks/use-cpq-quote";

export type {
  ApprovalPolicy,
  CpqBundle,
  CpqProduct,
  FxTable,
  QuoteDraft,
  QuoteLine,
  QuoteVersion,
} from "@/components/crm/pro-cpq-quote-builder/types";
export { formatMoney, toMinor } from "@/components/crm/pro-cpq-quote-builder/money";
export { priceQuote, listTotalFor } from "@/components/crm/pro-cpq-quote-builder/pricing";

export interface ProCpqQuoteBuilderProps {
  products: readonly CpqProduct[];
  bundles: readonly CpqBundle[];
  fx: FxTable;
  policy: ApprovalPolicy;
  /** Controlled quote. */
  value?: QuoteDraft;
  defaultValue: QuoteDraft;
  onChange?: (quote: QuoteDraft) => void;
  versions?: QuoteVersion[];
  defaultVersions?: QuoteVersion[];
  onVersionsChange?: (versions: QuoteVersion[]) => void;
  /** Currencies the rep may quote in (must exist in fx). */
  currencies?: string[];
  sellerName?: string;
  locale?: string;
  defaultTermMonths?: number;
  readOnly?: boolean;
  loading?: boolean;
  error?: string | null;
  gridHeight?: number;
  /** Called when the rep submits a quote that needs approval. */
  onRequestApproval?: (quote: QuoteDraft, approvers: string[]) => void;
  className?: string;
}

let seq = 0;
const newId = () => `ql_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Configure-price-quote workspace: bundles, virtualised line grid, approvals, FX totals, PDF. */
export function ProCpqQuoteBuilder({
  products,
  bundles,
  fx,
  policy,
  value,
  defaultValue,
  onChange,
  versions,
  defaultVersions,
  onVersionsChange,
  currencies,
  sellerName = "Your company",
  locale = "en-US",
  defaultTermMonths = 12,
  readOnly,
  loading,
  error,
  gridHeight,
  onRequestApproval,
  className,
}: ProCpqQuoteBuilderProps) {
  const state = useCpqQuote({
    value,
    defaultValue,
    onChange,
    versions,
    defaultVersions,
    onVersionsChange,
  });
  const { quote, dispatch } = state;
  const catalog = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const currencyList = React.useMemo(
    () => currencies ?? [fx.base, ...Object.keys(fx.rates)],
    [currencies, fx],
  );

  const format = React.useCallback(
    (m: number) => formatMoney(m, quote.currency, locale),
    [quote.currency, locale],
  );
  const formatNative = React.useCallback(
    (m: number, c: string) => formatMoney(m, c, locale),
    [locale],
  );

  const priced = React.useMemo(() => {
    try {
      return { ok: true as const, ...priceQuote(quote, catalog, fx, policy) };
    } catch (e) {
      return { ok: false as const, message: (e as Error).message };
    }
  }, [quote, catalog, fx, policy]);

  const approval = React.useMemo(
    () =>
      priced.ok
        ? evaluateApproval(priced.lines, priced.totals, policy, format)
        : { required: false, approvers: [], reasons: [] },
    [priced, policy, format],
  );

  const onUpdate = React.useCallback(
    (ids: readonly string[], patch: Partial<Omit<QuoteLine, "id">>) =>
      dispatch(
        ids.length === 1
          ? { type: "updateLine", id: ids[0]!, patch }
          : { type: "updateLines", ids, patch },
      ),
    [dispatch],
  );
  const onRemove = React.useCallback(
    (ids: readonly string[]) => dispatch({ type: "removeLines", ids }),
    [dispatch],
  );
  const onAdd = React.useCallback(
    (lines: QuoteLine[]) => dispatch({ type: "addLines", lines }),
    [dispatch],
  );

  const [exporting, setExporting] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const exportPdf = async () => {
    if (!priced.ok) return;
    setExporting(true);
    try {
      const v = state.saveVersion(
        `Exported ${new Date().toLocaleString(locale)}`,
        priced.totals.net,
      );
      await downloadQuotePdf({
        quote,
        lines: priced.lines,
        totals: priced.totals,
        approval,
        version: v.version,
        sellerName,
        format,
      });
      setStatus(`Saved version ${v.version} and downloaded PDF`);
    } catch (e) {
      setStatus(`PDF export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-busy
        className={cn(
          "flex h-64 items-center justify-center gap-2 rounded-crm border border-crm-border bg-crm-card text-xs text-crm-subtle",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading price book…
      </div>
    );
  }

  const failure = error ?? (priced.ok ? null : priced.message);
  const totals = priced.ok ? priced.totals : null;

  return (
    <section
      aria-label={`Quote ${quote.number}`}
      className={cn("flex flex-col gap-4 font-crm text-crm-fg", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Quote {quote.number}</h2>
          <p className="text-xs text-crm-subtle">
            {quote.lines.length.toLocaleString()} lines · {state.versions.length} saved version
            {state.versions.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-crm-muted-fg">
            Currency
            <select
              value={quote.currency}
              disabled={readOnly}
              onChange={(e) => dispatch({ type: "setCurrency", currency: e.target.value })}
              className="h-[30px] rounded-crm border border-crm-border bg-crm-input px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              {currencyList.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <Button onClick={state.undo} disabled={!state.canUndo || readOnly}>
            <Undo2 className="size-3.5" aria-hidden /> Undo
          </Button>
          <Button variant="primary" onClick={exportPdf} loading={exporting} disabled={!priced.ok}>
            <FileDown className="size-3.5" aria-hidden /> Save &amp; export PDF
          </Button>
        </div>
      </header>

      {failure ? (
        <p role="alert" className="rounded-crm bg-crm-danger/10 px-3 py-2 text-xs text-crm-danger">
          {failure}
        </p>
      ) : null}

      <div className="rounded-crm border border-crm-border bg-crm-card p-3">
        <QuoteHeaderForm
          value={quote.header}
          disabled={readOnly}
          onValidChange={(header) => dispatch({ type: "setHeader", header })}
        />
      </div>

      {!readOnly ? (
        <BundlePicker
          bundles={bundles}
          catalog={catalog}
          defaultTermMonths={defaultTermMonths}
          onAdd={onAdd}
          newId={newId}
        />
      ) : null}

      <LineGrid
        lines={priced.ok ? priced.lines : []}
        format={format}
        formatNative={formatNative}
        readOnly={readOnly}
        height={gridHeight}
        onUpdate={onUpdate}
        onRemove={onRemove}
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          <div
            role="status"
            className={cn(
              "flex items-start gap-2 rounded-crm border p-3 text-xs",
              approval.required
                ? "border-crm-warning/40 bg-crm-warning/10 text-crm-warning"
                : "border-crm-success/40 bg-crm-success/10 text-crm-success",
            )}
          >
            {approval.required ? (
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <div className="flex-1">
              <p className="font-medium">
                {approval.required
                  ? `Approval required: ${approval.approvers.join(" → ")}`
                  : "Within rep discount authority"}
              </p>
              {approval.reasons.map((r) => (
                <p key={r} className="mt-0.5 opacity-80">
                  {r}
                </p>
              ))}
            </div>
            {approval.required && onRequestApproval ? (
              <Button size="sm" onClick={() => onRequestApproval(quote, approval.approvers)}>
                Submit for approval
              </Button>
            ) : null}
          </div>

          {state.versions.length > 0 ? (
            <div className="rounded-crm border border-crm-border bg-crm-card p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-crm-muted-fg">
                <History className="size-3.5" aria-hidden /> Versions
              </p>
              <ol className="flex flex-col gap-1">
                {[...state.versions].reverse().map((v) => (
                  <li key={v.version} className="flex items-center gap-2 text-xs">
                    <span className="w-8 font-medium tabular-nums">v{v.version}</span>
                    <span className="min-w-0 flex-1 truncate text-crm-subtle">{v.label}</span>
                    <span className="tabular-nums">
                      {formatMoney(v.totalMinor, v.currency, locale)}
                    </span>
                    {!readOnly ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Restore version ${v.version}`}
                        onClick={() => state.restoreVersion(v)}
                      >
                        <RotateCcw className="size-3" aria-hidden />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <p role="status" aria-live="polite" className="text-xs text-crm-subtle">
            {status}
          </p>
        </div>

        <dl className="flex flex-col gap-1.5 rounded-crm bg-crm-raised p-4 text-xs shadow-crm-raised">
          {totals ? (
            <>
              <Row k="List total" v={format(totals.list)} />
              <Row k="Line discounts" v={`-${format(totals.lineDiscounts)}`} />
              <div className="flex items-center justify-between gap-2">
                <dt className="text-crm-muted-fg">Header discount</dt>
                <dd className="flex items-center gap-1">
                  <input
                    aria-label="Header discount percent"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    disabled={readOnly}
                    value={quote.headerDiscountBp / 100}
                    onChange={(e) =>
                      dispatch({
                        type: "setHeaderDiscount",
                        bp: Math.round(Number(e.target.value) * 100),
                      })
                    }
                    className="h-6 w-14 rounded-crm border border-crm-border bg-crm-input px-1.5 text-right text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                  />
                  <span className="text-crm-subtle">%</span>
                  <span className="w-24 text-right tabular-nums">
                    -{format(totals.headerDiscount)}
                  </span>
                </dd>
              </div>
              <Row k="Effective discount" v={formatBp(totals.effectiveDiscountBp)} />
              <hr className="my-1 border-crm-border" />
              <Row k="One-time" v={format(totals.oneTime)} />
              <Row k="Monthly recurring" v={format(totals.recurringMonthly)} />
              <Row k="Annual contract value" v={format(totals.annualContractValue)} />
              <hr className="my-1 border-crm-border" />
              <Row k="Quote total" v={format(totals.net)} strong />
            </>
          ) : (
            <p className="text-crm-subtle">Totals unavailable.</p>
          )}
        </dl>
      </div>
    </section>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className={strong ? "text-sm font-semibold text-crm-fg" : "text-crm-muted-fg"}>{k}</dt>
      <dd className={cn("tabular-nums", strong ? "text-sm font-semibold" : "text-crm-fg")}>{v}</dd>
    </div>
  );
}
