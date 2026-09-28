import * as React from "react";
import { KanbanColumn } from "@/components/crm/kanban-column";
import type { Deal } from "@/components/crm/deal-card";

const initial: Record<string, Deal[]> = {
  proposal: [
    {
      id: "a",
      title: "Enterprise renewal",
      company: "LVMH",
      amount: 530111,
      probability: 60,
      closeDate: "Oct 14",
      owner: { name: "Maya Chen" },
    },
    {
      id: "b",
      title: "Pilot – 50 seats",
      company: "Dinosaur Labs",
      amount: 42000,
      probability: 35,
      closeDate: "Oct 2",
      owner: { name: "Leo Park" },
    },
  ],
  negotiation: [
    {
      id: "c",
      title: "Platform expansion",
      company: "Javu",
      amount: 128400,
      probability: 75,
      closeDate: "Sep 30",
      owner: { name: "Sam Ortiz" },
      tag: { label: "Legal", color: "amber" },
    },
  ],
};

export default function Example() {
  const [cols, setCols] = React.useState(initial);
  const move = (to: string) => (id: string) =>
    setCols((c) => {
      const from = Object.keys(c).find((k) => c[k]!.some((d) => d.id === id));
      if (!from || from === to) return c;
      const deal = c[from]!.find((d) => d.id === id)!;
      return { ...c, [from]: c[from]!.filter((d) => d.id !== id), [to]: [...c[to]!, deal] };
    });
  return (
    <div className="flex h-[460px] gap-3">
      <KanbanColumn
        title="Proposal"
        color="#f5a524"
        deals={cols.proposal!}
        onDropDeal={move("proposal")}
        onAdd={() => {}}
      />
      <KanbanColumn
        title="Negotiation"
        color="#6346ff"
        deals={cols.negotiation!}
        onDropDeal={move("negotiation")}
        onAdd={() => {}}
        limit={3}
      />
    </div>
  );
}
