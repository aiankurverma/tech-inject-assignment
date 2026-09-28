import { LineChart } from "@/components/crm/line-chart";

const weeks = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12", "W13"];
const actual = [412, 438, 455, 449, 471, 503, 498, null, 541, 566, 583, 602, 624];
const lastQ = [398, 401, 417, 422, 430, 441, 452, 459, 463, 470, 481, 488, 495];

export default function Example() {
  return (
    <div className="w-[760px] max-w-full">
      <LineChart
        label="Weekly active accounts, this quarter vs last"
        area
        data={weeks.map((w, i) => ({
          label: w,
          values: { actual: actual[i] ?? null, lastQ: lastQ[i] ?? null },
        }))}
        series={[
          { key: "actual", label: "This quarter" },
          { key: "lastQ", label: "Last quarter", dashed: true, color: "#8a8a8a" },
        ]}
      />
    </div>
  );
}
