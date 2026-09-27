import { Button } from "@/components/crm/button";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm">Small</Button>
      <Button>Medium</Button>
      <Button size="lg" variant="primary">
        Large
      </Button>
      <Button variant="primary" loading>
        Saving
      </Button>
      <Button disabled>Disabled</Button>
    </div>
  );
}
