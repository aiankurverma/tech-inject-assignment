import * as React from "react";
import {
  ProRecordMerge,
  type MergeField,
  type MergeRecord,
  type MergeResult,
} from "@/components/crm/pro-record-merge";

const fields: MergeField[] = [
  { key: "name", label: "Full name", required: true },
  { key: "email", label: "Email", type: "email", required: true, bulkEditable: false },
  { key: "phone", label: "Phone", type: "phone" },
  { key: "company", label: "Company" },
  { key: "title", label: "Job title" },
  {
    key: "lifecycle",
    label: "Lifecycle stage",
    options: ["Subscriber", "Lead", "MQL", "SQL", "Opportunity", "Customer", "Churned"],
  },
  {
    key: "owner",
    label: "Contact owner",
    options: ["Priya Raman", "Marcus Webb", "Sofia Lindqvist", "Kenji Watanabe"],
  },
  { key: "city", label: "City" },
  { key: "revenue", label: "Annual revenue (USD)", type: "number" },
  { key: "website", label: "Website", type: "url" },
  { key: "tags", label: "Tags", type: "tags" },
  { key: "notes", label: "Notes", type: "longtext" },
];

const first = [
  "Aisha",
  "Ben",
  "Carla",
  "Dev",
  "Elena",
  "Farid",
  "Grace",
  "Hiro",
  "Ines",
  "Jonas",
  "Kavya",
  "Liam",
  "Maya",
  "Noah",
  "Olu",
  "Pia",
  "Quinn",
  "Rosa",
  "Sam",
  "Tara",
];
const last = [
  "Patel",
  "Nguyen",
  "Schmidt",
  "Okafor",
  "Rossi",
  "Kim",
  "Silva",
  "Cohen",
  "Haddad",
  "Larsen",
  "Mehta",
  "Walsh",
  "Tanaka",
  "Moreau",
  "Diaz",
];
const companies = [
  ["Northwind Logistics", "northwind.io"],
  ["Helios Energy", "helios-energy.com"],
  ["Brightline Health", "brightline.health"],
  ["Quanta Robotics", "quanta.ai"],
  ["Juniper Bank", "juniperbank.com"],
  ["Orbit Telecom", "orbit.net"],
  ["Summit Pharma", "summitpharma.com"],
  ["Nimbus Cloud", "nimbus.dev"],
] as const;
const titles = [
  "VP Operations",
  "Head of Procurement",
  "IT Director",
  "CFO",
  "Senior Buyer",
  "Product Manager",
  "Director of Engineering",
];
const cities = ["Austin", "Berlin", "Bengaluru", "London", "Toronto", "Singapore", "São Paulo"];
const stages = fields[5]!.options!;
const owners = fields[6]!.options!;
const sources = ["HubSpot import", "Web form", "Salesforce sync", "Event scan", "Manual entry"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRecords(count: number): MergeRecord[] {
  const rnd = mulberry32(7);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)] as T;
  const base = Date.UTC(2026, 8, 1);
  const out: MergeRecord[] = [];
  let n = 0;
  while (out.length < count) {
    const f = pick(first);
    const l = pick(last);
    const [company, domain] = pick(companies);
    const email = `${f}.${l}${n}@${domain}`.toLowerCase();
    const digits = String(2_000_000_000 + Math.floor(rnd() * 7_000_000_000));
    const rec: MergeRecord = {
      id: `C-${String(100_000 + n).slice(1)}`,
      updatedAt: new Date(base - Math.floor(rnd() * 400) * 86_400_000).toISOString(),
      createdAt: new Date(base - Math.floor(400 + rnd() * 600) * 86_400_000).toISOString(),
      source: pick(sources),
      values: {
        name: `${f} ${l}`,
        email,
        phone: `+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`,
        company,
        title: pick(titles),
        lifecycle: pick(stages),
        owner: pick(owners),
        city: pick(cities),
        revenue: Math.round(rnd() * 50) * 1_000_000,
        website: `https://${domain}`,
        tags: rnd() > 0.5 ? ["newsletter"] : [],
        notes:
          rnd() > 0.7
            ? `Met at SaaStr; interested in the ${pick(["analytics", "security", "API"])} tier.`
            : "",
      },
    };
    out.push(rec);
    // ~1 in 25 contacts has 1-3 messy duplicates from other systems.
    if (rnd() < 0.04) {
      const copies = 1 + Math.floor(rnd() * 3);
      for (let c = 0; c < copies && out.length < count; c++) {
        const v = { ...rec.values };
        if (rnd() > 0.5)
          v.phone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
        else v.email = (v.email as string).toUpperCase();
        if (rnd() > 0.5) v.title = `Senior ${v.title}`;
        if (rnd() > 0.6) v.city = "";
        if (rnd() > 0.5) v.lifecycle = pick(stages);
        if (rnd() > 0.6)
          v.notes = `Imported from ${pick(sources)}. ${v.notes || "Asked for pricing."}`;
        if (rnd() > 0.7) v.name = `${f.slice(0, 1)}. ${l}`;
        v.tags = rnd() > 0.5 ? ["webinar", "q3-event"] : v.tags;
        out.push({
          ...rec,
          id: `C-${String(100_000 + ++n).slice(1)}`,
          updatedAt: new Date(base - Math.floor(rnd() * 200) * 86_400_000).toISOString(),
          source: pick(sources),
          values: v,
        });
      }
    }
    n++;
  }
  return out;
}

export default function ProRecordMergeExample() {
  const [records, setRecords] = React.useState(() => makeRecords(10_000));
  const [log, setLog] = React.useState<string[]>([]);

  const onMerge = (result: MergeResult) =>
    new Promise<void>((resolve) =>
      setTimeout(() => {
        setLog((l) =>
          [
            `${result.audit.mergedAt.slice(0, 19)} merged ${result.removedIds.join(", ")} into ${result.survivor.id}`,
            ...l,
          ].slice(0, 5),
        );
        resolve();
      }, 350),
    );

  return (
    <div className="flex flex-col gap-2 bg-crm-bg p-4">
      <ProRecordMerge
        fields={fields}
        records={records}
        onRecordsChange={setRecords}
        titleKey="name"
        listColumns={["company", "lifecycle", "owner"]}
        onMerge={onMerge}
      />
      <ul className="font-crm text-[11px] text-crm-muted-fg">
        {log.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
