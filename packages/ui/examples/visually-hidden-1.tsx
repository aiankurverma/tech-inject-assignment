import * as React from "react";
import { Star, Trash2 } from "lucide-react";
import {
  AnnouncerProvider,
  SkipLink,
  VisuallyHidden,
  useAnnounce,
} from "@/components/crm/visually-hidden";

const initial = [
  { id: "d1", name: "Northwind renewal", starred: false },
  { id: "d2", name: "Globex expansion", starred: true },
  { id: "d3", name: "Initech pilot", starred: false },
];

function DealList() {
  const announce = useAnnounce();
  const [deals, setDeals] = React.useState(initial);
  return (
    <main id="deals-main" className="space-y-2 outline-none">
      <VisuallyHidden as="h2">Deals ({deals.length})</VisuallyHidden>
      <ul className="divide-y divide-crm-border rounded-crm border border-crm-border bg-crm-surface">
        {deals.map((d) => (
          <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm text-crm-fg">
            <span className="flex-1">{d.name}</span>
            <button
              type="button"
              aria-pressed={d.starred}
              onClick={() => {
                setDeals((ds) =>
                  ds.map((x) => (x.id === d.id ? { ...x, starred: !x.starred } : x)),
                );
                announce(`${d.name} ${d.starred ? "removed from" : "added to"} favourites`);
              }}
              className="grid size-7 cursor-pointer place-items-center rounded-md text-crm-subtle hover:bg-crm-muted"
            >
              <Star
                aria-hidden
                className={`size-4 ${d.starred ? "fill-current text-crm-warning" : ""}`}
              />
              <VisuallyHidden>Favourite {d.name}</VisuallyHidden>
            </button>
            <button
              type="button"
              onClick={() => {
                setDeals((ds) => ds.filter((x) => x.id !== d.id));
                announce(`${d.name} archived. ${deals.length - 1} deals left`, "assertive");
              }}
              className="grid size-7 cursor-pointer place-items-center rounded-md text-crm-subtle hover:bg-crm-muted hover:text-crm-danger"
            >
              <Trash2 aria-hidden className="size-4" />
              <VisuallyHidden>Archive {d.name}</VisuallyHidden>
            </button>
          </li>
        ))}
        {deals.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-crm-subtle">All deals archived.</li>
        )}
      </ul>
    </main>
  );
}

export default function Example() {
  return (
    <AnnouncerProvider>
      <div className="w-full max-w-md space-y-2 font-crm">
        <SkipLink targetId="deals-main">Skip to deals</SkipLink>
        <p className="crm-caption">
          Press Tab to reveal the skip link. Icon buttons carry hidden labels.
        </p>
        <DealList />
      </div>
    </AnnouncerProvider>
  );
}
