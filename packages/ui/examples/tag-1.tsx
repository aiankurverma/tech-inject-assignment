import { Tag, tagColors, type TagColor } from "@/components/crm/tag";

export default function Example() {
  return (
    <div className="flex max-w-md flex-wrap gap-1.5">
      {(Object.keys(tagColors) as TagColor[]).map((c) => (
        <Tag key={c} color={c}>
          {c}
        </Tag>
      ))}
    </div>
  );
}
