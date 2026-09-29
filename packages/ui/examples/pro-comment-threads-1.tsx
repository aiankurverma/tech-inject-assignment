import * as React from "react";
import {
  ProCommentThreads,
  type CommentAdapter,
  type CommentThread,
  type CommentUser,
} from "@/components/crm/pro-comment-threads";

const users: CommentUser[] = [
  { id: "maya", name: "Maya Chen", title: "Head of Product" },
  { id: "omar", name: "Omar Haddad", title: "Staff Engineer" },
  { id: "priya", name: "Priya Nair", title: "Legal Counsel" },
  { id: "lukas", name: "Lukas Weber", title: "Security Lead" },
  { id: "ana", name: "Ana Souza", title: "Design Lead" },
  { id: "jin", name: "Jin Park", title: "Data Engineer" },
  { id: "sofia", name: "Sofia Rossi", title: "Customer Success" },
  { id: "david", name: "David Okafor", title: "VP Sales" },
];

const sections = [
  "Background",
  "Goals and non-goals",
  "Data retention",
  "Access control",
  "Billing changes",
  "Rollout plan",
  "Risks",
  "Open questions",
];
const sentences = [
  "Enterprise workspaces will be able to export every audit event as signed JSON within five minutes of the request.",
  "We keep raw events for 400 days and aggregated metrics for seven years to satisfy SOC 2 and customer contracts.",
  "Admins can scope API tokens to a single pipeline, and tokens without an expiry are rejected after the migration window.",
  "Seat-based plans move to usage tiers, billed monthly in arrears, with a hard cap that the owner can raise at any time.",
  "The rollout starts with 5% of workspaces in the EU region, gated by the export_v2 flag and watched on the error budget.",
  "Customers on legacy contracts keep their current pricing until renewal, and CSMs get a report of affected accounts.",
  "If the queue backs up beyond 15 minutes we pause new exports and page the on-call engineer through the usual rotation.",
  "SSO-enforced workspaces must not allow password logins for guests, including the new read-only reviewer role.",
];
const replies = [
  "Agreed, let's capture this in the rollout checklist.",
  "Can we get numbers from last quarter before committing?",
  "Legal is fine with this wording as long as the DPA reference stays.",
  "I'd rather we ship behind the flag first and revisit.",
  "Updated the dashboard, the p95 is now under 900 ms.",
  "Looping in the account team, three renewals depend on this.",
];

/** Builds a 64-paragraph spec with ~220 anchored threads. */
function buildFixture() {
  const threads: CommentThread[] = [];
  const now = Date.now();
  let seq = 0;
  const parts: string[] = ["<h1>Audit export v2 — product spec</h1>"];
  for (let s = 0; s < sections.length; s++) {
    parts.push(`<h2>${s + 1}. ${sections[s]}</h2>`);
    for (let p = 0; p < 8; p++) {
      const text = sentences[(s * 3 + p) % sentences.length]!;
      const words = text.split(" ");
      const commented = (s * 8 + p) % 7 !== 3;
      if (!commented) {
        parts.push(`<p>${text} ${sentences[(p + 2) % sentences.length]}</p>`);
        continue;
      }
      const n = 1 + ((s + p) % 5 === 0 ? 1 : 0);
      let html = "";
      let cursor = 0;
      for (let k = 0; k < n; k++) {
        const start = cursor + 2 + ((s + p + k) % 3);
        const end = Math.min(words.length, start + 3 + ((p + k) % 4));
        if (start >= words.length) break;
        const id = `th_${++seq}`;
        const quote = words.slice(start, end).join(" ");
        html += `${words.slice(cursor, start).join(" ")} <span data-comment-id="${id}">${quote}</span> `;
        cursor = end;
        const author = users[seq % users.length]!;
        const created = now - (seq * 47 + 30) * 60_000;
        const replyCount = seq % 4;
        const mentioned = users[(seq + 3) % users.length]!;
        threads.push({
          id,
          quote,
          resolved: seq % 5 === 0,
          resolvedBy: seq % 5 === 0 ? users[(seq + 1) % users.length]!.id : undefined,
          resolvedAt: seq % 5 === 0 ? new Date(created + 3_600_000).toISOString() : undefined,
          createdAt: new Date(created).toISOString(),
          comments: [
            {
              id: `${id}-c0`,
              authorId: author.id,
              body: `@${mentioned.name} is “${quote}” what we promised in the contract?`,
              mentions: [mentioned.id],
              createdAt: new Date(created).toISOString(),
              reactions:
                seq % 3 === 0 ? [{ emoji: "👀", userIds: [users[(seq + 2) % 8]!.id] }] : [],
            },
            ...Array.from({ length: replyCount }, (_, r) => ({
              id: `${id}-c${r + 1}`,
              authorId: users[(seq + r + 1) % users.length]!.id,
              body: replies[(seq + r) % replies.length]!,
              mentions: [],
              createdAt: new Date(created + (r + 1) * 900_000).toISOString(),
              reactions: r === 0 ? [{ emoji: "👍", userIds: ["maya", "omar"] }] : [],
            })),
          ],
        });
      }
      html += words.slice(cursor).join(" ");
      parts.push(`<p>${html}</p>`);
    }
  }
  return { html: parts.join(""), threads };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** In-memory "server" with latency and an optional failure rate to show rollbacks. */
function createMemoryAdapter(
  seed: CommentThread[],
  flaky: React.RefObject<boolean>,
): CommentAdapter {
  let db = structuredClone(seed);
  const maybeFail = async () => {
    await wait(350 + Math.random() * 400);
    if (flaky.current && Math.random() < 0.5) throw new Error("503 Service Unavailable");
  };
  const edit = (id: string, fn: (t: CommentThread) => CommentThread) => {
    db = db.map((t) => (t.id === id ? fn(t) : t));
  };
  return {
    async listThreads() {
      await wait(500);
      return structuredClone(db);
    },
    async createThread(_doc, input, authorId) {
      await maybeFail();
      const now = new Date().toISOString();
      const thread: CommentThread = {
        id: input.id,
        quote: input.quote,
        resolved: false,
        createdAt: now,
        comments: [
          {
            id: `${input.id}-c0`,
            authorId,
            body: input.body,
            mentions: input.mentions,
            createdAt: now,
            reactions: [],
          },
        ],
      };
      db = [...db, thread];
      return thread;
    },
    async addReply(_doc, threadId, input, authorId) {
      await maybeFail();
      const c = { ...input, authorId, createdAt: new Date().toISOString(), reactions: [] };
      edit(threadId, (t) => ({ ...t, comments: [...t.comments, c] }));
      return c;
    },
    async toggleReaction(_doc, threadId, commentId, emoji, userId) {
      await maybeFail();
      edit(threadId, (t) => ({
        ...t,
        comments: t.comments.map((c) => {
          if (c.id !== commentId) return c;
          const r = c.reactions.find((x) => x.emoji === emoji);
          if (!r) return { ...c, reactions: [...c.reactions, { emoji, userIds: [userId] }] };
          const ids = r.userIds.includes(userId)
            ? r.userIds.filter((u) => u !== userId)
            : [...r.userIds, userId];
          return {
            ...c,
            reactions: ids.length
              ? c.reactions.map((x) => (x.emoji === emoji ? { emoji, userIds: ids } : x))
              : c.reactions.filter((x) => x.emoji !== emoji),
          };
        }),
      }));
    },
    async setResolved(_doc, threadId, resolved, userId) {
      await maybeFail();
      edit(threadId, (t) => ({
        ...t,
        resolved,
        resolvedBy: resolved ? userId : undefined,
        resolvedAt: resolved ? new Date().toISOString() : undefined,
      }));
    },
    async deleteComment(_doc, threadId, commentId) {
      await maybeFail();
      edit(threadId, (t) => ({ ...t, comments: t.comments.filter((c) => c.id !== commentId) }));
    },
  };
}

export default function Example() {
  const fixture = React.useMemo(buildFixture, []);
  const flaky = React.useRef(false);
  const [isFlaky, setFlaky] = React.useState(false);
  const adapter = React.useMemo(() => createMemoryAdapter(fixture.threads, flaky), [fixture]);
  const [log, setLog] = React.useState<string[]>([]);

  return (
    <div className="my-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-crm-soft">
        <span>
          Signed in as <strong className="text-crm-fg">Maya Chen</strong> · {fixture.threads.length}{" "}
          threads on this spec
        </span>
        <label className="ml-auto inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={isFlaky}
            onChange={(e) => {
              flaky.current = e.target.checked;
              setFlaky(e.target.checked);
            }}
          />
          Simulate flaky network (50% of writes fail and roll back)
        </label>
      </div>
      <ProCommentThreads
        documentId="spec-audit-export-v2"
        content={fixture.html}
        adapter={adapter}
        users={users}
        currentUserId="maya"
        height={620}
        onError={(err, action) =>
          setLog((l) =>
            [`${new Date().toLocaleTimeString()} ${action} failed: ${String(err)}`, ...l].slice(
              0,
              3,
            ),
          )
        }
      />
      {log.length > 0 && (
        <ul className="text-xs text-crm-subtle">
          {log.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
