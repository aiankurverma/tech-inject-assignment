import * as React from "react";
import { CommentThread, type ThreadComment } from "@/components/crm/comment-thread";

const me = { id: "u1", name: "Priya Sharma" };
const marcus = { id: "u2", name: "Marcus Webb" };
const aisha = { id: "u3", name: "Aisha Khan" };
const hannah = { id: "u5", name: "Hannah Lee" };
const mentionables = [marcus, aisha, hannah, { id: "u4", name: "Diego Alvarez" }];

const initial: ThreadComment[] = [
  {
    id: "c1",
    author: marcus,
    createdAt: "2026-09-01T10:00",
    body: "Acme is asking for a 2x liability cap. @Hannah Lee can we accept that for a $240k deal?",
    replies: [
      {
        id: "c1r1",
        author: hannah,
        createdAt: "2026-09-01T11:20",
        body: "2x is fine if it excludes data breach indemnity. I'll send fallback language.",
      },
      {
        id: "c1r2",
        author: me,
        createdAt: "2026-09-01T12:02",
        body: "Thanks! Forwarding to Wade on their side.",
      },
      {
        id: "c1r3",
        author: marcus,
        createdAt: "2026-09-01T12:30",
        body: "Great. Let's also push for a 3-year term in exchange.",
      },
    ],
  },
  {
    id: "c2",
    author: aisha,
    createdAt: "2026-08-28T15:00",
    body: "SSO config tested with their Okta tenant. All good.",
    resolved: true,
  },
  {
    id: "c3",
    author: me,
    createdAt: "2026-09-02T08:45",
    body: "@Aisha Khan can you join the security review on Thursday?",
  },
];

let seq = 100;

export default function Example() {
  const [comments, setComments] = React.useState(initial);
  const add = (body: string, parentId: string | null) => {
    const c: ThreadComment = { id: `n${seq++}`, author: me, body, createdAt: new Date() };
    setComments((cs) =>
      parentId === null
        ? [...cs, c]
        : cs.map((x) => (x.id === parentId ? { ...x, replies: [...(x.replies ?? []), c] } : x)),
    );
  };
  const mapAll = (fn: (c: ThreadComment) => ThreadComment | null) =>
    setComments((cs) =>
      cs
        .map(fn)
        .filter((c): c is ThreadComment => c !== null)
        .map((c) => ({
          ...c,
          replies: c.replies?.map(fn).filter((r): r is ThreadComment => r !== null),
        })),
    );
  return (
    <div className="max-w-xl">
      <CommentThread
        comments={comments}
        currentUser={me}
        mentionables={mentionables}
        onAdd={add}
        onEdit={(id, body) =>
          mapAll((c) => (c.id === id ? { ...c, body, editedAt: new Date() } : c))
        }
        onDelete={(id) => mapAll((c) => (c.id === id ? null : c))}
        onResolve={(id, resolved) => mapAll((c) => (c.id === id ? { ...c, resolved } : c))}
      />
    </div>
  );
}
