import { Textarea } from "@/components/crm/textarea";

export default function Example() {
  return (
    <div className="flex w-[380px] flex-col gap-4">
      <Textarea placeholder="Add a note about this account…" autoResize />
      <Textarea
        placeholder="Deal summary for the forecast call"
        maxLength={280}
        showCount
        defaultValue="Champion confirmed budget; legal review starts Monday."
      />
      <Textarea placeholder="Required field" invalid rows={2} />
    </div>
  );
}
