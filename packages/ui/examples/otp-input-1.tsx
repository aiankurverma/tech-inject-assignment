import * as React from "react";
import { OtpInput } from "@/components/crm/otp-input";

export default function Example() {
  const [code, setCode] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "ok" | "bad">("idle");
  return (
    <div className="flex flex-col items-start gap-3">
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
      <span className="text-xs text-crm-subtle" aria-live="polite">
        {status === "ok" ? "Verified" : status === "bad" ? "Code is incorrect (try 123456)" : " "}
      </span>
    </div>
  );
}
