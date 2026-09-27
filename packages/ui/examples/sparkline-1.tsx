import { Sparkline, TrendStat } from "@/components/crm/sparkline";

export default function Example() {
  return (
    <div className="flex flex-col gap-6">
      <Sparkline data={[2, 5, 1, 3, 6, 4, 7, 5, 8, 6, 9, 7]} />
      <TrendStat
        value={90}
        data={[1, 3, 2, 1, 4, 3, 5, 4, 6, 5, 7]}
        caption="Spikes around QBR prep and renewal review"
      />
    </div>
  );
}
