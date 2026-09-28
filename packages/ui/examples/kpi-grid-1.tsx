import { Clock, DollarSign, Target, Users } from "lucide-react";
import { KpiGrid } from "@/components/crm/kpi-grid";

export default function Example() {
  return (
    <KpiGrid
      className="w-[880px]"
      items={[
        {
          label: "Revenue",
          value: "$1.28M",
          delta: 12.4,
          caption: "vs last month",
          icon: <DollarSign />,
          trend: [4, 6, 5, 8, 7, 9, 12],
        },
        { label: "New leads", value: 842, delta: -3.1, caption: "vs last month", icon: <Users /> },
        { label: "Win rate", value: "31%", delta: 0, caption: "flat", icon: <Target /> },
        {
          label: "First response",
          value: "2h 14m",
          delta: -18.2,
          invert: true,
          caption: "faster",
          icon: <Clock />,
          trend: [9, 8, 8, 6, 5, 4, 3],
        },
      ]}
    />
  );
}
