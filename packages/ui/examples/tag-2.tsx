import { TagList } from "@/components/crm/tag";

export default function Example() {
  return (
    <div className="flex flex-col gap-3">
      <TagList
        tags={[
          { label: "Enterprise", color: "blue" },
          { label: "Mid-Market", color: "green" },
        ]}
      />
      <TagList
        tags={[
          { label: "Expansion", color: "green" },
          { label: "SMB", color: "yellow" },
          { label: "Upsell", color: "purple" },
          { label: "Pilot", color: "orange" },
        ]}
      />
      <TagList
        size="sm"
        tags={[
          { label: "Strategic", color: "red" },
          { label: "Land & Expand", color: "teal" },
        ]}
      />
    </div>
  );
}
