import { BarChart } from "@/components/crm/bar-chart";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const bookings = [
  { label: "Jan", values: { newBiz: 182000, expansion: 64000, renewal: 210000 } },
  { label: "Feb", values: { newBiz: 156000, expansion: 81000, renewal: 188000 } },
  { label: "Mar", values: { newBiz: 241000, expansion: 97000, renewal: 256000 } },
  { label: "Apr", values: { newBiz: 198000, expansion: 72000, renewal: 174000 } },
  { label: "May", values: { newBiz: 265000, expansion: 118000, renewal: 231000 } },
  { label: "Jun", values: { newBiz: 312000, expansion: 134000, renewal: 297000 } },
];

export default function Example() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-10">
      <BarChart
        label="Bookings by type, H1"
        data={bookings}
        series={[
          { key: "newBiz", label: "New business" },
          { key: "expansion", label: "Expansion" },
          { key: "renewal", label: "Renewal" },
        ]}
        mode="stacked"
        target={{ value: 600000, label: "Monthly target" }}
        formatValue={(v) => usd.format(v)}
      />
      <BarChart
        label="Meetings booked per rep"
        data={[
          { label: "Priya", values: { meetings: 34 } },
          { label: "Marcus", values: { meetings: 27 } },
          { label: "Lena", values: { meetings: 41 } },
          { label: "Tomás", values: { meetings: 19 } },
          { label: "Aiko", values: { meetings: 30 } },
        ]}
        series={[{ key: "meetings", label: "Meetings" }]}
        height={180}
      />
    </div>
  );
}
