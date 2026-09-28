import { MeetingNotes } from "@/components/crm/meeting-notes";

export default function Example() {
  return (
    <div className="w-full max-w-[960px]">
      <MeetingNotes
        title="Northwind — Renewal & expansion review"
        related="Northwind Traders · Enterprise renewal ($530k)"
        startedAt={new Date(Date.now() - 17 * 60_000).toISOString()}
        onFinish={(v) => console.log("log meeting", v)}
        defaultValue={{
          attendees: [
            { id: "a1", name: "Maya Chen", side: "internal", role: "AE", attended: true },
            { id: "a2", name: "Leo Park", side: "internal", role: "SE", attended: true },
            {
              id: "a3",
              name: "Dana Whitfield",
              side: "external",
              role: "VP Sales Ops",
              attended: true,
            },
            {
              id: "a4",
              name: "Rahul Iyer",
              side: "external",
              role: "Procurement",
              attended: false,
            },
          ],
          agenda: [
            { id: "g1", title: "Usage review — last 2 quarters", minutes: 10, covered: true },
            { id: "g2", title: "Expansion: support team (40 seats)", minutes: 15 },
            { id: "g3", title: "Security & DPA update", minutes: 10 },
            { id: "g4", title: "Timeline & next steps", minutes: 10 },
          ],
          notes:
            "Adoption up 34% QoQ; forecasting module is the stickiest.\nDana wants the support team on the same platform before the January budget freeze.\nConcern: dialer pricing vs. current vendor.",
          decisions: ["Renewal term moves to 2 years with a 5% annual uplift cap"],
          actions: [
            {
              id: "x1",
              text: "Send revised quote with 2-year term",
              ownerId: "a1",
              due: "2026-09-30",
            },
            {
              id: "x2",
              text: "Share SOC 2 Type II report",
              ownerId: "a2",
              due: "2026-09-29",
              done: true,
            },
            { id: "x3", text: "Intro to procurement for PO timing", ownerId: "a3" },
          ],
        }}
      />
    </div>
  );
}
