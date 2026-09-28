import * as React from "react";
import {
  MentionList,
  type MentionItem,
  type MentionListHandle,
} from "@/components/crm/mention-list";

const people: MentionItem[] = [
  {
    id: "u1",
    name: "Priya Sharma",
    handle: "priya",
    subtitle: "Account Executive",
    presence: "online",
  },
  { id: "u2", name: "Marcus Webb", handle: "marcus", subtitle: "Sales Manager", presence: "away" },
  {
    id: "u3",
    name: "Aisha Khan",
    handle: "aisha.k",
    subtitle: "Solutions Engineer",
    presence: "online",
  },
  {
    id: "u4",
    name: "Diego Alvarez",
    handle: "diego",
    subtitle: "Customer Success",
    presence: "offline",
  },
  { id: "u5", name: "Hannah Lee", handle: "hannah", subtitle: "Legal Counsel", presence: "online" },
  { id: "u6", name: "Tom Becker", handle: "tbecker", disabledReason: "No access to this deal" },
  { id: "t1", name: "Deal Desk", handle: "dealdesk", kind: "team", members: 6 },
  { id: "t2", name: "Security Review", handle: "security", kind: "team", members: 4 },
];

export default function Example() {
  const [text, setText] = React.useState("Looping in @a");
  const [activeId, setActiveId] = React.useState<string>();
  const ref = React.useRef<MentionListHandle>(null);
  const match = /(?:^|\s)@([\w.]*)$/.exec(text);
  const query = match ? (match[1] ?? "") : null;

  const insert = (item: MentionItem) => {
    setText((t) => t.replace(/@([\w.]*)$/, `@${item.handle ?? item.name} `));
  };

  return (
    <div className="relative max-w-sm">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (query !== null) ref.current?.handleKeyDown(e);
        }}
        role="combobox"
        aria-expanded={query !== null}
        aria-controls="deal-mentions"
        aria-activedescendant={query !== null ? activeId : undefined}
        aria-label="Note"
        className="h-9 w-full rounded-crm border border-crm-input/60 bg-crm-raised px-3 text-sm text-crm-fg outline-none focus:border-crm-ring"
      />
      {query !== null ? (
        <MentionList
          ref={ref}
          id="deal-mentions"
          items={people}
          query={query}
          recentIds={["u5", "t1"]}
          onSelect={insert}
          onClose={() => setText((t) => `${t} `)}
          onActiveChange={setActiveId}
          className="absolute top-full left-0 z-10 mt-1"
        />
      ) : null}
    </div>
  );
}
