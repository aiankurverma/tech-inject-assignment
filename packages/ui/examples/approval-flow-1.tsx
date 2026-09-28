import * as React from "react";
import { ApprovalFlow, type ApprovalRecord } from "@/components/crm/approval-flow";

const rules = [
  { id: "mgr", role: "Sales Manager", approver: "Dana Ortiz", minDiscountPct: 10, slaHours: 8 },
  {
    id: "vp",
    role: "VP Sales",
    approver: "Leo Park",
    minDiscountPct: 20,
    minAmount: 150000,
    slaHours: 24,
  },
  { id: "cfo", role: "CFO", approver: "Ruth Adeyemi", minDiscountPct: 30, slaHours: 48 },
];

export default function Example() {
  const [records, setRecords] = React.useState<ApprovalRecord[]>([
    {
      ruleId: "mgr",
      decision: "approved",
      comment: "Multi-year commit justifies it.",
      decidedAt: "2026-09-28T09:10:00Z",
    },
  ]);
  return (
    <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2">
      <ApprovalFlow
        currentUser="Leo Park"
        now={new Date("2026-09-28T20:00:00Z")}
        request={{
          dealName: "Globex · 3-year platform renewal",
          amount: 184000,
          discountPct: 22,
          requestedBy: "Maya Chen",
          submittedAt: "2026-09-28T07:30:00Z",
          justification:
            "Competing against a 25% offer from the incumbent; customer commits to 3 years prepaid.",
        }}
        rules={rules}
        records={records}
        onDecision={(ruleId, decision, comment) =>
          setRecords((r) => [
            ...r,
            { ruleId, decision, comment, decidedAt: new Date().toISOString() },
          ])
        }
      />
      <ApprovalFlow
        currentUser="Maya Chen"
        request={{
          dealName: "Initech · Starter seats",
          amount: 12400,
          discountPct: 5,
          requestedBy: "Maya Chen",
          submittedAt: "2026-09-28T07:30:00Z",
        }}
        rules={rules}
        records={[]}
      />
    </div>
  );
}
