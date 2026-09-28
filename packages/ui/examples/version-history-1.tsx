import * as React from "react";
import { VersionHistory, type RecordVersion } from "@/components/crm/version-history";

const h = (n: number) => new Date(Date.now() - n * 3_600_000);

const initial: RecordVersion[] = [
  {
    id: "v1",
    number: 1,
    at: h(72),
    author: { name: "Alex Santos" },
    label: "Created from lead",
    snapshot: {
      name: "Acme Q4 renewal",
      amount: "$72,000",
      stage: "Discovery",
      owner: "Alex Santos",
      seats: 120,
    },
  },
  {
    id: "v2",
    number: 2,
    at: h(50),
    author: { name: "Priya Nair" },
    snapshot: {
      name: "Acme Q4 renewal",
      amount: "$72,000",
      stage: "Proposal",
      owner: "Priya Nair",
      seats: 120,
    },
  },
  {
    id: "v3",
    number: 3,
    at: h(26),
    author: { name: "Priya Nair" },
    label: "Sent to legal",
    snapshot: {
      name: "Acme Q4 renewal",
      amount: "$86,400",
      stage: "Negotiation",
      owner: "Priya Nair",
      seats: 144,
      discount: "10%",
    },
  },
  {
    id: "v4",
    number: 4,
    at: h(1),
    author: { name: "Lena Park" },
    snapshot: {
      name: "Acme Corp · Q4 renewal",
      amount: "$86,400",
      stage: "Negotiation",
      owner: "Priya Nair",
      seats: 144,
      discount: "12%",
    },
  },
];

export default function Example() {
  const [versions, setVersions] = React.useState(initial);
  return (
    <VersionHistory
      versions={versions}
      fieldLabels={{
        name: "Deal name",
        amount: "Amount",
        stage: "Stage",
        owner: "Owner",
        seats: "Seats",
        discount: "Discount",
      }}
      onRestore={async (v) => {
        await new Promise((r) => setTimeout(r, 500));
        setVersions((vs) => [
          ...vs,
          {
            ...v,
            id: `v${vs.length + 1}`,
            number: vs.length + 1,
            at: new Date(),
            author: { name: "Alex Santos" },
            label: `Restored v${v.number}`,
          },
        ]);
      }}
    />
  );
}
