import * as React from "react";
import {
  ProTimeSeriesExplorer,
  type TimeAnnotation,
  type TimeSeries,
  type TimeSeriesPanel,
} from "@/components/crm/pro-time-series-explorer";

// 4 series x 250,000 samples at 10 s resolution (~29 days) = 1,000,000 points.
const N = 250_000;
const STEP = 10_000;
const END = Date.UTC(2026, 8, 28, 12, 0, 0);
const START = END - (N - 1) * STEP;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function build(): TimeSeries[] {
  const r = rng(42);
  const ts = new Float64Array(N);
  const cpu = new Float32Array(N);
  const mem = new Float32Array(N);
  const p95 = new Float32Array(N);
  const rps = new Float32Array(N);
  let walk = 0;
  let leak = 0;
  for (let i = 0; i < N; i++) {
    const t = START + i * STEP;
    ts[i] = t;
    const hour = (t / 3_600_000) % 24;
    const daily = Math.sin(((hour - 9) / 24) * Math.PI * 2);
    walk = walk * 0.995 + (r() - 0.5) * 0.8;
    const incident = i > 180_000 && i < 181_500 ? 38 : 0;
    cpu[i] = Math.min(99, 42 + daily * 18 + walk * 3 + r() * 6 + incident);
    leak = i % 60_000 === 0 ? 0 : leak + 0.0009;
    mem[i] = 5.2 + leak + daily * 0.4 + r() * 0.15;
    rps[i] = Math.max(0, 1800 + daily * 900 + walk * 40 + r() * 120 + incident * 30);
    // Deploy window with a telemetry gap.
    p95[i] =
      i > 120_000 && i < 120_090
        ? NaN
        : 120 + daily * 25 + r() * 30 + incident * 14 + (r() > 0.999 ? 400 : 0);
  }
  return [
    { id: "cpu", label: "CPU", unit: "%", timestamps: ts, values: cpu, panel: "infra" },
    {
      id: "mem",
      label: "Memory",
      unit: "GB",
      timestamps: ts,
      values: mem,
      panel: "infra",
      color: "#38bdf8",
    },
    {
      id: "rps",
      label: "Requests/s",
      timestamps: ts,
      values: rps,
      panel: "traffic",
      color: "#22c55e",
    },
    {
      id: "p95",
      label: "p95 latency",
      unit: "ms",
      timestamps: ts,
      values: p95,
      panel: "latency",
      color: "#f97373",
    },
  ];
}

const panels: TimeSeriesPanel[] = [
  { id: "infra", title: "api-prod · CPU % / memory GB", height: 190 },
  { id: "traffic", title: "Requests per second", height: 150 },
  { id: "latency", title: "p95 latency (ms)", height: 150, formatValue: (v) => `${v.toFixed(0)}` },
];

const annotations: TimeAnnotation[] = [
  { id: "deploy", time: START + 120_000 * STEP, label: "Deploy v4.18.0", color: "#7c6bff" },
  {
    id: "inc",
    time: START + 180_000 * STEP,
    endTime: START + 181_500 * STEP,
    label: "INC-2231 cache stampede",
    color: "#f97373",
  },
  {
    id: "scale",
    time: START + 220_000 * STEP,
    label: "Autoscaler 6→9 pods",
    color: "#f59e0b",
    panel: "infra",
  },
];

export default function Example() {
  const series = React.useMemo(build, []);
  return (
    <div className="w-[980px] max-w-full">
      <ProTimeSeriesExplorer
        title="Production metrics · api-prod (eu-west-1)"
        series={series}
        panels={panels}
        annotations={annotations}
        defaultRange={[END - 7 * 86_400_000, END]}
      />
    </div>
  );
}
