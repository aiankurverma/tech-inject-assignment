import * as React from "react";
import { TreeNav, type TreeNode } from "@/components/crm/tree-nav";

const nodes: TreeNode[] = [
  {
    id: "sales",
    label: "Sales",
    count: 1284,
    children: [
      {
        id: "sales-na",
        label: "North America",
        count: 812,
        children: [
          { id: "sales-na-ent", label: "Enterprise", count: 96 },
          { id: "sales-na-mm", label: "Mid-market", count: 402 },
          { id: "sales-na-smb", label: "SMB", count: 314 },
        ],
      },
      { id: "sales-emea", label: "EMEA", count: 351, hasChildren: true },
      { id: "sales-apac", label: "APAC", count: 121, hasChildren: true },
    ],
  },
  {
    id: "support",
    label: "Support",
    count: 530,
    children: [
      { id: "support-tier1", label: "Tier 1 queue", count: 388 },
      { id: "support-escalations", label: "Escalations", count: 42 },
      { id: "support-archive", label: "Archive 2023", count: 100, disabled: true },
    ],
  },
  { id: "partners", label: "Partners", count: 64, hasChildren: true },
];

const lazy: Record<string, string[]> = {
  "sales-emea": ["UK & Ireland", "DACH", "Nordics"],
  "sales-apac": ["India", "ANZ", "Japan"],
  partners: ["Resellers", "Referral", "Tech alliances"],
};

// Simulated API: APAC fails on the first attempt so the retry state is visible.
let apacAttempts = 0;
function loadChildren(node: TreeNode): Promise<TreeNode[]> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (node.id === "sales-apac" && apacAttempts++ === 0) {
        reject(new Error("Request timed out"));
        return;
      }
      resolve(
        (lazy[node.id] ?? []).map((label, i) => ({
          id: `${node.id}-${i}`,
          label,
          count: 20 + i * 17,
        })),
      );
    }, 700),
  );
}

export default function Example() {
  const [selected, setSelected] = React.useState<TreeNode | null>(null);
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-4 font-crm sm:flex-row">
      <div className="w-full rounded-xl border border-crm-border bg-crm-sidebar p-2 sm:w-64">
        <TreeNav
          label="Pipelines"
          nodes={nodes}
          searchable
          defaultExpanded={["sales", "sales-na"]}
          defaultSelectedId="sales-na-mm"
          loadChildren={loadChildren}
          onSelect={setSelected}
        />
      </div>
      <div className="flex-1 rounded-xl border border-crm-border bg-crm-card p-4 text-sm text-crm-soft">
        {selected ? (
          <>
            <p className="text-crm-fg">{selected.label}</p>
            <p className="mt-1 text-xs">{(selected.count ?? 0).toLocaleString()} records</p>
          </>
        ) : (
          "Select a folder. Try arrow keys, * to expand siblings, or type to jump."
        )}
      </div>
    </div>
  );
}
