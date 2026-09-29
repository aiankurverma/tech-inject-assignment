import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Percent } from "lucide-react";
import { bulkPrice, type BulkPriceOptions } from "@/components/crm/pro-catalog-manager/catalog";

const field =
  "h-8 w-full rounded-md border border-crm-input bg-crm-bg px-2 text-[13px] text-crm-fg outline-none focus-visible:border-crm-primary";

export interface BulkPriceProps {
  /** Number of variants the change will touch. */
  targetCount: number;
  targetLabel: string;
  disabled?: boolean;
  onApply: (o: BulkPriceOptions) => void;
}

export function BulkPrice({ targetCount, targetLabel, disabled, onApply }: BulkPriceProps) {
  const [open, setOpen] = React.useState(false);
  const [o, setO] = React.useState<BulkPriceOptions>({
    field: "price",
    mode: "percent",
    amount: 10,
    rounding: "cents",
  });
  const example = bulkPrice(49.99, o);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled || targetCount === 0}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-crm-border bg-crm-raised px-2.5 text-[12.5px] text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <Percent className="size-3.5" /> Bulk price
        {targetCount > 0 && <span className="text-crm-muted-fg">({targetCount})</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-50 flex w-72 flex-col gap-3 rounded-crm border border-crm-border bg-crm-popover p-3 text-crm-fg shadow-crm-overlay"
        >
          <p className="text-[12.5px] text-crm-soft">
            Change <b className="text-crm-fg">{targetCount.toLocaleString()}</b> variants (
            {targetLabel})
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11.5px] text-crm-muted-fg">
              Field
              <select
                className={field}
                value={o.field}
                onChange={(e) => setO({ ...o, field: e.target.value as BulkPriceOptions["field"] })}
              >
                <option value="price">Price</option>
                <option value="compareAt">Compare at</option>
                <option value="cost">Cost</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-crm-muted-fg">
              Change
              <select
                className={field}
                value={o.mode}
                onChange={(e) => setO({ ...o, mode: e.target.value as BulkPriceOptions["mode"] })}
              >
                <option value="percent">By percent</option>
                <option value="fixed">By amount</option>
                <option value="set">Set to</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-crm-muted-fg">
              {o.mode === "percent" ? "Percent (±)" : "Amount"}
              <input
                type="number"
                step="any"
                className={field}
                value={Number.isFinite(o.amount) ? o.amount : ""}
                onChange={(e) => setO({ ...o, amount: parseFloat(e.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-crm-muted-fg">
              Rounding
              <select
                className={field}
                value={o.rounding}
                onChange={(e) =>
                  setO({ ...o, rounding: e.target.value as BulkPriceOptions["rounding"] })
                }
              >
                <option value="cents">Nearest cent</option>
                <option value="whole">Whole number</option>
                <option value="99">End in .99</option>
              </select>
            </label>
          </div>
          <p className="text-[11.5px] text-crm-muted-fg">
            Example: 49.99 → {example == null ? "—" : example.toFixed(2)}
          </p>
          <button
            type="button"
            disabled={!Number.isFinite(o.amount)}
            onClick={() => {
              onApply(o);
              setOpen(false);
            }}
            className="h-8 rounded-md bg-crm-primary text-[12.5px] font-medium text-crm-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            Apply to {targetCount.toLocaleString()} variants
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
