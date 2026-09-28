import { Link } from "@/components/crm/link";

const fields = [
  { label: "Website", node: <Link href="https://www.northwind-traders.com/" /> },
  { label: "Email", node: <Link href="mailto:priya.shah@northwind-traders.com" variant="muted" /> },
  { label: "Phone", node: <Link href="tel:+14155550142">+1 (415) 555-0142</Link> },
  {
    label: "Contract",
    node: (
      <Link
        href="https://docs.northwind-traders.com/legal/msa/2026/northwind-master-services-agreement-v4-signed.pdf"
        maxWidth="180px"
      />
    ),
  },
  { label: "Owner", node: <Link href="/team/marcus-lee">Marcus Lee</Link> },
  {
    label: "Parent",
    node: (
      <Link href="/accounts/acme" disabled>
        Acme Holdings (locked)
      </Link>
    ),
  },
];

export default function Example() {
  return (
    <div className="w-[380px] rounded-crm border border-crm-border bg-crm-card p-4 font-crm">
      <p className="mb-3 crm-eyebrow text-crm-subtle">Account details</p>
      <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2.5 text-sm">
        {fields.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-crm-subtle">{f.label}</dt>
            <dd className="min-w-0">{f.node}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-crm-soft">
        Renewal terms are in the{" "}
        <Link href="https://help.example.com/renewals" variant="inherit" underline="always">
          renewal playbook
        </Link>
        .
      </p>
    </div>
  );
}
