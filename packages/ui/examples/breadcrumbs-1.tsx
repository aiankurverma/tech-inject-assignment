import { Home } from "lucide-react";
import { Breadcrumbs } from "@/components/crm/breadcrumbs";

export default function Example() {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Home", href: "#", icon: <Home /> },
          { label: "Accounts", href: "#" },
          { label: "LVMH" },
        ]}
      />
      <Breadcrumbs
        maxItems={3}
        items={[
          { label: "Workspace", href: "#" },
          { label: "Pipelines", href: "#" },
          { label: "Enterprise", href: "#" },
          { label: "EMEA", href: "#" },
          { label: "Renewal – Q4" },
        ]}
      />
    </div>
  );
}
