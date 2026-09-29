import * as Y from "yjs";
import type { Editor, JSONContent } from "@tiptap/react";

/*
 * In-house ProseMirror <-> Yjs binding (y-prosemirror is not an approved dependency).
 *
 * Model: the document is stored as two top-level Yjs types
 *   `${field}:order`  Y.Array<string>  ordered top-level block ids
 *   `${field}:blocks` Y.Map<string>    block id -> JSON of that block
 * Local edits diff the block list (common prefix/suffix, O(n)) and only rewrite changed blocks, so
 * concurrent edits to different blocks merge cleanly; concurrent edits to the same block resolve
 * last-writer-wins on that block. Remote changes are applied to the editor with a minimal
 * ProseMirror replace (Fragment.findDiffStart/End), which keeps the local selection stable and is
 * excluded from undo history. Trade-off vs. y-prosemirror: no character-level merge inside a block.
 */

type PMNode = Editor["state"]["doc"];

export const REMOTE_META = "kitbaseYjsRemote";
const LOCAL_ORIGIN = { source: "kitbase-editor" };

/** The subset of y-protocols' Awareness this editor needs (y-websocket's provider.awareness fits). */
export interface AwarenessLike {
  clientID: number;
  getLocalState(): Record<string, unknown> | null;
  setLocalStateField(field: string, value: unknown): void;
  getStates(): Map<number, Record<string, unknown>>;
  on(event: "change", cb: (...args: unknown[]) => void): void;
  off(event: "change", cb: (...args: unknown[]) => void): void;
}

export interface CollabUser {
  name: string;
  color: string;
}

export interface CollaborationConfig {
  doc: Y.Doc;
  awareness?: AwarenessLike;
  user: CollabUser;
  /** Prefix of the shared types inside the Y.Doc. */
  field?: string;
}

/** Cursor stored in awareness as block id + offset, so it survives concurrent edits elsewhere. */
export interface BlockCursor {
  bid: string;
  offset: number;
}

let idCounter = 0;
export function newBlockId() {
  idCounter = (idCounter + 1) % 1e6;
  return `b${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Give every top-level block a unique id. Returns true if a transaction was dispatched. */
function ensureBlockIds(editor: Editor): boolean {
  const { state } = editor;
  const seen = new Set<string>();
  const fixes: { pos: number; node: PMNode }[] = [];
  state.doc.forEach((node, offset) => {
    if (!("bid" in node.attrs)) return;
    const bid = node.attrs.bid as string | null;
    if (!bid || seen.has(bid)) fixes.push({ pos: offset, node });
    else seen.add(bid);
  });
  if (!fixes.length) return false;
  const tr = state.tr;
  for (const f of fixes) tr.setNodeMarkup(f.pos, undefined, { ...f.node.attrs, bid: newBlockId() });
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
  return true;
}

const jsonCache = new WeakMap<object, string>();
function blockJson(node: PMNode): string {
  let s = jsonCache.get(node);
  if (s === undefined) {
    s = JSON.stringify(node.toJSON());
    jsonCache.set(node, s);
  }
  return s;
}

/**
 * Bind a Tiptap editor to a Y.Doc. Returns an unbind function.
 * The editor must include the BlockId extension (ProRichTextEditor always does).
 */
export function bindEditorToYDoc(editor: Editor, doc: Y.Doc, field = "kitbase"): () => void {
  const order = doc.getArray<string>(`${field}:order`);
  const blocks = doc.getMap<string>(`${field}:blocks`);
  let applyingRemote = false;

  const push = () => {
    if (ensureBlockIds(editor)) return; // the follow-up update pushes
    const ids: string[] = [];
    const json: string[] = [];
    editor.state.doc.forEach((node) => {
      const bid = node.attrs.bid as string | undefined;
      if (!bid) return;
      ids.push(bid);
      json.push(blockJson(node));
    });
    doc.transact(() => {
      const prev = order.toArray();
      let start = 0;
      while (start < prev.length && start < ids.length && prev[start] === ids[start]) start++;
      let endPrev = prev.length;
      let endNext = ids.length;
      while (endPrev > start && endNext > start && prev[endPrev - 1] === ids[endNext - 1]) {
        endPrev--;
        endNext--;
      }
      if (endPrev > start) order.delete(start, endPrev - start);
      if (endNext > start) order.insert(start, ids.slice(start, endNext));
      const keep = new Set(ids);
      for (const id of prev) if (!keep.has(id)) blocks.delete(id);
      ids.forEach((id, i) => {
        if (blocks.get(id) !== json[i]) blocks.set(id, json[i]!);
      });
    }, LOCAL_ORIGIN);
  };

  const pull = () => {
    const content: JSONContent[] = [];
    for (const id of order.toArray()) {
      const raw = blocks.get(id);
      if (!raw) continue;
      try {
        content.push(JSON.parse(raw) as JSONContent);
      } catch {
        /* skip corrupt block */
      }
    }
    if (!content.length) content.push({ type: "paragraph" });
    let next: PMNode;
    try {
      next = editor.schema.nodeFromJSON({ type: "doc", content });
    } catch {
      return; // schema mismatch between peers; ignore the update
    }
    const cur = editor.state.doc;
    const start = cur.content.findDiffStart(next.content);
    if (start == null) return;
    let { a: endA, b: endB } = cur.content.findDiffEnd(next.content)!;
    const overlap = start - Math.min(endA, endB);
    if (overlap > 0) {
      endA += overlap;
      endB += overlap;
    }
    const tr = editor.state.tr.replace(start, endA, next.slice(start, endB));
    tr.setMeta("addToHistory", false).setMeta(REMOTE_META, true);
    applyingRemote = true;
    try {
      editor.view.dispatch(tr);
    } finally {
      applyingRemote = false;
    }
  };

  const onUpdate = ({ transaction }: { transaction: { getMeta(k: string): unknown } }) => {
    if (applyingRemote || transaction.getMeta(REMOTE_META)) return;
    push();
  };
  const onDocUpdate = (_u: Uint8Array, origin: unknown) => {
    if (origin !== LOCAL_ORIGIN) pull();
  };

  // Listen first: assigning block ids during the initial push dispatches an update of its own.
  editor.on("update", onUpdate);
  doc.on("update", onDocUpdate);

  // Initial sync: an empty room is seeded by a non-empty editor, otherwise the room wins.
  if (order.length === 0) {
    if (!editor.isEmpty) push();
  } else pull();
  return () => {
    editor.off("update", onUpdate);
    doc.off("update", onDocUpdate);
  };
}

/** Convert the editor selection head to a block-relative cursor. */
export function cursorFromEditor(editor: Editor): BlockCursor | null {
  const head = editor.state.selection.head;
  let found: BlockCursor | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (found || head < offset || head > offset + node.nodeSize) return;
    const bid = node.attrs.bid as string | undefined;
    if (bid) found = { bid, offset: head - offset };
  });
  return found;
}

/** Resolve a remote block-relative cursor to a position in this editor, or null. */
export function positionFromCursor(editor: Editor, cursor: BlockCursor): number | null {
  let pos: number | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (pos === null && node.attrs.bid === cursor.bid)
      pos = offset + Math.min(Math.max(1, cursor.offset), node.nodeSize - 1);
  });
  return pos;
}

/**
 * In-memory room linking several Y.Docs and awareness instances in one tab: for demos, tests and
 * storybooks. In production pass a provider's doc + awareness (e.g. y-websocket) instead.
 */
export function createLocalCollabRoom({ latency = 60 }: { latency?: number } = {}) {
  const peers = new Set<Y.Doc>();
  const states = new Map<number, Record<string, unknown>>();
  const listeners = new Set<(...args: unknown[]) => void>();
  const notify = () => listeners.forEach((l) => l());
  const later = (fn: () => void) => (latency ? window.setTimeout(fn, latency) : fn());
  const ROOM = { source: "local-room" };

  function join(): { doc: Y.Doc; awareness: AwarenessLike; leave: () => void } {
    const doc = new Y.Doc();
    // Catch up with the room state.
    const first = peers.values().next().value;
    if (first) Y.applyUpdate(doc, Y.encodeStateAsUpdate(first), ROOM);
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === ROOM) return;
      later(() => peers.forEach((p) => p !== doc && Y.applyUpdate(p, update, ROOM)));
    };
    doc.on("update", onUpdate);
    peers.add(doc);
    const awareness: AwarenessLike = {
      clientID: doc.clientID,
      getLocalState: () => states.get(doc.clientID) ?? null,
      setLocalStateField(k, v) {
        states.set(doc.clientID, { ...(states.get(doc.clientID) ?? {}), [k]: v });
        later(notify);
      },
      getStates: () => states,
      on: (_e, cb) => listeners.add(cb),
      off: (_e, cb) => listeners.delete(cb),
    };
    return {
      doc,
      awareness,
      leave() {
        doc.off("update", onUpdate);
        peers.delete(doc);
        states.delete(doc.clientID);
        notify();
      },
    };
  }
  return { join };
}
