import * as React from "react";
import { z } from "zod";
import {
  ProCsvImporter,
  type ImporterField,
  type ImportSummary,
} from "@/components/crm/pro-csv-importer";

const STAGES = ["Lead", "MQL", "SQL", "Opportunity", "Customer", "Churned"] as const;

// Every schema receives the raw (trimmed) cell text and returns the typed value.
const fields: ImporterField[] = [
  {
    key: "firstName",
    label: "First name",
    aliases: ["first", "given name", "fname"],
    required: true,
    example: "Ava",
    schema: z.string().min(1).max(80),
  },
  {
    key: "lastName",
    label: "Last name",
    aliases: ["surname", "family name", "lname"],
    example: "Chen",
    schema: z.string().max(80),
  },
  {
    key: "email",
    label: "Email",
    aliases: ["e-mail address", "email address", "work email", "mail"],
    required: true,
    example: "ava@northlabs.io",
    schema: z
      .string()
      .email("Not a valid email")
      .transform((s) => s.toLowerCase()),
  },
  {
    key: "phone",
    label: "Phone",
    aliases: ["phone #", "mobile", "telephone", "cell"],
    example: "+1 415 555 0142",
    schema: z.string().regex(/^\+?[\d\s().-]{7,20}$/, "Use digits, spaces, + ( ) - only"),
  },
  {
    key: "company",
    label: "Company",
    aliases: ["company name", "organisation", "organization", "account"],
    example: "North Labs",
    schema: z.string().max(120),
  },
  {
    key: "title",
    label: "Job title",
    aliases: ["title", "position", "role"],
    example: "VP Sales",
    schema: z.string().max(120),
  },
  {
    key: "stage",
    label: "Lifecycle stage",
    aliases: ["stage", "status", "lifecycle"],
    example: "SQL",
    schema: z.preprocess(
      (v) => STAGES.find((s) => s.toLowerCase() === String(v).toLowerCase()) ?? v,
      z.enum(STAGES, { message: `One of ${STAGES.join(", ")}` }),
    ),
  },
  {
    key: "dealValue",
    label: "Deal value",
    aliases: ["amount", "deal size", "value", "arr"],
    example: "24000",
    schema: z.preprocess(
      (v) => Number(String(v).replace(/[$,\s]/g, "")),
      z.number({ message: "Must be a number" }).min(0, "Can’t be negative"),
    ),
  },
  {
    key: "createdAt",
    label: "Created",
    aliases: ["created date", "date added", "signup date"],
    example: "2026-03-14",
    schema: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), "Not a date")
      .transform((s) => new Date(s).toISOString()),
  },
];

const FIRST = [
  "Ava",
  "Liam",
  "Noah",
  "Mia",
  "Priya",
  "Diego",
  "Sofia",
  "Kenji",
  "Leah",
  "Omar",
  "Grace",
  "Tom",
  "Mei",
  "Rahul",
  "Zoe",
  "Lucas",
  "Amara",
  "Ivan",
  "Nora",
  "Felix",
];
const LAST = [
  "Chen",
  "Reid",
  "Nair",
  "Alvarez",
  "Rossi",
  "Watanabe",
  "Goldberg",
  "Haddad",
  "Okafor",
  "Becker",
  "Lin",
  "Mehta",
  "Novak",
  "Silva",
  "Dubois",
  "Kowalski",
];
const CO = [
  "North Labs",
  "Bluepeak Health",
  "Ironclad Logistics",
  "Summit Foods",
  "Cedar Robotics",
  "Nova Capital",
  "Atlas Media",
  "Harbor Energy",
  "Vertex Analytics",
  "Lumen Networks",
];
const TITLES = [
  "VP Sales",
  "Head of RevOps",
  "CTO",
  "Office Manager",
  "Procurement Lead",
  "Founder",
  "Account Executive",
  "Director, IT",
];

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A realistic, messy 25k-row export: odd headers, quoted commas, bad emails, duplicates. */
function makeSampleCsv(rows = 25_000): File {
  const rand = mulberry32(7);
  const pick = <T,>(l: readonly T[]) => l[Math.floor(rand() * l.length)]!;
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [
    "First,Surname,E-mail Address,Phone #,Company Name,Position,Status,Deal Size,Date Added,Notes",
  ];
  const emails: string[] = [];
  for (let i = 0; i < rows; i++) {
    const f = pick(FIRST);
    const l = pick(LAST);
    const co = pick(CO);
    let email = `${f}.${l}${i}@${co.toLowerCase().replace(/[^a-z]/g, "")}.com`.toLowerCase();
    if (rand() < 0.03 && emails.length)
      email = pick(emails).toUpperCase(); // duplicate, different case
    else if (rand() < 0.02) email = email.replace("@", " at "); // invalid
    emails.push(email);
    if (i % 97 === 5) alreadyInCrm.add(email.toLowerCase()); // pretend these were imported last month
    const stage = rand() < 0.02 ? "Prospect" : pick(STAGES).toLowerCase();
    const value =
      rand() < 0.015 ? "TBD" : `$${Math.round(rand() * 90_000 + 1000).toLocaleString("en-US")}`;
    const date = new Date(Date.UTC(2025, 0, 1) + Math.floor(rand() * 600) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const note =
      rand() < 0.1 ? `Met at "SaaStr", follow up re: pricing, Q${1 + Math.floor(rand() * 4)}` : "";
    lines.push(
      [
        f,
        l,
        email,
        `+1 ${200 + Math.floor(rand() * 700)} 555 ${String(Math.floor(rand() * 10000)).padStart(4, "0")}`,
        co,
        pick(TITLES),
        stage,
        value,
        date,
        note,
      ]
        .map(q)
        .join(","),
    );
  }
  return new File([lines.join("\r\n")], "hubspot-contacts-export.csv", { type: "text/csv" });
}

// Emails already in the CRM (lower-cased) so the importer can flag them; filled by the generator.
const alreadyInCrm = new Set<string>();

export default function Example() {
  const [initial] = React.useState(() => makeSampleCsv());
  const [last, setLast] = React.useState<ImportSummary | null>(null);
  return (
    <div className="grid w-full max-w-5xl gap-3">
      <ProCsvImporter
        title="Import contacts"
        fields={fields}
        dedupeKeys={["email"]}
        existingKeys={alreadyInCrm}
        initialFile={initial}
        sampleFile={() => makeSampleCsv()}
        onImport={async (records, summary) => {
          await new Promise((r) => setTimeout(r, 400)); // POST /contacts/bulk
          console.info(`Imported ${records.length} contacts`, records.slice(0, 3));
          setLast(summary);
        }}
      />
      {last && (
        <p className="text-xs text-crm-muted-fg">
          Last import: {last.imported.toLocaleString()} contacts from {last.fileName}
        </p>
      )}
    </div>
  );
}
