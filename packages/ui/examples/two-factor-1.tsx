import * as React from "react";
import { TwoFactor } from "@/components/crm/two-factor";

export default function Example() {
  const [ok, setOk] = React.useState(false);
  if (ok)
    return (
      <p className="text-sm text-crm-fg" role="status">
        Verified. Redirecting to your pipeline...
      </p>
    );
  return (
    <TwoFactor
      phoneHint="+1 ••• ••• 4821"
      backupCodesRemaining={2}
      onSendSms={async () => {
        await new Promise((r) => setTimeout(r, 400));
      }}
      onCancel={() => alert("Back to sign in")}
      onSuccess={() => setOk(true)}
      onVerify={async (code, method) => {
        await new Promise((r) => setTimeout(r, 600));
        if (method === "backup") return code === "K7QP-2MXD";
        return code === "246810";
      }}
    />
  );
}
