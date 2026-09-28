import * as React from "react";
import { DashboardEditor, type DashboardWidget } from "@/components/crm/dashboard-editor";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
});

const leaders: [string, number][] = [
  ["Maya Chen", 412000],
  ["Priya Nair", 368500],
  ["Omar Haddad", 290100],
  ["Sam Rivera", 214000],
];

const weekly = [12, 18, 15, 22, 28, 26, 34, 31, 40, 44];

function Body({ w }: { w: DashboardWidget }) {
  if (w.type === "kpi")
    return (
      <div className="flex h-full flex-col justify-between">
        <span className="text-2xl font-medium text-crm-fg tabular-nums">
          {usd.format(w.id === "a" ? 1284000 : 3910000)}
        </span>
        <span className="text-xs text-crm-success">+12.4% vs last quarter</span>
      </div>
    );
  if (w.type === "trend")
    return (
      <div className="flex h-full min-h-[160px] flex-col gap-2">
        <div className="flex items-baseline justify-between text-xs text-crm-soft">
          <span>Last 10 weeks · $k booked</span>
          <span className="text-crm-success">+267% since W1</span>
        </div>
        <div
          role="img"
          aria-label="Weekly bookings bar chart"
          className="flex min-h-0 flex-1 items-end gap-1.5 border-b border-crm-border"
        >
          {weekly.map((v, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1">
              <span className="text-center text-[10px] text-crm-subtle tabular-nums">{v}</span>
              <div
                className="w-full rounded-t bg-crm-primary/80"
                style={{ height: `${(v / 44) * 85}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 text-[10px] text-crm-subtle">
          {weekly.map((_, i) => (
            <span key={i} className="flex-1 text-center">
              W{i + 1}
            </span>
          ))}
        </div>
      </div>
    );
  if (w.type === "leaderboard")
    return (
      <ol className="flex flex-col gap-2 text-sm">
        {leaders.map(([n, v], i) => (
          <li key={n} className="flex justify-between text-crm-soft">
            <span>
              {i + 1}. {n}
            </span>
            <span className="text-crm-fg tabular-nums">{usd.format(v)}</span>
          </li>
        ))}
      </ol>
    );
  return (
    <ul className="flex flex-col gap-1.5 text-xs text-crm-soft">
      <li>Globex renewal · proposal overdue 3d</li>
      <li>Hooli platform · no activity 9d</li>
      <li>Wayne services · close date passed</li>
    </ul>
  );
}

export default function Example() {
  const [widgets, setWidgets] = React.useState<DashboardWidget[]>([
    { id: "a", type: "kpi", title: "Bookings QTD", span: 4, rows: 1 },
    { id: "b", type: "kpi", title: "Pipeline created", span: 4, rows: 1 },
    { id: "c", type: "list", title: "At-risk deals", span: 4, rows: 1 },
    { id: "d", type: "trend", title: "Weekly bookings", span: 8, rows: 2 },
    { id: "e", type: "leaderboard", title: "Rep leaderboard", span: 4, rows: 2 },
  ]);
  return (
    <DashboardEditor
      className="w-full max-w-5xl"
      widgets={widgets}
      onWidgetsChange={setWidgets}
      renderWidget={(w) => <Body w={w} />}
      library={[
        {
          type: "kpi",
          label: "KPI",
          description: "Single metric with delta",
          defaultSpan: 4,
          defaultRows: 1,
        },
        {
          type: "trend",
          label: "Trend",
          description: "Sparkline over time",
          defaultSpan: 6,
          defaultRows: 2,
        },
        { type: "leaderboard", label: "Leaderboard", defaultSpan: 4, defaultRows: 2 },
        { type: "list", label: "Deal list", defaultSpan: 6, defaultRows: 1 },
      ]}
    />
  );
}
