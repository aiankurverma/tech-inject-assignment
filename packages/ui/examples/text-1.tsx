import * as React from "react";
import { Text } from "@/components/crm/text";
import { SearchInput } from "@/components/crm/search-input";

const notes = [
  {
    author: "Priya Shah",
    when: "2h ago",
    body: "Northwind confirmed budget for the Enterprise tier. Procurement wants the security questionnaire and a redlined MSA before Oct 15; legal review usually takes two weeks.",
  },
  {
    author: "Marcus Lee",
    when: "Yesterday",
    body: "Pricing call went well. They pushed back on the onboarding fee and asked for a 12% multi-year discount. Proposed 8% with a 3-year commitment and quarterly billing.",
  },
  {
    author: "Dana Ortiz",
    when: "Sep 22",
    body: "Champion moved to a new role; new economic buyer is the VP Finance. Schedule an intro and re-share the ROI model with updated seat counts.",
  },
];

export default function Example() {
  const [q, setQ] = React.useState("budget");
  const shown = notes.filter((n) => !q || n.body.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex w-[440px] flex-col gap-3">
      <Text variant="eyebrow">Deal notes</Text>
      <SearchInput value={q} onValueChange={setQ} placeholder="Search notes" />
      {shown.length === 0 ? (
        <Text variant="small" tone="muted">
          No notes match “{q}”.
        </Text>
      ) : (
        shown.map((n) => (
          <div key={n.author} className="rounded-crm border border-crm-border bg-crm-card p-3">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <Text as="span" variant="small" weight="medium">
                {n.author}
              </Text>
              <Text as="span" variant="caption">
                {n.when}
              </Text>
            </div>
            <Text variant="body" tone="muted" lines={2} highlight={q}>
              {n.body}
            </Text>
          </div>
        ))
      )}
      <div className="flex items-center justify-between rounded-crm border border-crm-border bg-crm-card p-3">
        <Text as="span" variant="small" tone="muted">
          Annual contract value
        </Text>
        <Text as="span" variant="lead" weight="semibold" numeric>
          $148,200.00
        </Text>
      </div>
      <Text variant="mono" tone="subtle">
        deal_id: dl_01J8ZK4Q7M2V
      </Text>
    </div>
  );
}
