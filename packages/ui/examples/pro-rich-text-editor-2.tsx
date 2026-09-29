import * as React from "react";
import {
  ProRichTextEditor,
  createLocalCollabRoom,
  type MentionSource,
} from "@/components/crm/pro-rich-text-editor";

// Two editors joined to one in-memory yjs room (80ms simulated latency). In production pass
// { doc: provider.doc, awareness: provider.awareness } from y-websocket or your own transport.
const team = [
  { id: "u_1", label: "Priya.Sharma", description: "Account Executive", badge: "PS" },
  { id: "u_2", label: "Marcus.Bennett", description: "Customer Success", badge: "MB" },
  { id: "u_3", label: "Elena.Rossi", description: "Solutions Engineer", badge: "ER" },
];
const sources: MentionSource[] = [
  {
    char: "@",
    label: "People",
    search: (q) => team.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())),
  },
];

const seed = `<h2>Incident review — EU checkout latency</h2>
<p>Owner: <span data-type="mention" data-id="u_2" data-label="Marcus.Bennett" data-mention-suggestion-char="@">@Marcus.Bennett</span>. Edit either pane: changes and cursors sync live.</p>
<ol><li><p>Timeline of the 14:05–14:40 UTC spike</p></li><li><p>Root cause: connection pool exhaustion</p></li><li><p>Follow-ups and owners</p></li></ol>`;

export default function Example() {
  const [room] = React.useState(() => createLocalCollabRoom({ latency: 80 }));
  const [a] = React.useState(() => room.join());
  const [b] = React.useState(() => room.join());

  return (
    <div className="grid gap-4 bg-crm-bg p-6 font-crm text-crm-fg lg:grid-cols-2">
      {[
        { peer: a, user: { name: "Priya Sharma", color: "#7c5cff" }, seedContent: seed },
        { peer: b, user: { name: "Marcus Bennett", color: "#16a37f" }, seedContent: undefined },
      ].map(({ peer, user, seedContent }) => (
        <div key={user.name} className="grid gap-2">
          <p className="text-xs text-crm-muted-fg">
            Signed in as <span className="font-medium text-crm-fg">{user.name}</span>
          </p>
          <ProRichTextEditor
            aria-label={`Incident notes (${user.name})`}
            defaultValue={seedContent}
            mentionSources={sources}
            collaboration={{ doc: peer.doc, awareness: peer.awareness, user }}
            minHeight={260}
          />
        </div>
      ))}
    </div>
  );
}
