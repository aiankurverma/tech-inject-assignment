import * as React from "react";
import { ChatBubble, type ChatDelivery } from "@/components/crm/chat-bubble";

const m = (n: number) => new Date(Date.now() - n * 60_000);
const dana = { name: "Dana Whit", role: "Acme Corp" };
const alex = { name: "Alex Santos", role: "Support" };

export default function Example() {
  const [delivery, setDelivery] = React.useState<ChatDelivery>("failed");
  return (
    <div className="flex max-w-xl flex-col rounded-xl border border-crm-border bg-crm-card p-4">
      <ChatBubble
        author={dana}
        at={m(14)}
        groupPosition="first"
        text="Hi! Our invoice INV-2041 shows 144 seats but we only have 120 active users."
      />
      <ChatBubble
        author={dana}
        at={m(13)}
        groupPosition="last"
        attachments={[{ name: "seat-report-october.csv", size: 48_213 }]}
      />
      <ChatBubble
        author={alex}
        at={m(10)}
        outgoing
        internal
        text="Seats were bumped in v3 of the deal. Check with Priya before crediting."
      />
      <ChatBubble
        author={alex}
        at={m(8)}
        outgoing
        delivery="read"
        replyTo={{
          author: "Dana Whit",
          text: "Our invoice INV-2041 shows 144 seats but we only have 120 active users.",
        }}
        text={
          "Thanks Dana, the 24 extra seats were added on the renewal.\nDetails: https://help.northwind.io/billing/seats"
        }
      />
      <ChatBubble
        author={alex}
        at={m(1)}
        outgoing
        delivery={delivery}
        onRetry={() => {
          setDelivery("sending");
          setTimeout(() => setDelivery("delivered"), 800);
        }}
        text="I've issued a credit note for $2,880."
      />
      <ChatBubble author={dana} at={m(0)} typing />
    </div>
  );
}
