import { Hero } from "@/components/crm/hero";
import { KpiGrid } from "@/components/crm/kpi-grid";

export default function Example() {
  return (
    <Hero
      align="split"
      announcement={{ badge: "New", label: "AI call summaries are live", href: "#changelog" }}
      headline="The CRM your sales team will actually update"
      subheadline="Emails, calls and meetings log themselves. Reps spend time selling, managers get a forecast they can trust."
      onStartTrial={async (email) => {
        await new Promise((r) => setTimeout(r, 900));
        if (email.endsWith("@example.com"))
          throw new Error("This domain already has a workspace. Ask your admin for an invite.");
      }}
      secondaryCta={{ label: "Book a 20-min demo", href: "#demo" }}
      assurances={["14-day trial", "No credit card", "Import from HubSpot in 5 min"]}
      socialProof={{
        people: [
          { name: "Aisha Khan" },
          { name: "Marco Rossi" },
          { name: "Lena Fischer" },
          { name: "Tom Becker" },
          { name: "Yuki Sato" },
          { name: "Rahul Mehta" },
        ],
        rating: 4.8,
        reviews: 1240,
        label: "Loved by 3,000+ revenue teams",
      }}
      media={
        <KpiGrid
          columns={2}
          items={[
            { label: "Pipeline", value: "$1.42M", delta: 12.4, trend: [8, 9, 11, 10, 12, 14] },
            { label: "Win rate", value: "31%", delta: 4.1, trend: [26, 27, 29, 28, 30, 31] },
            { label: "Avg. cycle", value: "23 days", delta: -8.2, invert: true },
            { label: "Quota attained", value: "86%", delta: 6 },
          ]}
        />
      }
    />
  );
}
