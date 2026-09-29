import { useMemo, useState } from "react";
import { Briefcase, ExternalLink } from "lucide-react";
import { ProRecordPage, formatMoney, type RecordFieldDef } from "@/components/crm/pro-record-page";
import { ProActivityTimeline, type TimelineActivity } from "@/components/crm/pro-activity-timeline";

interface Opportunity {
  id: string;
  name: string;
  account: string;
  stage: string;
  amount: number | null;
  probability: number | null;
  closeDate: string | null;
  owner: string;
  forecast: string;
  contactPhone: string;
  contactEmail: string;
  nextStep: string;
  description: string;
  createdAt: string;
}

const STAGES = [
  { value: "discovery", label: "Discovery", tone: "bg-crm-muted text-crm-soft" },
  { value: "qualified", label: "Qualified", tone: "bg-sky-400/15 text-sky-300" },
  { value: "proposal", label: "Proposal", tone: "bg-violet-400/15 text-violet-300" },
  { value: "negotiation", label: "Negotiation", tone: "bg-crm-warning/15 text-crm-warning" },
  { value: "won", label: "Closed won", tone: "bg-crm-success/15 text-crm-success" },
  { value: "lost", label: "Closed lost", tone: "bg-crm-danger/15 text-crm-danger" },
];

const FIELDS: RecordFieldDef<Opportunity>[] = [
  {
    name: "name",
    label: "Opportunity name",
    type: "text",
    required: true,
    section: "Overview",
    wide: true,
  },
  { name: "account", label: "Account", type: "text", readOnly: true, section: "Overview" },
  {
    name: "owner",
    label: "Owner",
    type: "picklist",
    required: true,
    section: "Overview",
    options: ["Maya Chen", "Leo Park", "Sam Ortiz", "Priya Nair"].map((n) => ({
      value: n,
      label: n,
    })),
  },
  {
    name: "stage",
    label: "Stage",
    type: "picklist",
    required: true,
    section: "Pipeline",
    options: STAGES,
  },
  {
    name: "amount",
    label: "Amount",
    type: "money",
    currency: "USD",
    required: true,
    min: 0,
    section: "Pipeline",
    help: "Deals above $5M need deal-desk approval (try it to see the rollback).",
  },
  {
    name: "probability",
    label: "Probability (%)",
    type: "number",
    min: 0,
    max: 100,
    section: "Pipeline",
  },
  { name: "closeDate", label: "Close date", type: "date", required: true, section: "Pipeline" },
  {
    name: "forecast",
    label: "Forecast category",
    type: "picklist",
    section: "Pipeline",
    options: [
      { value: "pipeline", label: "Pipeline" },
      { value: "best", label: "Best case" },
      { value: "commit", label: "Commit" },
      { value: "omitted", label: "Omitted" },
    ],
  },
  {
    name: "contactPhone",
    label: "Primary contact phone",
    type: "phone",
    defaultCountry: "US",
    section: "Contact",
  },
  { name: "contactEmail", label: "Primary contact email", type: "email", section: "Contact" },
  { name: "nextStep", label: "Next step", type: "text", section: "Details", wide: true },
  { name: "description", label: "Description", type: "textarea", section: "Details", wide: true },
];

const INITIAL: Opportunity = {
  id: "006Q000001",
  name: "Northwind — Platform renewal FY27",
  account: "Northwind Traders",
  stage: "negotiation",
  amount: 486_000,
  probability: 70,
  closeDate: "2026-11-28",
  owner: "Maya Chen",
  forecast: "commit",
  contactPhone: "+14155550132",
  contactEmail: "rachel.green@northwind.io",
  nextStep: "Send MSA redlines to legal by Friday",
  description:
    "3-year renewal with EMEA seat expansion (+140 seats). Procurement asked for a 30-day out clause; countering with 60-day notice.",
  createdAt: "2026-04-02",
};

const CONTACTS = [
  ["Rachel Green", "VP Operations", "Champion", "rachel.green@northwind.io"],
  ["Tom Alvarez", "COO", "Economic buyer", "tom.alvarez@northwind.io"],
  ["Aiko Tanaka", "IT Security Lead", "Technical evaluator", "aiko@northwind.io"],
  ["Ben Okafor", "Finance Manager", "Influencer", "ben.okafor@northwind.io"],
  ["Lena Fischer", "Procurement", "Gatekeeper", "lena.fischer@northwind.io"],
];

const PRODUCTS = [
  "Platform seats",
  "SSO add-on",
  "Premium support",
  "Sandbox env",
  "Data residency (EU)",
];

function makeActivity(now: number): TimelineActivity[] {
  const out: TimelineActivity[] = [];
  const kinds = ["email", "call", "note", "meeting", "stage"] as const;
  for (let i = 0; i < 1500; i++) {
    const type = kinds[(i * 7) % kinds.length]!;
    const at = now - i * 5.3 * 3_600_000 - 25 * 60_000;
    const actor = { name: ["Maya Chen", "Leo Park", "Rachel Green"][i % 3]! };
    if (type === "email")
      out.push({
        id: `a${i}`,
        type,
        at,
        actor,
        title: "emailed · Renewal pricing for FY27",
        body: "Hi Rachel,\n\nAttached is the revised 3-year proposal. Year-two pricing is held flat; year three has a 6% uplift, below list.\n\nBest,\nMaya",
        email: {
          direction: "outbound",
          from: "maya@kitbase.dev",
          to: ["rachel.green@northwind.io"],
        },
      });
    else if (type === "call")
      out.push({
        id: `a${i}`,
        type,
        at,
        actor,
        title: "called Tom Alvarez",
        call: { outcome: i % 2 ? "connected" : "voicemail", durationSec: 1260 },
      });
    else if (type === "note")
      out.push({
        id: `a${i}`,
        type,
        at,
        actor,
        title: "added a note",
        body: "Legal wants a 60-day notice instead of the 30-day out clause.",
      });
    else if (type === "meeting")
      out.push({
        id: `a${i}`,
        type,
        at,
        actor,
        title: "held Pricing workshop",
        meeting: { attendees: 5, location: "Zoom" },
      });
    else
      out.push({
        id: `a${i}`,
        type,
        at,
        actor,
        title: "moved the deal",
        stage: { from: "Proposal", to: "Negotiation" },
      });
  }
  return out;
}

export default function ProRecordPageExample() {
  const [now] = useState(() => Date.now());
  const activity = useMemo(() => makeActivity(now), [now]);
  const lineItems = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: `li-${i}`,
        product: `${PRODUCTS[i % PRODUCTS.length]} (${["US", "EMEA", "APAC"][i % 3]})`,
        qty: 10 + ((i * 37) % 180),
        price: [96, 18, 24, 12, 8][i % 5]! * 12,
      })),
    [],
  );

  return (
    <div className="p-4">
      <ProRecordPage<Opportunity>
        queryKey={["opportunity", INITIAL.id]}
        record={INITIAL}
        objectLabel="Opportunity"
        icon={<Briefcase className="size-5" />}
        titleField="name"
        headerFields={["account", "stage", "amount", "closeDate", "owner"]}
        fields={FIELDS}
        onSave={async (patch, next) => {
          await new Promise((r) => setTimeout(r, 700));
          if ((next.amount ?? 0) > 5_000_000)
            throw new Error("Deal desk approval required above $5,000,000");
          return next;
        }}
        actions={
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-crm border border-crm-border px-3 text-sm text-crm-soft hover:bg-crm-raised"
          >
            <ExternalLink className="size-3.5" /> Open quote
          </button>
        }
        related={[
          {
            id: "contacts",
            label: "Contact roles",
            count: CONTACTS.length,
            content: (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-crm-muted-fg">
                  <tr className="border-b border-crm-border">
                    <th className="px-5 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Title</th>
                    <th className="px-2 py-2 font-medium">Role</th>
                    <th className="px-5 py-2 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTACTS.map(([n, t, r, e]) => (
                    <tr key={e} className="border-b border-crm-border/60 hover:bg-crm-raised/50">
                      <td className="px-5 py-2.5 text-crm-fg">{n}</td>
                      <td className="px-2 py-2.5 text-crm-soft">{t}</td>
                      <td className="px-2 py-2.5">
                        <span className="rounded-full bg-crm-muted px-2 py-0.5 text-xs text-crm-soft">
                          {r}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-crm-muted-fg">{e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ),
          },
          {
            id: "products",
            label: "Products",
            count: lineItems.length,
            content: (
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-crm-card text-left text-xs text-crm-muted-fg">
                    <tr className="border-b border-crm-border">
                      <th className="px-5 py-2 font-medium">Product</th>
                      <th className="px-2 py-2 text-right font-medium">Qty</th>
                      <th className="px-2 py-2 text-right font-medium">Unit / yr</th>
                      <th className="px-5 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {lineItems.map((l) => (
                      <tr key={l.id} className="border-b border-crm-border/60">
                        <td className="px-5 py-2 text-crm-fg">{l.product}</td>
                        <td className="px-2 py-2 text-right text-crm-soft">{l.qty}</td>
                        <td className="px-2 py-2 text-right text-crm-soft">
                          {formatMoney(l.price)}
                        </td>
                        <td className="px-5 py-2 text-right text-crm-fg">
                          {formatMoney(l.qty * l.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          },
        ]}
        activity={
          <ProActivityTimeline
            queryKey={["opportunity", INITIAL.id, "activity"]}
            items={activity}
            height={560}
            label="Opportunity activity"
          />
        }
      />
    </div>
  );
}
