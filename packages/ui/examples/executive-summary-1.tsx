import { ExecutiveSummary } from "@/components/crm/executive-summary";

export default function Example() {
  return (
    <ExecutiveSummary
      className="w-[1000px]"
      title="Board update — Q3 FY26"
      periods={["Q4 FY25", "Q1 FY26", "Q2 FY26", "Q3 FY26"]}
      metrics={[
        {
          id: "arr",
          label: "ARR",
          group: "Growth",
          format: "currency",
          series: [4.1e6, 4.6e6, 5.2e6, 5.9e6],
          target: 6.0e6,
          owner: "CRO",
        },
        {
          id: "nrr",
          label: "Net revenue retention",
          group: "Growth",
          format: "percent",
          series: [108, 111, 113, 116],
          target: 115,
          owner: "VP CS",
        },
        {
          id: "logos",
          label: "New logos",
          group: "Growth",
          format: "number",
          series: [41, 38, 52, 47],
          target: 60,
          owner: "CRO",
        },
        {
          id: "gm",
          label: "Gross margin",
          group: "Efficiency",
          format: "percent",
          series: [74, 76, 77, 78.5],
          target: 78,
          owner: "CFO",
        },
        {
          id: "burn",
          label: "Net burn / month",
          group: "Efficiency",
          format: "currency",
          series: [620000, 580000, 540000, 510000],
          target: 450000,
          invert: true,
          owner: "CFO",
        },
        {
          id: "payback",
          label: "CAC payback",
          group: "Efficiency",
          format: "months",
          series: [19, 17.5, 16, 15.2],
          target: 15,
          invert: true,
          owner: "CMO",
        },
        {
          id: "runway",
          label: "Runway",
          group: "Balance sheet",
          format: "months",
          series: [26, 25, 25, 24],
          target: 24,
          owner: "CFO",
        },
      ]}
      notes={[
        {
          kind: "highlight",
          text: "NRR crossed 115% on enterprise expansion; three 7-figure upsells closed.",
        },
        {
          kind: "highlight",
          text: "Gross margin beat plan after moving inference to reserved capacity.",
        },
        {
          kind: "risk",
          text: "New-logo bookings 22% behind plan; mid-market cycle lengthened by 11 days.",
        },
        { kind: "risk", text: "Burn still above target; hiring freeze on G&A through Q4." },
        {
          kind: "ask",
          text: "Intros to two Fortune 500 logistics CIOs for the Q4 enterprise push.",
        },
      ]}
    />
  );
}
