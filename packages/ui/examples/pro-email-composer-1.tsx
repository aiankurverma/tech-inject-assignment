import * as React from "react";
import {
  ProEmailComposer,
  type EmailDraft,
  type EmailSnippet,
  type MergeFieldDef,
  type SampleRecord,
} from "@/components/crm/pro-email-composer";

const fields: MergeFieldDef[] = [
  { key: "contact.firstName", label: "First name", group: "Contact", fallback: "there" },
  { key: "contact.lastName", label: "Last name", group: "Contact" },
  { key: "contact.title", label: "Job title", group: "Contact" },
  { key: "contact.email", label: "Email", group: "Contact" },
  { key: "company.name", label: "Company", group: "Company", fallback: "your team" },
  { key: "company.industry", label: "Industry", group: "Company" },
  { key: "company.employees", label: "Employees", group: "Company" },
  { key: "company.city", label: "City", group: "Company" },
  { key: "deal.name", label: "Deal name", group: "Deal" },
  { key: "deal.amount", label: "Deal amount", group: "Deal" },
  { key: "deal.stage", label: "Deal stage", group: "Deal" },
  { key: "deal.nextStep", label: "Next step", group: "Deal" },
  { key: "sender.firstName", label: "My first name", group: "Sender" },
  { key: "sender.calendarLink", label: "My booking link", group: "Sender" },
  { key: "sender.title", label: "My title", group: "Sender" },
];

const chip = (key: string, label: string, fallback?: string) =>
  `<span data-type="mergeField" data-id="${key}" data-label="${label}"${fallback ? ` data-fallback="${fallback}"` : ""}></span>`;

const snippets: EmailSnippet[] = [
  {
    id: "book",
    title: "Book a call",
    description: "CTA with your booking link",
    content: `<p>Would a 20-minute call next week work? You can grab a slot here: ${chip("sender.calendarLink", "My booking link")}</p>`,
  },
  {
    id: "case-study",
    title: "Case study: Northwind",
    description: "Social proof for mid-market logistics",
    content:
      "<p>Northwind Logistics cut their quote-to-cash cycle from 19 days to 6 after rolling this out across 140 reps. Happy to share the full write-up.</p>",
  },
  {
    id: "security",
    title: "Security & compliance",
    description: "SOC 2 Type II, SSO, data residency",
    content:
      "<ul><li>SOC 2 Type II and ISO 27001 certified</li><li>SAML SSO and SCIM provisioning on every plan</li><li>EU and US data residency</li></ul>",
  },
  {
    id: "breakup",
    title: "Break-up close",
    description: "Polite last touch in a sequence",
    content: `<p>I haven't heard back, so I'll assume the timing isn't right for ${chip("company.name", "Company", "your team")}. If that changes, just reply to this thread.</p>`,
  },
  {
    id: "signature",
    title: "Signature",
    content: `<p>Best,<br>${chip("sender.firstName", "My first name")}<br>${chip("sender.title", "My title")}, Kitbase</p>`,
  },
];

const sender = {
  firstName: "Maya",
  title: "Account Executive",
  calendarLink: "https://cal.kitbase.dev/maya",
};

const sampleRecords: SampleRecord[] = [
  {
    id: "c_1042",
    label: "Priya Raman · Helix Freight",
    data: {
      contact: {
        firstName: "Priya",
        lastName: "Raman",
        title: "VP Revenue Operations",
        email: "priya@helixfreight.com",
      },
      company: { name: "Helix Freight", industry: "Logistics", employees: 1200, city: "Chicago" },
      deal: {
        name: "Helix Freight — Platform",
        amount: "$84,000",
        stage: "Proposal",
        nextStep: "Security review",
      },
      sender,
    },
  },
  {
    id: "c_2210",
    label: "Tomás Ortega · Brightline Health",
    data: {
      contact: {
        firstName: "Tomás",
        lastName: "Ortega",
        title: "Head of Sales",
        email: "tomas@brightline.health",
      },
      company: {
        name: "Brightline Health",
        industry: "Healthcare",
        employees: 430,
        city: "Austin",
      },
      deal: { name: "Brightline — Expansion", amount: "$36,500", stage: "Discovery" },
      sender,
    },
  },
  {
    id: "c_3307",
    label: "(no first name) · Oakridge Capital",
    data: {
      contact: { firstName: "", lastName: "Chen", email: "ops@oakridgecap.com" },
      company: { name: "Oakridge Capital", industry: "Financial services", city: "New York" },
      deal: { name: "Oakridge — Pilot", stage: "Qualification" },
      sender,
    },
  },
];

const body = `
<p>Hi ${chip("contact.firstName", "First name", "there")},</p>
<p>Congrats on the growth at ${chip("company.name", "Company", "your team")}. Teams in ${chip("company.industry", "Industry")} usually hit a wall with manual forecasting around the time they pass 400 people, and I noticed you're hiring for RevOps.</p>
<p>Following up on ${chip("deal.name", "Deal name")}: the next step on our side is ${chip("deal.nextStep", "Next step")}.</p>
<p>Best,<br>${chip("sender.firstName", "My first name")}</p>`;

export default function Example() {
  const [log, setLog] = React.useState<string | null>(null);

  const send = async (draft: EmailDraft) => {
    await new Promise((r) => setTimeout(r, 900));
    setLog(
      draft.schedule
        ? `Scheduled for ${draft.schedule.sendAt.toISOString()} (${draft.schedule.timeZone}) to ${draft.to.length} recipient(s)`
        : `Sent to ${draft.to.join(", ")} with ${draft.attachments.length} attachment(s)`,
    );
  };

  return (
    <div className="flex w-full max-w-3xl flex-col gap-3">
      <ProEmailComposer
        from="Maya Lindqvist <maya@kitbase.dev>"
        defaultTo={["priya@helixfreight.com"]}
        defaultSubject="{{company.name|Your team}} + Kitbase: forecasting without spreadsheets"
        defaultContent={body}
        fields={fields}
        snippets={snippets}
        sampleRecords={sampleRecords}
        defaultTimeZone="America/Chicago"
        onSend={send}
      />
      {log && <p className="text-xs text-crm-muted-fg">{log}</p>}
    </div>
  );
}
