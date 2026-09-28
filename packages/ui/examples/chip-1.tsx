import * as React from "react";
import { Building2 } from "lucide-react";
import { Chip } from "@/components/crm/chip";

const sources = ["Inbound", "Referral", "Outbound", "Event"];

export default function Example() {
  const [selected, setSelected] = React.useState<string[]>(["Inbound"]);
  const [owners, setOwners] = React.useState(["Alex Santos", "Grace Miller"]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <Chip
            key={s}
            selected={selected.includes(s)}
            onSelectedChange={(on) =>
              setSelected((prev) => (on ? [...prev, s] : prev.filter((x) => x !== s)))
            }
          >
            {s}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {owners.map((o) => (
          <Chip key={o} onRemove={() => setOwners((prev) => prev.filter((x) => x !== o))}>
            {o}
          </Chip>
        ))}
        <Chip size="sm" icon={<Building2 />}>
          Acme Corp
        </Chip>
        <Chip size="sm" disabled>
          Archived
        </Chip>
      </div>
    </div>
  );
}
