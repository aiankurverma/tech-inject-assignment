import * as React from "react";
import { InviteAccept, type Invitation } from "@/components/crm/invite-accept";
import { SegmentedControl } from "@/components/crm/segmented-control";

type Scenario = "valid" | "mismatch" | "expired" | "revoked";

const base: Invitation = {
  workspaceName: "Northwind Sales",
  memberCount: 42,
  inviter: { name: "Priya Raman", email: "priya@northwind.com" },
  role: "member",
  email: "dev.kapoor@northwind.com",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 19).toISOString(),
  status: "pending",
  teams: ["EMEA Enterprise", "Renewals"],
};

export default function Example() {
  const [scenario, setScenario] = React.useState<Scenario>("valid");
  const invitation: Invitation =
    scenario === "expired"
      ? { ...base, expiresAt: new Date(Date.now() - 60_000).toISOString() }
      : scenario === "revoked"
        ? { ...base, status: "revoked" }
        : base;
  return (
    <div className="flex flex-col items-center gap-4">
      <SegmentedControl
        label="Scenario"
        size="sm"
        value={scenario}
        onValueChange={(v) => setScenario(v as Scenario)}
        options={[
          { value: "valid", label: "Valid" },
          { value: "mismatch", label: "Wrong account" },
          { value: "expired", label: "Expired" },
          { value: "revoked", label: "Revoked" },
        ]}
      />
      <InviteAccept
        key={scenario}
        invitation={invitation}
        currentUserEmail={scenario === "mismatch" ? "dev.kapoor@gmail.com" : undefined}
        requireName
        onAccept={() => new Promise((r) => setTimeout(r, 800))}
        onDecline={() => new Promise((r) => setTimeout(r, 500))}
        onSwitchAccount={() => setScenario("valid")}
      />
    </div>
  );
}
