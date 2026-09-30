import {
  AnalyticsOverviewTemplate,
  type AnalyticsPeriodData,
} from "@/components/crm/analytics-overview-template";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

// Small generator: one period of `points` buckets, scaled.
function period(labels: string[], scale: number): AnalyticsPeriodData {
  return {
    kpis: [
      { label: "Revenue", value: money.format(412_000 * scale), delta: 9.8 },
      { label: "New customers", value: String(Math.round(184 * scale)), delta: 4.1 },
      { label: "Conversion", value: "3.2%", delta: 0.4 },
      { label: "Churn", value: "1.8%", delta: -0.3, invert: true },
    ],
    trend: {
      data: labels.map((label, i) => ({
        label,
        values: {
          revenue: Math.round((52_000 + i * 3_100 + (i % 3) * 2_400) * scale),
          previous: Math.round((48_000 + i * 2_200) * scale),
        },
      })),
      series: [
        { key: "revenue", label: "This period" },
        { key: "previous", label: "Previous period", dashed: true, color: "#8a8a8a" },
      ],
    },
    channels: {
      data: ["Organic", "Paid", "Referral", "Partners"].map((label, i) => ({
        label,
        values: { new: (60_000 - i * 11_000) * scale, expansion: (22_000 - i * 4_000) * scale },
      })),
      series: [
        { key: "new", label: "New" },
        { key: "expansion", label: "Expansion" },
      ],
    },
    segments: [
      { key: "ent", label: "Enterprise", value: 198_000 * scale },
      { key: "mid", label: "Mid-market", value: 134_000 * scale },
      { key: "smb", label: "SMB", value: 80_000 * scale },
    ],
    funnel: [
      { key: "visit", label: "Visitors", count: Math.round(42_000 * scale) },
      { key: "signup", label: "Sign-ups", count: Math.round(3_900 * scale), benchmark: 0.08 },
      { key: "active", label: "Activated", count: Math.round(1_700 * scale), benchmark: 0.5 },
      { key: "paid", label: "Paid", count: Math.round(184 * scale), benchmark: 0.15 },
    ],
  };
}

export default function Example() {
  return (
    <AnalyticsOverviewTemplate
      periods={{
        "30d": period(["W1", "W2", "W3", "W4"], 1),
        "90d": period(["Jul", "Aug", "Sep"], 3),
      }}
      periodLabels={{ "30d": "30 days", "90d": "90 days" }}
      formatValue={(v) => money.format(v)}
    />
  );
}
