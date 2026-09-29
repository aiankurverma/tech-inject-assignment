import * as React from "react";
import {
  ProApprovalWorkflow,
  type DirectoryPerson,
  type Workflow,
  type WorkflowField,
} from "@/components/crm/pro-approval-workflow";

const fields: WorkflowField[] = [
  { name: "amount", label: "Deal amount (USD)", inputType: "number", sample: 184000 },
  { name: "discountPct", label: "Discount %", inputType: "number", sample: 27 },
  { name: "termMonths", label: "Term (months)", inputType: "number", sample: 36 },
  {
    name: "region",
    label: "Region",
    valueEditorType: "select",
    values: [
      { name: "NA", label: "North America" },
      { name: "EMEA", label: "EMEA" },
      { name: "APAC", label: "APAC" },
    ],
    sample: "EMEA",
  },
  {
    name: "paymentTerms",
    label: "Payment terms",
    valueEditorType: "select",
    values: [
      { name: "net30", label: "Net 30" },
      { name: "net60", label: "Net 60" },
      { name: "net90", label: "Net 90" },
    ],
    sample: "net60",
  },
  { name: "nonStandardClauses", label: "Non-standard clauses", inputType: "number", sample: 1 },
];

const first = ["Ava", "Liam", "Maya", "Noah", "Priya", "Omar", "Sofia", "Ethan", "Zara", "Kenji"];
const last = ["Chen", "Okafor", "Silva", "Novak", "Haddad", "Ivanova", "Moreau", "Tanaka"];
const directory: DirectoryPerson[] = [
  { id: "ceo", name: "Ruth Adeyemi", title: "CEO", roles: ["Executive"] },
  {
    id: "cfo",
    name: "Marcus Lind",
    title: "CFO",
    roles: ["Finance", "Executive"],
    managerId: "ceo",
  },
  {
    id: "cro",
    name: "Leo Park",
    title: "Chief Revenue Officer",
    roles: ["Executive", "Sales Leadership"],
    managerId: "ceo",
  },
  { id: "gc", name: "Hannah Weiss", title: "General Counsel", roles: ["Legal"], managerId: "ceo" },
  {
    id: "fin1",
    name: "Tomás Reyes",
    title: "Deal Desk Lead",
    roles: ["Deal Desk", "Finance"],
    managerId: "cfo",
  },
  {
    id: "fin2",
    name: "Aisha Bello",
    title: "Revenue Accountant",
    roles: ["Finance"],
    managerId: "cfo",
  },
  { id: "leg1", name: "Grace Kim", title: "Commercial Counsel", roles: ["Legal"], managerId: "gc" },
  {
    id: "vp-na",
    name: "Dana Ortiz",
    title: "VP Sales, NA",
    roles: ["Sales Leadership"],
    managerId: "cro",
  },
  {
    id: "vp-emea",
    name: "Jonas Berg",
    title: "VP Sales, EMEA",
    roles: ["Sales Leadership"],
    managerId: "cro",
  },
  {
    id: "vp-apac",
    name: "Mei Watanabe",
    title: "VP Sales, APAC",
    roles: ["Sales Leadership"],
    managerId: "cro",
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `mgr${i}`,
    name: `${first[(i * 3) % 10]} ${last[i % 8]}`,
    title: "Sales Manager",
    roles: ["Sales Manager"],
    managerId: ["vp-na", "vp-emea", "vp-apac"][i % 3],
  })),
  ...Array.from({ length: 30 }, (_, i) => ({
    id: `ae${i}`,
    name: `${first[i % 10]} ${last[(i * 5) % 8]}`,
    title: "Account Executive",
    roles: ["Account Executive"],
    managerId: `mgr${i % 6}`,
  })),
];

const initial: Workflow = {
  id: "wf_discount_2026",
  name: "Enterprise discount approval",
  version: 7,
  requestType: "discount",
  steps: [
    {
      id: "c_small",
      kind: "condition",
      label: "Standard discount?",
      rule: {
        combinator: "and",
        rules: [
          { field: "discountPct", operator: "<=", value: 10 },
          { field: "nonStandardClauses", operator: "=", value: 0 },
        ],
      },
      then: [{ id: "o_auto", kind: "outcome", label: "Auto-approve", outcome: "approve" }],
      else: [
        {
          id: "a_mgr",
          kind: "approver",
          label: "Sales manager",
          approvers: [{ type: "manager", levels: 1 }],
          mode: "any",
          slaHours: 8,
        },
        {
          id: "p_review",
          kind: "parallel",
          label: "Commercial review",
          join: "all",
          branches: [
            {
              id: "br_fin",
              label: "Finance",
              steps: [
                {
                  id: "c_terms",
                  kind: "condition",
                  label: "Extended payment terms?",
                  rule: {
                    combinator: "or",
                    rules: [{ field: "paymentTerms", operator: "in", value: "net60,net90" }],
                  },
                  then: [
                    {
                      id: "a_desk",
                      kind: "approver",
                      label: "Deal desk",
                      approvers: [{ type: "role", role: "Deal Desk" }],
                      mode: "any",
                      slaHours: 12,
                    },
                  ],
                  else: [],
                },
              ],
            },
            {
              id: "br_legal",
              label: "Legal",
              steps: [
                {
                  id: "c_clauses",
                  kind: "condition",
                  label: "Redlined contract?",
                  rule: {
                    combinator: "and",
                    rules: [{ field: "nonStandardClauses", operator: ">", value: 0 }],
                  },
                  then: [
                    {
                      id: "a_legal",
                      kind: "approver",
                      label: "Commercial counsel",
                      approvers: [{ type: "role", role: "Legal" }],
                      mode: "any",
                      slaHours: 24,
                    },
                  ],
                  else: [],
                },
              ],
            },
          ],
        },
        {
          id: "c_big",
          kind: "condition",
          label: "Strategic exception?",
          rule: {
            combinator: "or",
            rules: [
              { field: "discountPct", operator: ">", value: 25 },
              { field: "amount", operator: ">=", value: 250000 },
            ],
          },
          then: [
            {
              id: "a_exec",
              kind: "approver",
              label: "CRO + CFO sign-off",
              approvers: [
                { type: "user", userId: "cro" },
                { type: "user", userId: "cfo" },
              ],
              mode: "all",
              slaHours: 48,
            },
            {
              id: "c_cap",
              kind: "condition",
              label: "Above hard cap?",
              rule: {
                combinator: "and",
                rules: [{ field: "discountPct", operator: ">", value: 45 }],
              },
              then: [
                { id: "o_reject", kind: "outcome", label: "Reject: over cap", outcome: "reject" },
              ],
              else: [],
            },
          ],
          else: [],
        },
      ],
    },
  ],
};

export default function Example() {
  const [wf, setWf] = React.useState(initial);
  return (
    <div className="w-full max-w-[1200px] p-2">
      <ProApprovalWorkflow
        value={wf}
        onChange={setWf}
        fields={fields}
        directory={directory}
        defaultSample={{
          requesterId: "ae7",
          amount: 184000,
          discountPct: 27,
          termMonths: 36,
          region: "EMEA",
          paymentTerms: "net60",
          nonStandardClauses: 1,
        }}
        onPublish={async () => {
          await new Promise((r) => setTimeout(r, 600));
        }}
        height={680}
      />
    </div>
  );
}
