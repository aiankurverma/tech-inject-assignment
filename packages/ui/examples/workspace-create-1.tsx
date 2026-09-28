import * as React from "react";
import { WorkspaceCreate, type WorkspaceDraft } from "@/components/crm/workspace-create";

const taken = new Set(["acme", "northwind", "globex", "initech-sales"]);

export default function Example() {
  const [created, setCreated] = React.useState<WorkspaceDraft | null>(null);
  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <WorkspaceCreate
        domain="app.kitbase.io/"
        checkSlug={async (slug) => {
          await new Promise((r) => setTimeout(r, 400));
          return taken.has(slug) ? "taken" : "available";
        }}
        onCreate={async (draft) => {
          await new Promise((r) => setTimeout(r, 900));
          if (draft.slug === "fail-demo")
            throw new Error("Workspace limit reached on the Free plan.");
          setCreated(draft);
        }}
        onCancel={() => setCreated(null)}
      />
      <p className="text-xs text-crm-subtle" aria-live="polite">
        {created
          ? `Created ${created.name} (${created.slug}) in ${created.region}`
          : "Try the name “Northwind” to see a taken URL."}
      </p>
    </div>
  );
}
