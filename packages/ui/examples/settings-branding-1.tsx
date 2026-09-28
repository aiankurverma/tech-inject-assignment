import { SettingsBranding } from "@/components/crm/settings-branding";

export default function Example() {
  return (
    <SettingsBranding
      defaultValue={{
        companyName: "Harborview Health",
        accent: "#38bdf8",
        customDomain: "portal.harborview.health",
        emailFooter:
          "Harborview Health Partners · 410 Mission St, Suite 900, San Francisco, CA 94105",
        cornerStyle: "rounded",
      }}
      onSave={async () => {
        await new Promise((r) => setTimeout(r, 700));
      }}
    />
  );
}
