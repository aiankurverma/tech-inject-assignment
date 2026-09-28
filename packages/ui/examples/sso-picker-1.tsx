import * as React from "react";
import { Building2, Cloud, Globe, KeyRound } from "lucide-react";
import { SsoPicker, type SsoProvider } from "@/components/crm/sso-picker";

const providers: SsoProvider[] = [
  { id: "google", name: "Google", kind: "oauth", icon: <Globe /> },
  { id: "microsoft", name: "Microsoft", kind: "oauth", icon: <Cloud /> },
  { id: "okta", name: "Okta", kind: "saml", icon: <KeyRound /> },
  {
    id: "entra",
    name: "Entra ID",
    kind: "oidc",
    icon: <Building2 />,
    disabled: true,
    disabledReason: "Signing certificate expired on 12 Sep. Contact your admin.",
  },
];

const domainRules = [
  { domain: "northwind.com", providerId: "okta", orgName: "Northwind Traders", enforced: true },
  { domain: "contoso.io", providerId: "microsoft", orgName: "Contoso" },
];

export default function Example() {
  const [log, setLog] = React.useState("Try alex@northwind.com or sam@contoso.io");
  return (
    <div className="flex flex-col items-center gap-3">
      <SsoPicker
        providers={providers}
        domainRules={domainRules}
        lastUsedId="google"
        onSelect={async (id, email) => {
          await new Promise((r) => setTimeout(r, 900));
          if (id === "microsoft" && !email)
            throw new Error("Microsoft returned AADSTS50020: account is not in this tenant.");
          setLog(`Redirecting to ${id}${email ? ` for ${email}` : ""}…`);
        }}
        onPasswordSignIn={(email) => setLog(`Password sign-in for ${email}`)}
      />
      <p className="text-xs text-crm-subtle" aria-live="polite">
        {log}
      </p>
    </div>
  );
}
