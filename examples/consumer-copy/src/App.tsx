import { Download, Plus } from "lucide-react";
import { Button } from "@/components/crm/button";

export function App() { return <Example />; }
function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary">
        <Plus /> New Company
      </Button>
      <Button>
        <Download /> Export
      </Button>
      <Button variant="muted">Add Billings</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="danger">Delete</Button>
    </div>
  );
}
