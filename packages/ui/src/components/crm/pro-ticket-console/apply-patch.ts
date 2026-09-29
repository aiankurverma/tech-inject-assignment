import type { Ticket, TicketPatch } from "@/components/crm/pro-ticket-console/types";

/** Applies a patch to every ticket whose id is in `ids`; untouched tickets keep identity. */
export function applyPatch(tickets: Ticket[], ids: ReadonlySet<string>, patch: TicketPatch) {
  const stamp = new Date().toISOString();
  return tickets.map((t) => {
    if (!ids.has(t.id)) return t;
    let tags = t.tags;
    if (patch.addTags?.length) tags = [...new Set([...tags, ...patch.addTags])];
    if (patch.removeTags?.length) tags = tags.filter((x) => !patch.removeTags!.includes(x));
    return {
      ...t,
      status: patch.status ?? t.status,
      priority: patch.priority ?? t.priority,
      assignee: patch.assignee !== undefined ? patch.assignee : t.assignee,
      unread: patch.unread ?? t.unread,
      tags,
      updatedAt: stamp,
    };
  });
}

/** In-memory fallback so persisted layouts never throw in sandboxed iframes or private windows. */
export function createSafeStorage(): Pick<Storage, "getItem" | "setItem"> {
  const mem = new Map<string, string>();
  return {
    getItem(k) {
      try {
        return window.localStorage.getItem(k) ?? mem.get(k) ?? null;
      } catch {
        return mem.get(k) ?? null;
      }
    },
    setItem(k, v) {
      mem.set(k, v);
      try {
        window.localStorage.setItem(k, v);
      } catch {
        /* storage blocked: keep in memory */
      }
    },
  };
}
