import * as React from "react";
import { SignUp } from "@/components/crm/sign-up";

export default function Example() {
  const [done, setDone] = React.useState<string | null>(null);
  if (done)
    return (
      <p className="text-sm text-crm-fg" role="status">
        {done}
      </p>
    );
  return (
    <SignUp
      existingWorkspaces={[
        { domain: "northwind.io", name: "Northwind Traders", members: 48 },
        { domain: "contoso.com", name: "Contoso Sales", members: 312 },
      ]}
      onJoinWorkspace={(w, email) => setDone(`Join request for ${email} sent to ${w.name} admins.`)}
      onSignIn={() => alert("Open sign-in")}
      onSubmit={async (v) => {
        await new Promise((r) => setTimeout(r, 900));
        if (v.email.startsWith("taken@")) return "An account with this email already exists.";
        setDone(`Welcome, ${v.fullName.split(" ")[0]}! Check ${v.email} to verify your account.`);
      }}
    />
  );
}
