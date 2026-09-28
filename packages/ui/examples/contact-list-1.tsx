import * as React from "react";
import { ContactList, type ContactRow, type LifecycleStage } from "@/components/crm/contact-list";

const first = [
  "Olivia",
  "Noah",
  "Amara",
  "Kenji",
  "Sara",
  "Mateo",
  "Fatima",
  "Liam",
  "Chloe",
  "Arjun",
  "Ines",
  "Yusuf",
  "Grace",
  "Tomas",
  "Mei",
  "Elias",
  "Zara",
  "Owen",
  "Nadia",
  "Felix",
];
const last = [
  "Nguyen",
  "Schmidt",
  "Okafor",
  "Tanaka",
  "Lindqvist",
  "Rossi",
  "Haddad",
  "Walsh",
  "Dubois",
  "Mehta",
  "Garcia",
  "Demir",
];
const companies = [
  ["Globex", "globex.com"],
  ["Initech", "initech.io"],
  ["Umbrella Health", "umbrella.health"],
  ["Stark Logistics", "stark.co"],
  ["Hooli", "hooli.xyz"],
  ["Tyrell Bio", "tyrell.bio"],
] as const;
const titles = [
  "VP Sales",
  "Head of RevOps",
  "CFO",
  "Procurement Manager",
  "Director of IT",
  "Account Executive",
  "COO",
];
const stages: LifecycleStage[] = [
  "lead",
  "mql",
  "sql",
  "opportunity",
  "customer",
  "subscriber",
  "churned",
  "lead",
  "customer",
];
const owners = ["Maya Chen", "Sam Ortiz", "Ava Goldberg", undefined];

const contacts: ContactRow[] = Array.from({ length: 46 }, (_, i) => {
  const f = first[i % first.length] ?? "Alex";
  const l = last[(i * 5) % last.length] ?? "Smith";
  const [company, domain] = companies[i % companies.length] ?? companies[0];
  return {
    id: `c${i}`,
    name: `${f} ${l}`,
    email: `${f.toLowerCase()}.${l.toLowerCase()}@${domain}`,
    company,
    title: titles[i % titles.length],
    stage: stages[i % stages.length] ?? "lead",
    owner: owners[i % owners.length],
    score: (i * 37) % 101,
    lastActivity: new Date(Date.UTC(2026, 8, 25, 12) - ((i * 97) % 1400) * 3_600_000).toISOString(),
    tags: i % 4 === 0 ? ["webinar"] : i % 5 === 0 ? ["event: SaaStr"] : [],
  };
});

export default function Example() {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [log, setLog] = React.useState("");
  return (
    <div className="flex w-full max-w-[1040px] flex-col gap-2">
      <ContactList
        contacts={contacts}
        selected={selected}
        onSelectedChange={setSelected}
        onBulkAction={(a, ids) => setLog(`${a}: ${ids.length} contacts`)}
        asOf="2026-09-25T12:00:00Z"
      />
      {log ? <p className="font-crm text-xs text-crm-subtle">Last action: {log}</p> : null}
    </div>
  );
}
