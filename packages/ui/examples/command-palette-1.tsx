import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/crm/button";
import { CommandPalette } from "@/components/crm/command-palette";

const companies = ["LVMH", "Disney", "Paypal", "United Airlines", "Apple", "Microsoft"];

export default function Example() {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState("");
  return (
    <div className="flex flex-col items-center gap-2 text-sm text-crm-soft">
      <Button onClick={() => setOpen(true)}>
        <Search /> Search
      </Button>
      {picked ? <span>Opened {picked}</span> : null}
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        placeholder="Search companies, owners, stages..."
        header="Company"
        items={companies.map((c) => ({
          id: c,
          keywords: c,
          render: <span className="text-crm-fg">{c}</span>,
        }))}
        onSelect={(id) => {
          setPicked(id);
          setOpen(false);
        }}
      />
    </div>
  );
}
