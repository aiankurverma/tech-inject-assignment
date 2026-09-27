import { Calendar, Mail, Phone, Sparkles } from "lucide-react";
import { SectionLabel, StatCard } from "@/components/crm/stat-card";

export default function Example() {
  return (
    <div className="flex w-[460px] flex-col gap-4">
      <SectionLabel>Team pipeline</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Accounts" value={18} />
        <StatCard label="Open deals" value={90} />
        <StatCard label="Pipeline" value="$5,138,594" />
        <StatCard label="Avg. win" value="51%" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <StatCard icon={<Sparkles />} label="Touches" value={24} />
        <StatCard icon={<Mail />} label="Emails" value={10} />
        <StatCard icon={<Calendar />} label="Meetings" value={3} />
        <StatCard icon={<Phone />} label="Calls" value={7} />
      </div>
    </div>
  );
}
