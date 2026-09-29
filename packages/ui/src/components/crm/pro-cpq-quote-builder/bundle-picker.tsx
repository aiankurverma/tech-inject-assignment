import * as React from "react";
import { AlertTriangle, Boxes, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import {
  defaultSelection,
  validateBundle,
  type BundleSelection,
} from "@/components/crm/pro-cpq-quote-builder/pricing";
import type {
  BundleOption,
  CpqBundle,
  CpqProduct,
  QuoteLine,
} from "@/components/crm/pro-cpq-quote-builder/types";

export interface BundlePickerProps {
  bundles: readonly CpqBundle[];
  catalog: ReadonlyMap<string, CpqProduct>;
  defaultTermMonths: number;
  disabled?: boolean;
  onAdd: (lines: QuoteLine[]) => void;
  newId: () => string;
}

/** Bundle configurator: pick a bundle, toggle options, rules validated live, add as grouped lines. */
export function BundlePicker({
  bundles,
  catalog,
  defaultTermMonths,
  disabled,
  onAdd,
  newId,
}: BundlePickerProps) {
  const [activeId, setActiveId] = React.useState(bundles[0]?.id ?? "");
  const bundle = bundles.find((b) => b.id === activeId) ?? bundles[0];
  const [selection, setSelection] = React.useState<BundleSelection>(() =>
    bundle ? defaultSelection(bundle) : { selected: {}, qty: {} },
  );
  const [primaryQty, setPrimaryQty] = React.useState(25);
  const [added, setAdded] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (bundle) setSelection(defaultSelection(bundle));
    setAdded(null);
  }, [bundle]);

  const label = React.useCallback(
    (o: BundleOption) => o.label ?? catalog.get(o.productId)?.name ?? o.productId,
    [catalog],
  );
  const violations = React.useMemo(
    () => (bundle ? validateBundle(bundle, selection, label) : []),
    [bundle, selection, label],
  );
  const flagged = React.useMemo(
    () => new Set(violations.flatMap((v) => v.optionIds)),
    [violations],
  );

  if (!bundle) {
    return (
      <div className="rounded-crm border border-dashed border-crm-border p-6 text-center text-xs text-crm-subtle">
        No bundles configured for this price book.
      </div>
    );
  }

  const onTabKey = (e: React.KeyboardEvent) => {
    const idx = bundles.findIndex((b) => b.id === bundle.id);
    let next = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % bundles.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft")
      next = (idx - 1 + bundles.length) % bundles.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = bundles.length - 1;
    else return;
    e.preventDefault();
    const b = bundles[next];
    if (!b) return;
    setActiveId(b.id);
    listRef.current?.querySelector<HTMLElement>(`[data-bundle="${b.id}"]`)?.focus();
  };

  const add = () => {
    const key = newId();
    const lines: QuoteLine[] = bundle.options
      .filter((o) => selection.selected[o.id])
      .map((o) => ({
        id: newId(),
        productId: o.productId,
        bundleKey: key,
        bundleName: bundle.name,
        quantity: o.qtyFollowsPrimary ? primaryQty : (selection.qty[o.id] ?? 1),
        discountBp: 0,
        termMonths: catalog.get(o.productId)?.billing === "one-time" ? 1 : defaultTermMonths,
      }));
    onAdd(lines);
    setAdded(`${bundle.name} added (${lines.length} lines)`);
  };

  return (
    <div className="grid gap-3 md:grid-cols-[200px_1fr]">
      <div
        ref={listRef}
        role="tablist"
        aria-orientation="vertical"
        aria-label="Bundles"
        className="flex flex-row gap-1 overflow-x-auto md:flex-col"
        onKeyDown={onTabKey}
      >
        {bundles.map((b) => {
          const active = b.id === bundle.id;
          return (
            <button
              key={b.id}
              type="button"
              role="tab"
              data-bundle={b.id}
              aria-selected={active}
              aria-controls="cpq-bundle-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveId(b.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-crm px-2.5 py-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                active
                  ? "bg-crm-raised text-crm-fg shadow-crm-raised"
                  : "text-crm-muted-fg hover:bg-crm-muted",
              )}
            >
              <Boxes className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{b.name}</span>
            </button>
          );
        })}
      </div>

      <div
        id="cpq-bundle-panel"
        role="tabpanel"
        aria-label={bundle.name}
        className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-3"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-crm-fg">{bundle.name}</p>
            {bundle.description ? (
              <p className="mt-0.5 text-xs text-crm-subtle">{bundle.description}</p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-xs text-crm-muted-fg">
            Seats / primary qty
            <input
              type="number"
              min={1}
              value={primaryQty}
              disabled={disabled}
              onChange={(e) => setPrimaryQty(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
              className="h-7 w-20 rounded-crm border border-crm-border bg-crm-input px-2 text-right text-xs text-crm-fg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            />
          </label>
        </div>

        <fieldset disabled={disabled} className="flex flex-col divide-y divide-crm-border">
          <legend className="sr-only">Bundle options</legend>
          {bundle.options.map((o) => {
            const product = catalog.get(o.productId);
            const checked = Boolean(selection.selected[o.id]);
            const bad = flagged.has(o.id);
            return (
              <div key={o.id} className="flex items-center gap-3 py-2">
                <input
                  id={`opt-${bundle.id}-${o.id}`}
                  type="checkbox"
                  checked={checked}
                  disabled={o.required}
                  aria-invalid={bad || undefined}
                  onChange={(e) =>
                    setSelection((s) => ({
                      ...s,
                      selected: { ...s.selected, [o.id]: e.target.checked },
                    }))
                  }
                  className="size-3.5 accent-[var(--crm-primary,#6d5bff)]"
                />
                <label
                  htmlFor={`opt-${bundle.id}-${o.id}`}
                  className={cn("min-w-0 flex-1 text-xs", bad ? "text-crm-warning" : "text-crm-fg")}
                >
                  <span className="block truncate">
                    {label(o)}
                    {o.required ? <span className="ml-1 text-crm-subtle">(required)</span> : null}
                  </span>
                  <span className="block truncate text-[11px] text-crm-subtle">
                    {product ? `${product.sku} · ${product.billing}` : "Unknown product"}
                  </span>
                </label>
                {o.qtyFollowsPrimary ? (
                  <span className="text-[11px] text-crm-subtle tabular-nums">× {primaryQty}</span>
                ) : (
                  <input
                    type="number"
                    min={1}
                    aria-label={`${label(o)} quantity`}
                    value={selection.qty[o.id] ?? 1}
                    disabled={!checked}
                    onChange={(e) =>
                      setSelection((s) => ({
                        ...s,
                        qty: { ...s.qty, [o.id]: Math.max(0, Math.trunc(Number(e.target.value))) },
                      }))
                    }
                    className="h-7 w-16 rounded-crm border border-crm-border bg-crm-input px-2 text-right text-xs text-crm-fg tabular-nums outline-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                  />
                )}
              </div>
            );
          })}
        </fieldset>

        {violations.length > 0 ? (
          <ul role="alert" className="flex flex-col gap-1 rounded-crm bg-crm-warning/10 p-2">
            {violations.map((v) => (
              <li key={v.message} className="flex items-center gap-1.5 text-xs text-crm-warning">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                {v.message}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <span role="status" className="text-xs text-crm-success">
            {added ? (
              <span className="inline-flex items-center gap-1">
                <Check className="size-3.5" aria-hidden />
                {added}
              </span>
            ) : null}
          </span>
          <Button
            variant="primary"
            onClick={add}
            disabled={disabled || violations.length > 0}
            aria-describedby={violations.length ? "cpq-bundle-panel" : undefined}
          >
            <Plus className="size-3.5" aria-hidden />
            Add bundle
          </Button>
        </div>
      </div>
    </div>
  );
}
