import * as React from "react";
import { cn } from "@/lib/utils";
import { LogoTile } from "@/components/crm/avatar";
import { MoneyValue } from "@/components/crm/data-cells";
import { SegmentedMeter } from "@/components/crm/segmented-meter";

export interface AccountListItemProps {
  name: string;
  meta: string;
  amount: number;
  /** Win probability 0-100 */
  probability: number;
  logo?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/** Company row: logo, name, meta line, amount and meter. Becomes a button when onClick is set. */
export function AccountListItem({
  name,
  meta,
  amount,
  probability,
  logo,
  onClick,
  className,
}: AccountListItemProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-crm px-2 py-2 text-left font-crm",
        onClick &&
          "cursor-pointer hover:bg-crm-card focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none",
        className,
      )}
    >
      <LogoTile>{logo}</LogoTile>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-crm-fg">{name}</span>
        <span className="block truncate text-xs text-crm-muted-fg">{meta}</span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <MoneyValue amount={amount} />
        <SegmentedMeter value={probability} segments={14} label={`${name} win probability`} />
      </span>
    </Comp>
  );
}
