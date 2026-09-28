import * as React from "react";
import { ReactionBar, type Reaction } from "@/components/crm/reaction-bar";

export default function Example() {
  const [reactions, setReactions] = React.useState<Reaction[]>([
    { emoji: "🎉", users: ["Priya Nair", "Tom Becker", "Lena Park", "Alex Santos"] },
    { emoji: "🔥", users: ["Grace Miller"] },
    { emoji: "👀", users: ["Alex Santos", "Jensen Ackles"] },
  ]);
  return (
    <div className="flex max-w-md flex-col gap-3 rounded-xl border border-crm-border bg-crm-card p-4 font-crm">
      <p className="text-sm text-crm-fg">
        <span className="font-medium">Grace Miller</span> closed{" "}
        <span className="font-medium">Northwind · Enterprise</span> for $148,000 ARR.
      </p>
      <ReactionBar
        reactions={reactions}
        onReactionsChange={setReactions}
        currentUser="Alex Santos"
      />
      <p className="crm-caption text-crm-subtle">
        {reactions.reduce((n, r) => n + r.users.length, 0)} reactions
      </p>
    </div>
  );
}
