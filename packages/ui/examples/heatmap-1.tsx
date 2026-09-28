import * as React from "react";
import { Heatmap, type HeatmapCell } from "@/components/crm/heatmap";

// Connected outbound calls over the last 30 days, weekday x hour (rep local time).
const profile = [0, 1, 3, 6, 9, 7, 4, 5, 8, 10, 6, 3, 1, 0];
const dayWeight = [0.9, 1, 1.1, 1, 0.7, 0.12, 0.05];
const data: HeatmapCell[] = dayWeight.flatMap((w, day) =>
  profile.map((p, i) => ({
    day,
    hour: 7 + i,
    value: Math.round(p * w * 4 + ((day * 7 + i * 3) % 5) * w),
  })),
);
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Example() {
  const [picked, setPicked] = React.useState<HeatmapCell | null>(null);
  return (
    <div className="max-w-2xl rounded-crm border border-crm-border bg-crm-card p-4">
      <h3 className="mb-3 text-sm font-medium text-crm-fg">Best time to call: connected calls</h3>
      <Heatmap data={data} hours={[7, 20]} unit="connects" onCellSelect={setPicked} />
      <p className="mt-3 text-xs text-crm-muted-fg" aria-live="polite">
        {picked
          ? `${days[picked.day]} ${picked.hour}:00 had ${picked.value} connects. Book a call block here?`
          : "Click a cell to plan a call block."}
      </p>
    </div>
  );
}
