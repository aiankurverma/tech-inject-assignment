import * as React from "react";
import { ResetPassword } from "@/components/crm/reset-password";

const RECENT = ["Northwind#2025", "Summer!Deals24"];

export default function Example() {
  const [expiresAt, setExpiresAt] = React.useState(() => Date.now() + 14 * 60_000 + 30_000);
  return (
    <ResetPassword
      email="lena.fischer@acme-logistics.de"
      expiresAt={expiresAt}
      policy={{ minLength: 12 }}
      isReused={(pw) => RECENT.includes(pw)}
      onRequestNewLink={() => setExpiresAt(Date.now() + 15 * 60_000)}
      onContinue={() => alert("Go to sign in")}
      onSubmit={async () => {
        await new Promise((r) => setTimeout(r, 800));
      }}
    />
  );
}
