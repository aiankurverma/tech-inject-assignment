import { LeadScoreBadge } from "@/components/crm/lead-score-badge";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <LeadScoreBadge
        score={86}
        delta={12}
        factors={[
          { label: "Requested demo", points: 30 },
          { label: "Visited pricing page 3× this week", points: 20 },
          { label: "Title: VP Revenue Operations", points: 15 },
          { label: "Company size 500–1k (ICP)", points: 15 },
          { label: "Opened last 4 emails", points: 12 },
          { label: "Existing competitor customer", points: -6 },
        ]}
      />
      <LeadScoreBadge score={54} delta={-4} />
      <LeadScoreBadge score={18} />
      <LeadScoreBadge score={73} size="sm" compact />
    </div>
  );
}
