import * as React from "react";
import { SavedViews, type SavedView } from "@/components/crm/saved-views";

export default function Example() {
  const [views, setViews] = React.useState<SavedView[]>([
    { id: "all", name: "All deals", count: 1284, system: true },
    { id: "mine", name: "My open deals", count: 42, pinned: true },
    { id: "q4", name: "Closing this quarter", count: 118, shared: true },
    { id: "stale", name: "No activity 14d", count: 37 },
  ]);
  const [active, setActive] = React.useState("mine");
  return (
    <SavedViews
      views={views}
      activeId={active}
      onSelect={setActive}
      dirty={active === "q4"}
      onUpdate={() => undefined}
      onCreate={(name) => {
        const id = `v${Date.now()}`;
        setViews((v) => [...v, { id, name }]);
        setActive(id);
      }}
      onRename={(id, name) => setViews((v) => v.map((x) => (x.id === id ? { ...x, name } : x)))}
      onDuplicate={(id) =>
        setViews((v) => {
          const src = v.find((x) => x.id === id)!;
          return [...v, { ...src, id: `v${Date.now()}`, name: `${src.name} copy`, system: false }];
        })
      }
      onTogglePin={(id) =>
        setViews((v) => v.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)))
      }
      onDelete={(id) => {
        setViews((v) => v.filter((x) => x.id !== id));
        if (id === active) setActive("all");
      }}
    />
  );
}
