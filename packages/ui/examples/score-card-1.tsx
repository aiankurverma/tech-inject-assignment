import { ScoreCard } from "@/components/crm/score-card";

export default function Example() {
  return (
    <div className="flex w-[480px] flex-col gap-2">
      <ScoreCard
        title="Business fit"
        description="Evaluates how well the company aligns with our ideal customer profile."
        owner={{ name: "Emma Green" }}
        updated="Updated 2h ago"
        rating={4}
      />
      <ScoreCard
        title="Technical fit"
        description="Evaluates technical compatibility, security requirements, and integration readiness."
        owner={{ name: "Ricky Brown" }}
        updated="Updated 1d ago"
        rating={3}
        ratingLabel="Medium"
      />
    </div>
  );
}
