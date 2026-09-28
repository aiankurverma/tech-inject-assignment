import { RepDashboard } from "@/components/crm/rep-dashboard";

export default function Example() {
  return (
    <RepDashboard
      className="w-[1000px]"
      repName="Aisha Khan"
      quota={240000}
      now={new Date("2026-09-28T09:00:00")}
      deals={[
        {
          id: "d1",
          name: "Globex — Enterprise renewal",
          account: "Globex",
          amount: 64000,
          stage: "Won",
          probability: 100,
          closeDate: "2026-08-14",
          status: "won",
          lastActivity: "2026-08-14",
        },
        {
          id: "d2",
          name: "Acme — 120 seats",
          account: "Acme",
          amount: 52000,
          stage: "Won",
          probability: 100,
          closeDate: "2026-09-03",
          status: "won",
          lastActivity: "2026-09-03",
        },
        {
          id: "d3",
          name: "Initech — Growth plan",
          account: "Initech",
          amount: 38000,
          stage: "Negotiation",
          probability: 80,
          closeDate: "2026-10-04",
          status: "open",
          lastActivity: "2026-09-26",
        },
        {
          id: "d4",
          name: "Stark — Analytics add-on",
          account: "Stark",
          amount: 21000,
          stage: "Proposal",
          probability: 60,
          closeDate: "2026-09-25",
          status: "open",
          lastActivity: "2026-09-19",
        },
        {
          id: "d5",
          name: "Umbrella — Pilot",
          account: "Umbrella",
          amount: 15000,
          stage: "Demo",
          probability: 30,
          closeDate: "2026-10-18",
          status: "open",
          lastActivity: "2026-09-02",
        },
        {
          id: "d6",
          name: "Wayne — Global rollout",
          account: "Wayne",
          amount: 145000,
          stage: "Discovery",
          probability: 10,
          closeDate: "2026-12-15",
          status: "open",
          lastActivity: "2026-09-24",
        },
      ]}
      tasks={[
        { id: "k1", title: "Send redlined MSA to Initech legal", due: "2026-09-28" },
        { id: "k2", title: "Follow up on Stark proposal", due: "2026-09-25" },
        { id: "k3", title: "Book exec sponsor call with Wayne", due: "2026-09-30" },
        { id: "k4", title: "Log Acme onboarding handoff", due: "2026-09-22", done: true },
        { id: "k5", title: "Re-engage Umbrella champion", due: "2026-09-29" },
      ]}
    />
  );
}
