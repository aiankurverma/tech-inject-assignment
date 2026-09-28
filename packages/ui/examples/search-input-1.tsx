import * as React from "react";
import { SearchInput } from "@/components/crm/search-input";

const CONTACTS = ["Ava Chen", "Marcus Reid", "Priya Nair", "Tom Alvarez", "Lena Fischer"];

export default function Example() {
  const [q, setQ] = React.useState("");
  const results = CONTACTS.filter((c) => c.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex w-[300px] flex-col gap-2">
      <SearchInput
        value={q}
        onValueChange={setQ}
        placeholder="Search contacts"
        shortcut="k"
        aria-label="Search contacts"
      />
      <ul className="flex flex-col gap-1 text-sm text-crm-soft">
        {results.map((c) => (
          <li key={c}>{c}</li>
        ))}
        {results.length === 0 ? <li className="text-crm-subtle">No matches</li> : null}
      </ul>
    </div>
  );
}
