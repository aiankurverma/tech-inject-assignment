import * as React from "react";
import { Combobox, type ComboboxOption } from "@/components/crm/combobox";

const OWNERS: ComboboxOption[] = [
  { value: "ava", label: "Ava Chen", description: "Account Executive", keywords: "ava@acme.io" },
  {
    value: "marcus",
    label: "Marcus Reid",
    description: "Sales Manager",
    keywords: "marcus@acme.io",
  },
  { value: "priya", label: "Priya Nair", description: "SDR", keywords: "priya@acme.io" },
  { value: "tom", label: "Tom Alvarez", description: "Account Executive", keywords: "tom@acme.io" },
  { value: "lena", label: "Lena Fischer", description: "On leave", disabled: true },
];

export default function Example() {
  const [owner, setOwner] = React.useState<string | null>("ava");
  return (
    <div className="flex w-[280px] flex-col gap-1.5">
      <span className="text-xs text-crm-soft">Deal owner</span>
      <Combobox
        options={OWNERS}
        value={owner}
        onChange={setOwner}
        placeholder="Assign an owner"
        searchPlaceholder="Search people…"
        clearable
        defaultOpen
        aria-label="Deal owner"
      />
    </div>
  );
}
