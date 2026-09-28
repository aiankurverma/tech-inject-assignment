import * as React from "react";
import {
  CouponInput,
  couponDiscount,
  type AppliedCoupon,
  type CouponValidationResult,
} from "@/components/crm/coupon-input";

const codes: Record<string, AppliedCoupon & { expired?: boolean; minSubtotal?: number }> = {
  LAUNCH20: { code: "LAUNCH20", type: "percent", value: 20, description: "20% off the first year" },
  PARTNER500: {
    code: "PARTNER500",
    type: "amount",
    value: 500,
    description: "$500 partner credit",
    minSubtotal: 2000,
  },
  SUMMER25: { code: "SUMMER25", type: "percent", value: 25, expired: true },
};

export default function Example() {
  const subtotal = 5880;
  const [coupon, setCoupon] = React.useState<AppliedCoupon | null>(null);
  const validate = (code: string) =>
    new Promise<CouponValidationResult>((resolve) =>
      setTimeout(() => {
        const c = codes[code];
        if (!c) return resolve({ ok: false, error: `"${code}" is not a valid code.` });
        if (c.expired) return resolve({ ok: false, error: "This code expired on 31 Aug 2026." });
        if (c.minSubtotal && subtotal < c.minSubtotal)
          return resolve({ ok: false, error: `Requires a subtotal of $${c.minSubtotal}.` });
        resolve({ ok: true, coupon: c });
      }, 700),
    );
  const off = coupon ? couponDiscount(coupon, subtotal) : 0;
  return (
    <div className="flex w-[320px] flex-col gap-3">
      <CouponInput
        onValidate={validate}
        applied={coupon}
        onAppliedChange={setCoupon}
        subtotal={subtotal}
      />
      <p className="text-xs text-crm-soft">
        Try LAUNCH20, PARTNER500 or SUMMER25. Total:{" "}
        <span className="text-crm-fg tabular-nums">${(subtotal - off).toLocaleString()}</span>
      </p>
    </div>
  );
}
