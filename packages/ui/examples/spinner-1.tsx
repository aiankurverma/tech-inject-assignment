import { Spinner } from "@/components/crm/spinner";

export default function Example() {
  return (
    <div className="flex flex-col gap-4 font-crm text-sm text-crm-soft">
      <div className="flex items-center gap-4">
        <Spinner size="xs" />
        <Spinner size="sm" />
        <Spinner size="md" tone="primary" />
        <Spinner size="lg" />
      </div>
      <div role="status" className="flex items-center gap-2">
        <Spinner tone="inherit" label="" />
        Syncing contacts…
      </div>
    </div>
  );
}
