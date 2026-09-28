import { CustomerPortal } from "@/components/crm/customer-portal";

export default function Example() {
  return (
    <div className="w-full max-w-3xl">
      <CustomerPortal
        now={new Date("2026-09-28T10:00:00Z")}
        account={{
          name: "Northwind Freight",
          plan: "Pro annual",
          renewsAt: "2027-01-15",
          seats: 42,
        }}
        usage={[
          { label: "Seats", used: 39, limit: 42 },
          { label: "Emails sent this month", used: 91_300, limit: 100_000 },
          { label: "File storage", used: 38, limit: 100, unit: "GB" },
        ]}
        invoices={[
          {
            id: "i6",
            number: "INV-2026-0931",
            issuedAt: "2026-09-15",
            dueAt: "2026-10-15",
            amount: 1_260_000,
            status: "open",
          },
          {
            id: "i5",
            number: "INV-2026-0874",
            issuedAt: "2026-08-15",
            dueAt: "2026-09-14",
            amount: 84_000,
            status: "open",
          },
          {
            id: "i4",
            number: "INV-2026-0812",
            issuedAt: "2026-07-15",
            dueAt: "2026-08-14",
            amount: 42_000,
            status: "paid",
          },
          {
            id: "i3",
            number: "INV-2026-0760",
            issuedAt: "2026-06-15",
            dueAt: "2026-07-15",
            amount: 42_000,
            status: "void",
          },
          {
            id: "i2",
            number: "INV-2026-0705",
            issuedAt: "2026-05-15",
            dueAt: "2026-06-14",
            amount: 38_500,
            status: "paid",
          },
        ]}
        tickets={[
          {
            id: "t1",
            subject: "Outlook sync missing emails since Monday",
            status: "open",
            priority: "urgent",
            createdAt: "2026-09-28T08:20:00Z",
            slaDueAt: "2026-09-28T09:20:00Z",
          },
          {
            id: "t2",
            subject: "Need SAML metadata re-uploaded",
            status: "pending",
            priority: "high",
            createdAt: "2026-09-27T16:00:00Z",
            slaDueAt: "2026-09-28T10:40:00Z",
          },
          {
            id: "t3",
            subject: "Question about seat proration",
            status: "open",
            priority: "normal",
            createdAt: "2026-09-28T09:10:00Z",
            slaDueAt: "2026-09-29T09:10:00Z",
          },
          {
            id: "t4",
            subject: "Export all deals to CSV",
            status: "solved",
            priority: "low",
            createdAt: "2026-09-10T12:00:00Z",
          },
        ]}
        onPay={(ids, total) => console.log("pay", ids, total)}
        onDownload={(id) => console.log("download", id)}
        onNewTicket={() => console.log("new ticket")}
        onOpenTicket={(id) => console.log("open", id)}
      />
    </div>
  );
}
