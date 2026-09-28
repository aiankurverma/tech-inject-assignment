import { FunnelReport } from "@/components/crm/funnel-report";

const stages = [
  {
    id: "visit",
    label: "Website visits",
    counts: { SMB: 18_400, "Mid-market": 6_200, Enterprise: 1_900 },
    previous: { SMB: 16_900, "Mid-market": 5_800, Enterprise: 1_700 },
    medianDays: 0,
  },
  {
    id: "lead",
    label: "Leads",
    counts: { SMB: 1_420, "Mid-market": 610, Enterprise: 240 },
    previous: { SMB: 1_380, "Mid-market": 520, Enterprise: 215 },
    medianDays: 3,
  },
  {
    id: "mql",
    label: "MQL",
    counts: { SMB: 610, "Mid-market": 330, Enterprise: 150 },
    previous: { SMB: 640, "Mid-market": 270, Enterprise: 131 },
    medianDays: 6,
  },
  {
    id: "sql",
    label: "SQL",
    counts: { SMB: 220, "Mid-market": 160, Enterprise: 88 },
    previous: { SMB: 240, "Mid-market": 131, Enterprise: 70 },
    medianDays: 9,
    avgValue: 18_500,
  },
  {
    id: "opp",
    label: "Opportunity",
    counts: { SMB: 118, "Mid-market": 97, Enterprise: 61 },
    previous: { SMB: 121, "Mid-market": 80, Enterprise: 47 },
    medianDays: 21,
    avgValue: 32_000,
  },
  {
    id: "won",
    label: "Closed won",
    counts: { SMB: 41, "Mid-market": 29, Enterprise: 17 },
    previous: { SMB: 44, "Mid-market": 22, Enterprise: 12 },
    medianDays: 34,
    avgValue: 41_800,
  },
];

export default function Example() {
  return (
    <FunnelReport
      className="w-full max-w-[860px]"
      title="Q3 inbound funnel"
      stages={stages}
      segments={["SMB", "Mid-market", "Enterprise"]}
    />
  );
}
