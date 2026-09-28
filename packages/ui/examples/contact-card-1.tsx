import { MoreHorizontal } from "lucide-react";
import { IconButton } from "@/components/crm/button";
import { ContactCard } from "@/components/crm/contact-card";

export default function Example() {
  return (
    <div className="flex w-[340px] flex-col gap-4">
      <ContactCard
        name="Rachel Green"
        title="VP Procurement"
        company="LVMH"
        email="rachel.green@lvmh.example"
        phone="+33 1 44 13 22 22"
        location="Paris, France"
        tags={[
          { label: "Champion", color: "green" },
          { label: "Enterprise", color: "purple" },
          { label: "EMEA", color: "blue" },
          { label: "Renewal", color: "amber" },
        ]}
        footer="Owner Maya Chen · Last touch 2 days ago"
        actions={
          <IconButton label="More actions">
            <MoreHorizontal />
          </IconButton>
        }
      />
      <div className="rounded-xl border border-crm-border bg-crm-sidebar p-1">
        <ContactCard
          variant="compact"
          name="Ross Geller"
          title="CTO"
          company="Dinosaur Labs"
          tags={[{ label: "Decision maker", color: "teal" }]}
          onClick={() => {}}
        />
        <ContactCard
          variant="compact"
          name="Monica Bing"
          title="Head of Ops"
          company="Javu"
          onClick={() => {}}
        />
      </div>
    </div>
  );
}
