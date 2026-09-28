import { Divider } from "@/components/crm/divider";

export default function Example() {
  return (
    <div className="flex w-80 flex-col gap-5 font-crm text-sm text-crm-soft">
      <Divider />
      <Divider label="Today" />
      <Divider label="Earlier" align="start" variant="dashed" />
      <div className="flex h-5 items-center">
        <span>Deals</span>
        <Divider orientation="vertical" />
        <span>Contacts</span>
        <Divider orientation="vertical" />
        <span>Tasks</span>
      </div>
    </div>
  );
}
