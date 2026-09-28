import { SettingsPipelines, type Pipeline } from "@/components/crm/settings-pipelines";

const pipelines: Pipeline[] = [
  {
    id: "new-biz",
    name: "New business",
    stages: [
      {
        id: "s1",
        name: "Qualified",
        probability: 10,
        rotDays: 14,
        dealCount: 42,
        dealValue: 386_000,
      },
      {
        id: "s2",
        name: "Discovery",
        probability: 25,
        rotDays: 14,
        dealCount: 28,
        dealValue: 512_500,
      },
      { id: "s3", name: "Demo", probability: 40, rotDays: 10, dealCount: 17, dealValue: 402_000 },
      { id: "s4", name: "Proposal", probability: 60, rotDays: 7, dealCount: 9, dealValue: 288_750 },
      {
        id: "s5",
        name: "Negotiation",
        probability: 80,
        rotDays: 5,
        dealCount: 5,
        dealValue: 196_000,
      },
      {
        id: "won",
        name: "Closed won",
        probability: 100,
        rotDays: 0,
        dealCount: 0,
        dealValue: 0,
        kind: "won",
      },
      {
        id: "lost",
        name: "Closed lost",
        probability: 0,
        rotDays: 0,
        dealCount: 0,
        dealValue: 0,
        kind: "lost",
      },
    ],
  },
  {
    id: "renewals",
    name: "Renewals",
    stages: [
      {
        id: "r1",
        name: "Upcoming (90d)",
        probability: 70,
        rotDays: 30,
        dealCount: 31,
        dealValue: 640_000,
      },
      {
        id: "r2",
        name: "In review",
        probability: 80,
        rotDays: 14,
        dealCount: 12,
        dealValue: 210_000,
      },
      {
        id: "r3",
        name: "Contract sent",
        probability: 90,
        rotDays: 7,
        dealCount: 6,
        dealValue: 118_000,
      },
      {
        id: "rw",
        name: "Renewed",
        probability: 100,
        rotDays: 0,
        dealCount: 0,
        dealValue: 0,
        kind: "won",
      },
      {
        id: "rl",
        name: "Churned",
        probability: 0,
        rotDays: 0,
        dealCount: 0,
        dealValue: 0,
        kind: "lost",
      },
    ],
  },
];

export default function Example() {
  return (
    <SettingsPipelines
      className="max-w-5xl"
      defaultPipelines={pipelines}
      onSave={() => new Promise((r) => setTimeout(r, 700))}
    />
  );
}
