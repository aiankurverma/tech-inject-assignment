import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBuilderStore, STORAGE_KEY } from "./store";
import { createComponentNode, createLayoutNode, findNode, ROOT_ID } from "./tree";

/** In-memory Storage so tests never touch a real localStorage. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("builder store", () => {
  let storage: Storage;
  let store: ReturnType<typeof createBuilderStore>;
  beforeEach(() => {
    storage = memoryStorage();
    store = createBuilderStore(storage);
  });

  it("undoes and redoes tree changes, selection follows", () => {
    const s = store.getState;
    const section = createLayoutNode("section");
    const button = createComponentNode("button");
    s().insert(ROOT_ID, section);
    s().insert(section.id, button);
    expect(s().selectedId).toBe(button.id);
    expect(s().past).toHaveLength(2);

    s().undo();
    expect(findNode(s().tree, button.id)).toBeNull();
    expect(s().selectedId).toBe(ROOT_ID); // selected node vanished
    expect(s().future).toHaveLength(1);

    s().undo();
    expect(s().tree.children).toEqual([]);
    s().undo(); // nothing left: no-op
    expect(s().past).toHaveLength(0);

    s().redo();
    s().redo();
    expect(findNode(s().tree, button.id)).not.toBeNull();
    s().redo(); // no-op
    expect(s().future).toHaveLength(0);
  });

  it("clears the redo stack on a new change and ignores rejected operations", () => {
    const s = store.getState;
    const section = createLayoutNode("section");
    s().insert(ROOT_ID, section);
    s().undo();
    expect(s().future).toHaveLength(1);
    s().insert(ROOT_ID, createLayoutNode("row"));
    expect(s().future).toHaveLength(0);
    const before = s();
    s().insert(ROOT_ID, createLayoutNode("column")); // page cannot hold a column
    expect(s().tree).toBe(before.tree);
    expect(s().past).toBe(before.past);
  });

  it("moves selection to a neighbour after a delete", () => {
    const s = store.getState;
    const row = createLayoutNode("row");
    const a = createComponentNode("a");
    const b = createComponentNode("b");
    s().insert(ROOT_ID, row);
    s().insert(row.id, a);
    s().insert(row.id, b);
    s().remove(b.id);
    expect(s().selectedId).toBe(a.id);
    s().remove(a.id);
    expect(s().selectedId).toBe(row.id);
  });

  it("edits props, duplicates and shifts as undoable steps", () => {
    const s = store.getState;
    const row = createLayoutNode("row");
    const a = createComponentNode("a");
    s().insert(ROOT_ID, row);
    s().insert(row.id, a);
    s().setProp(a.id, "size", "lg");
    s().duplicate(a.id);
    const copyId = s().selectedId;
    expect(copyId).not.toBe(a.id);
    expect(findNode(s().tree, copyId)!.props).toEqual({ size: "lg" });
    s().shift(copyId, -1);
    expect(findNode(s().tree, row.id)!.children[0]!.id).toBe(copyId);
    expect(s().past).toHaveLength(5);
    s().undo();
    expect(findNode(s().tree, row.id)!.children[0]!.id).toBe(a.id);
  });

  it("collapses rapid edits of one field into a single undo step", () => {
    vi.useFakeTimers();
    try {
      const s = store.getState;
      const a = createComponentNode("a");
      s().insert(ROOT_ID, a);
      s().setProp(a.id, "label", "P");
      s().setProp(a.id, "label", "Pi");
      s().setProp(a.id, "label", "Pip");
      expect(s().past).toHaveLength(2); // insert + one typing burst
      s().setProp(a.id, "value", "1"); // another field: new step
      expect(s().past).toHaveLength(3);
      vi.advanceTimersByTime(2000);
      s().setProp(a.id, "value", "12"); // same field after a pause: new step
      expect(s().past).toHaveLength(4);
      s().undo();
      expect(findNode(s().tree, a.id)!.props).toEqual({ label: "Pip", value: "1" });
      s().setProp(a.id, "value", "13"); // after undo, never merged into the restored state
      expect(s().past).toHaveLength(4);
      expect(s().future).toHaveLength(0);
      s().undo();
      expect(findNode(s().tree, a.id)!.props).toEqual({ label: "Pip", value: "1" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("persists only the tree to storage and restores it", () => {
    const s = store.getState;
    s().insert(ROOT_ID, createLayoutNode("section"));
    const raw = JSON.parse(storage.getItem(STORAGE_KEY)!) as { state: Record<string, unknown> };
    expect(Object.keys(raw.state)).toEqual(["tree"]);

    const again = createBuilderStore(storage);
    expect(again.getState().tree.children).toHaveLength(1);
    expect(again.getState().past).toEqual([]);
  });

  it("rejects corrupt persisted state and bad imports", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ state: { tree: { nope: true } }, version: 1 }));
    const fresh = createBuilderStore(storage);
    expect(fresh.getState().tree.children).toEqual([]);
    expect(fresh.getState().load({ id: "x", type: "row", props: {}, children: [] })).toBe(false);
    expect(fresh.getState().load({ id: "p", type: "page", props: {}, children: [] })).toBe(true);
    expect(fresh.getState().selectedId).toBe("p");
  });
});
