import { Avatar } from "@/components/crm/avatar";
import { Select } from "@/components/crm/select";

const owners = ["Sarah Nguyen", "James Taylor", "Maria Keller"];

export default function Example() {
  return (
    <div className="grid w-[420px] grid-cols-2 gap-4">
      <Select
        aria-label="Segment"
        defaultValue="enterprise"
        options={[
          { value: "enterprise", label: "Enterprise" },
          { value: "mid", label: "Mid-Market" },
          { value: "smb", label: "SMB" },
          { value: "strategic", label: "Strategic" },
        ]}
      />
      <Select
        aria-label="Stage"
        placeholder="Pick a stage"
        options={[
          { value: "new", label: "New Logo" },
          { value: "pilot", label: "Pilot" },
          { value: "renewal", label: "Renewal" },
        ]}
      />
      <Select
        aria-label="Account owner"
        className="col-span-2"
        defaultValue={owners[0]}
        options={owners.map((o) => ({ value: o, label: o, icon: <Avatar name={o} size="xs" /> }))}
      />
    </div>
  );
}
