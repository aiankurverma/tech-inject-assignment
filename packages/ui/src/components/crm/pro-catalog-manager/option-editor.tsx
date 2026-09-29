import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { planVariants } from "@/components/crm/pro-catalog-manager/catalog";
import type { Product, ProductOption } from "@/components/crm/pro-catalog-manager/types";

const MAX_OPTIONS = 3;
const MAX_VARIANTS = 250;

export interface OptionEditorProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onApply: (productId: string, options: ProductOption[]) => void;
}

/** Option chips (Color, Size…) with a live preview of the Cartesian variant set. */
export function OptionEditor({ product, onOpenChange, onApply }: OptionEditorProps) {
  const [options, setOptions] = React.useState<ProductOption[]>([]);
  React.useEffect(() => {
    if (product) setOptions(product.options.map((o) => ({ ...o, values: [...o.values] })));
  }, [product]);

  const plan = React.useMemo(
    () => (product ? planVariants(product, options) : null),
    [product, options],
  );
  const names = options.map((o) => o.name.trim().toLowerCase());
  const dupName = names.some((n, i) => n && names.indexOf(n) !== i);
  const tooMany = (plan?.variants.length ?? 0) > MAX_VARIANTS;

  const patch = (i: number, fn: (o: ProductOption) => ProductOption) =>
    setOptions((os) => os.map((o, k) => (k === i ? fn(o) : o)));

  return (
    <Dialog.Root open={!!product} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-crm border border-crm-border bg-crm-popover p-5 text-crm-fg shadow-crm-overlay">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-[15px] font-semibold">
                Options and variants
              </Dialog.Title>
              <Dialog.Description className="text-[12.5px] text-crm-muted-fg">
                {product?.title} — every combination of option values becomes a variant. Existing
                variants keep their SKU, price and stock.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="grid size-7 place-items-center rounded-md text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {options.map((o, i) => (
            <fieldset
              key={i}
              className="flex flex-col gap-2 rounded-crm border border-crm-border p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  aria-label={`Option ${i + 1} name`}
                  className="h-8 flex-1 rounded-md border border-crm-input bg-crm-bg px-2 text-[13px] outline-none focus-visible:border-crm-primary"
                  value={o.name}
                  placeholder="Option name, e.g. Size"
                  onChange={(e) => patch(i, (x) => ({ ...x, name: e.target.value }))}
                />
                <button
                  type="button"
                  aria-label={`Remove option ${o.name}`}
                  className="grid size-8 place-items-center rounded-md text-crm-muted-fg hover:text-crm-danger"
                  onClick={() => setOptions((os) => os.filter((_, k) => k !== i))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <ChipInput
                label={o.name || `Option ${i + 1}`}
                values={o.values}
                onChange={(values) => patch(i, (x) => ({ ...x, values }))}
              />
            </fieldset>
          ))}
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 self-start rounded-md border border-crm-border px-2.5 text-[12.5px] text-crm-soft hover:bg-crm-muted hover:text-crm-fg"
              onClick={() => setOptions((os) => [...os, { name: "", values: [] }])}
            >
              <Plus className="size-3.5" /> Add option
            </button>
          )}

          {plan && (
            <div
              role="status"
              className={cn(
                "rounded-md border p-2.5 text-[12.5px]",
                tooMany || dupName
                  ? "border-tag-red-border bg-tag-red-bg text-tag-red-text"
                  : "border-crm-border bg-crm-bg text-crm-soft",
              )}
            >
              {dupName
                ? "Option names must be unique."
                : tooMany
                  ? `${plan.variants.length} variants exceeds the ${MAX_VARIANTS} limit per product.`
                  : `${plan.variants.length} variants: ${plan.kept} kept, ${plan.added} new, ${plan.removed.length} removed.`}
              {!tooMany && !dupName && plan.removed.length > 0 && (
                <p className="mt-1 text-crm-warning">
                  Removing{" "}
                  {plan.removed
                    .slice(0, 4)
                    .map((v) => v.sku)
                    .join(", ")}
                  {plan.removed.length > 4 ? ` and ${plan.removed.length - 4} more` : ""} (undo
                  restores them).
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Dialog.Close className="h-8 rounded-md border border-crm-border px-3 text-[12.5px] text-crm-soft hover:bg-crm-muted">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              disabled={!product || tooMany || dupName}
              className="h-8 rounded-md bg-crm-primary px-3 text-[12.5px] font-medium text-crm-primary-fg hover:opacity-90 disabled:opacity-50"
              onClick={() => {
                if (!product) return;
                onApply(
                  product.id,
                  options
                    .map((o) => ({ name: o.name.trim(), values: o.values }))
                    .filter((o) => o.name && o.values.length),
                );
                onOpenChange(false);
              }}
            >
              Generate variants
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ChipInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [text, setText] = React.useState("");
  const add = (raw: string) => {
    const incoming = raw
      .split(/[,\n\t]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen = new Set(values.map((v) => v.toLowerCase()));
    const next = [...values];
    for (const v of incoming)
      if (!seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase());
        next.push(v);
      }
    onChange(next);
    setText("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-crm-input bg-crm-bg p-1.5 focus-within:border-crm-primary">
      {values.map((v, i) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-full border border-crm-border bg-crm-raised py-px pl-2 pr-1 text-[12px]"
        >
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            className="grid size-4 place-items-center rounded-full text-crm-muted-fg hover:text-crm-danger"
            onClick={() => onChange(values.filter((_, k) => k !== i))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        aria-label={`Add ${label} values`}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-[12.5px] outline-none"
        placeholder={values.length ? "" : "Type a value, press Enter"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const t = e.clipboardData.getData("text/plain");
          if (/[,\n\t]/.test(t)) {
            e.preventDefault();
            add(t);
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && text.trim()) {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => text.trim() && add(text)}
      />
    </div>
  );
}
