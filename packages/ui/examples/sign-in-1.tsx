import * as React from "react";
import { Building2, Chrome } from "lucide-react";
import { SignIn } from "@/components/crm/sign-in";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Example() {
  const [signedIn, setSignedIn] = React.useState<string | null>(null);
  if (signedIn)
    return (
      <p className="text-sm text-crm-fg" role="status">
        Signed in as {signedIn}.{" "}
        <button
          type="button"
          className="text-crm-primary underline"
          onClick={() => setSignedIn(null)}
        >
          Sign out
        </button>
      </p>
    );
  return (
    <SignIn
      defaultEmail="dana.whitfield@northwind.io"
      maxAttempts={3}
      lockoutSeconds={20}
      providers={[
        { id: "google", label: "Google", icon: <Chrome /> },
        { id: "saml", label: "company SSO", icon: <Building2 /> },
      ]}
      onProviderClick={(id) => alert(`Redirecting to ${id}...`)}
      onForgotPassword={(email) => alert(`Open forgot-password for ${email || "(no email)"}`)}
      onSignUp={() => alert("Open sign-up")}
      onMagicLink={async () => {
        await wait(700);
      }}
      onSubmit={async ({ email, password }) => {
        await wait(800);
        if (password !== "Pipeline#2026")
          return "Email or password is incorrect (hint: Pipeline#2026).";
        setSignedIn(email);
      }}
    />
  );
}
