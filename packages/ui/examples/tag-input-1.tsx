import * as React from "react";
import { TagInput } from "@/components/crm/tag-input";

export default function Example() {
  const [tags, setTags] = React.useState(["enterprise", "q3-renewal"]);
  return (
    <div className="flex w-[320px] flex-col gap-1.5">
      <label htmlFor="deal-tags" className="text-xs text-crm-soft">
        Deal tags
      </label>
      <TagInput
        id="deal-tags"
        value={tags}
        onChange={setTags}
        max={6}
        tagColor="blue"
        validate={(t) => t.length <= 20 || "Keep tags under 20 characters"}
        placeholder="Type and press Enter"
      />
    </div>
  );
}
