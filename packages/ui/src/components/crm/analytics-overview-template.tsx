import * as React from "react";
import { BarChart3, Download, Filter, Globe, PieChart, TrendingUp } from "lucide-react";
import { BarChart, type BarDatum, type BarSeries } from "@/components/crm/bar-chart";
import { Button } from "@/components/crm/button";
import { Card, CardBody, CardHeader } from "@/components/crm/card";
import { DonutChart, type DonutSegment } from "@/components/crm/donut-chart";
import { FunnelChart, type FunnelStage } from "@/components/crm/funnel-chart";
import { LineChart, type LinePoint, type LineSeries } from "@/components/crm/line-chart";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { TemplateShell, type Kpi } from "@/components/crm/template-shell";

export interface AnalyticsPeriodData {
  kpis: Kpi[];
  trend: { data: LinePoint[]; series: LineSeries[] };
  channels: { data: BarDatum[]; series: BarSeries[] };
  segments: DonutSegment[];
  funnel: FunnelStage[];
}

export interface AnalyticsOverviewTemplateProps {
  /** Keyed by period id, e.g. { "30d": …, "90d": … }. The header switches between them. */
  periods: Record<string, AnalyticsPeriodData>;
  periodLabels?: Record<string, string>;
  defaultPeriod?: string;
  currency?: string;
  formatValue?: (value: number) => string;
  onExport?: (period: string) => void;
  className?: string;
}

const nav = [
  { id: "overview", label: "Overview", icon: <TrendingUp /> },
  { id: "acquisition", label: "Acquisition", icon: <Globe /> },
  { id: "revenue", label: "Revenue", icon: <BarChart3 /> },
  { id: "segments", label: "Segments", icon: <PieChart /> },
  { id: "funnels", label: "Funnels", icon: <Filter /> },
];

/** Full-page analytics overview: period switcher, KPIs, trend, channel bars, segment donut and funnel. */
export function AnalyticsOverviewTemplate({
  periods,
  periodLabels,
  defaultPeriod,
  currency = "USD",
  formatValue,
  onExport,
  className,
}: AnalyticsOverviewTemplateProps) {
  const keys = Object.keys(periods);
  const [period, setPeriod] = React.useState(defaultPeriod ?? keys[0] ?? "");
  const data = periods[period];
  return (
    <TemplateShell
      className={className}
      brand={{ logo: <BarChart3 />, title: "Analytics", subtitle: "Revenue & growth" }}
      nav={nav}
      title="Analytics overview"
      description="Revenue, acquisition and conversion at a glance."
      kpis={data?.kpis}
      actions={
        <>
          {keys.length > 1 ? (
            <SegmentedControl
              label="Period"
              size="sm"
              value={period}
              onValueChange={setPeriod}
              options={keys.map((k) => ({ value: k, label: periodLabels?.[k] ?? k }))}
            />
          ) : null}
          <Button onClick={() => onExport?.(period)}>
            <Download /> Export
          </Button>
        </>
      }
    >
      {data ? (
        <>
          <Card>
            <CardHeader title="Revenue trend" bordered />
            <CardBody>
              <LineChart
                label="Revenue trend"
                area
                curved
                height={220}
                formatValue={formatValue}
                data={data.trend.data}
                series={data.trend.series}
              />
            </CardBody>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Revenue by channel" bordered />
              <CardBody>
                <BarChart
                  label="Revenue by channel"
                  mode="stacked"
                  height={220}
                  formatValue={formatValue}
                  data={data.channels.data}
                  series={data.channels.series}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Revenue by segment" bordered />
              <CardBody className="grid place-items-center">
                <DonutChart
                  label="Revenue by segment"
                  data={data.segments}
                  formatValue={formatValue}
                  centerLabel="Total"
                />
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title="Signup to paid funnel" bordered />
            <CardBody>
              <FunnelChart label="Signup to paid funnel" stages={data.funnel} currency={currency} />
            </CardBody>
          </Card>
        </>
      ) : (
        <p role="status" className="text-sm text-crm-soft">
          No data for this period.
        </p>
      )}
    </TemplateShell>
  );
}
