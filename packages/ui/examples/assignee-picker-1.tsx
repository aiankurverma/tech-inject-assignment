import * as React from "react";
import { AssigneePicker, type Assignee } from "@/components/crm/assignee-picker";

const people: Assignee[] = [
  { id: "u1", name: "Alex Santos", email: "alex@northwind.io", team: "Sales", openItems: 12 },
  { id: "u2", name: "Priya Nair", email: "priya@northwind.io", team: "Sales", openItems: 23 },
  {
    id: "u3",
    name: "Tom Becker",
    email: "tom@northwind.io",
    team: "Sales",
    openItems: 7,
    outOfOffice: true,
  },
  {
    id: "u4",
    name: "Lena Park",
    email: "lena@northwind.io",
    team: "Customer success",
    openItems: 16,
  },
  {
    id: "u5",
    name: "Jensen Ackles",
    email: "jensen@northwind.io",
    team: "Customer success",
    openItems: 4,
  },
  {
    id: "u6",
    name: "Grace Miller",
    email: "grace@northwind.io",
    team: "Solutions",
    openItems: 19,
    disabled: true,
  },
];

export default function Example() {
  const [owner, setOwner] = React.useState<string | null>("u2");
  const [team, setTeam] = React.useState<string[]>(["u4"]);
  return (
    <div className="flex flex-col gap-4 font-crm">
      <div className="flex items-center gap-3">
        <span className="w-24 crm-caption text-crm-soft">Deal owner</span>
        <AssigneePicker
          people={people}
          value={owner}
          onValueChange={setOwner}
          currentUserId="u1"
          allowUnassigned
          capacity={20}
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="w-24 crm-caption text-crm-soft">Deal team</span>
        <AssigneePicker
          multiple
          max={3}
          people={people}
          value={team}
          onValueChange={setTeam}
          currentUserId="u1"
          placeholder="Add people"
        />
      </div>
    </div>
  );
}
