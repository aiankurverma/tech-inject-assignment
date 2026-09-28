import * as React from "react";
import { Button } from "@/components/crm/button";
import { OtpInput } from "@/components/crm/otp-input";

export default function Example() {
  const [code, setCode] = React.useState("482");
  const [status, setStatus] = React.useState<"idle" | "ok" | "bad">("idle");
  return (
    <div className="flex flex-col items-start gap-3 rounded-crm border border-crm-border bg-crm-card p-5">
      <span className="text-sm font-medium text-crm-fg">Verify your email</span>
      <span className="text-xs text-crm-soft">Enter the 6-digit code sent to your email</span>
      <OtpInput
        value={code}
        onChange={(v) => {
          setCode(v);
          setStatus("idle");
        }}
        onComplete={(v) => setStatus(v === "123456" ? "ok" : "bad")}
        groupSize={3}
        invalid={status === "bad"}
      />
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={code.length < 6}
          onClick={() => setStatus(code === "123456" ? "ok" : "bad")}
        >
          Verify
        </Button>
        <span
          className={
            status === "ok"
              ? "text-xs text-crm-success"
              : status === "bad"
                ? "text-xs text-crm-danger"
                : "text-xs text-crm-subtle"
          }
          aria-live="polite"
        >
          {status === "ok"
            ? "Verified"
            : status === "bad"
              ? "Code is incorrect (try 123456)"
              : "Didn't get it? Resend in 0:42"}
        </span>
      </div>
    </div>
  );
}
