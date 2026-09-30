import { useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@ti/client";
import { useLoad } from "../hooks/useLoad";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  Skeleton,
  cn,
  focusRing,
} from "../components/ui";

type Counts = { views: number; copies: number; installs: number; previews: number };
type TopKey = "views" | "copies" | "installs";
interface UsageSummary {
  days: number;
  totals: Counts;
  daily: ({ day: string } & Counts)[];
  top: Record<TopKey, { slug: string; count: number }[]>;
  cliDownloads: number;
}

// Neutral series colours that read in light and dark admin themes.
const SERIES: { key: keyof Counts; label: string; color: string }[] = [
  { key: "views", label: "Views", color: "#3b82f6" },
  { key: "previews", label: "Previews", color: "#14b8a6" },
  { key: "copies", label: "Copies", color: "#f59e0b" },
  { key: "installs", label: "Installs", color: "#a855f7" },
];
const TOP: { key: TopKey; label: string; color: string }[] = [
  { key: "views", label: "Views", color: "#3b82f6" },
  { key: "copies", label: "Copies", color: "#f59e0b" },
  { key: "installs", label: "Installs", color: "#a855f7" },
];
const axis = { fontSize: 11, fill: "currentColor" };
const tooltipStyle = {
  background: "var(--color-background, #fff)",
  border: "1px solid var(--color-border, #e5e5e5)",
  borderRadius: 8,
  fontSize: 12,
};

function Total({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {value === undefined ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
          {value.toLocaleString()}
        </p>
      )}
    </Card>
  );
}

export function Analytics() {
  const [days, setDays] = useState<"7" | "30">("7");
  const [metric, setMetric] = useState<TopKey>("views");
  const { data, error, loading, reload } = useLoad(
    () => api<UsageSummary>(`/api/admin/analytics?days=${days}`),
    days,
  );
  const top = TOP.find((t) => t.key === metric)!;
  const topRows = data?.top[metric] ?? [];

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Anonymous daily counts per component. No visitor data is stored."
        actions={
          <Segmented
            label="Range"
            value={days}
            onChange={setDays}
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
            ]}
          />
        }
      />
      {error ? (
        <Card>
          <ErrorState message={error} onRetry={() => void reload()} />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {SERIES.map((s) => (
              <Total key={s.key} label={s.label} value={data?.totals[s.key]} />
            ))}
            <Total label="CLI downloads" value={data?.cliDownloads} />
          </div>

          <Card className="overflow-hidden">
            <CardHeader title="Activity per day" />
            <div className="h-64 px-2 pb-4 text-muted-foreground">
              {loading && !data ? (
                <Skeleton className="mx-4 h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.daily ?? []} margin={{ top: 8, right: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="day" tick={axis} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis allowDecimals={false} tick={axis} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {SERIES.map((s) => (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Top components"
              actions={
                <Segmented
                  label="Metric"
                  value={metric}
                  onChange={setMetric}
                  options={TOP.map((t) => ({ value: t.key, label: t.label }))}
                />
              }
            />
            {loading && !data ? (
              <Skeleton className="m-4 h-56" />
            ) : topRows.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No data yet"
                description={`No ${top.label.toLowerCase()} recorded in the last ${days} days.`}
              />
            ) : (
              <div className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
                <div
                  className="text-muted-foreground"
                  style={{ height: Math.max(160, topRows.length * 30) }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={axis} />
                      <YAxis type="category" dataKey="slug" tick={axis} width={140} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fillOpacity: 0.08 }} />
                      <Bar dataKey="count" name={top.label} fill={top.color} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ol className="flex flex-col gap-1 text-sm">
                  {topRows.map((r, i) => (
                    <li key={r.slug} className="flex items-center justify-between gap-3">
                      <Link
                        to={`/components/${r.slug}`}
                        className={cn("truncate rounded text-foreground hover:underline", focusRing)}
                      >
                        <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                        {r.slug}
                      </Link>
                      <span className="tabular-nums text-muted-foreground">
                        {r.count.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
