import * as React from "react";
import { LoadingOverlay } from "@/components/crm/loading-overlay";
import { Button } from "@/components/crm/button";

const reps = [
  { name: "Priya Shah", quota: 320000, closed: 274000 },
  { name: "Marcus Lee", quota: 280000, closed: 301500 },
  { name: "Ana Souza", quota: 300000, closed: 188200 },
  { name: "Tom Becker", quota: 250000, closed: 142900 },
];

export default function Example() {
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const timer = React.useRef<number | undefined>(undefined);

  const stop = () => {
    window.clearInterval(timer.current);
    setLoading(false);
  };
  const recalc = () => {
    setProgress(0);
    setLoading(true);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          stop();
          return 100;
        }
        return p + 12;
      });
    }, 250);
  };
  React.useEffect(() => () => window.clearInterval(timer.current), []);

  return (
    <div className="w-full max-w-lg space-y-3">
      <div className="flex items-center justify-between">
        <span className="crm-eyebrow">Q3 attainment</span>
        <Button size="sm" onClick={recalc} disabled={loading}>
          Recalculate forecast
        </Button>
      </div>
      <LoadingOverlay
        loading={loading}
        label="Recalculating forecast…"
        progress={progress}
        onCancel={stop}
        className="rounded-crm"
      >
        <table className="w-full overflow-hidden rounded-crm border border-crm-border bg-crm-surface font-crm text-sm">
          <thead className="bg-crm-raised text-left text-xs text-crm-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Rep</th>
              <th className="px-3 py-2 text-right font-medium">Attainment</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((r) => {
              const pct = Math.round((r.closed / r.quota) * 100);
              return (
                <tr key={r.name} className="border-t border-crm-border">
                  <td className="px-3 py-2 text-crm-fg">{r.name}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${pct >= 100 ? "text-crm-success" : "text-crm-soft"}`}
                  >
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </LoadingOverlay>
    </div>
  );
}
