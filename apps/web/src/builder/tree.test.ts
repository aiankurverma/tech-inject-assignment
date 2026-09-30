import { describe, expect, it } from "vitest";
import {
  canContain,
  countNodes,
  createComponentNode,
  createLayoutNode,
  createPage,
  duplicateNode,
  findNode,
  findParent,
  insertNode,
  isPageNode,
  isWithin,
  moveNode,
  removeNode,
  replaceProps,
  setProp,
  shiftNode,
  usedSlugs,
} from "./tree";
import type { PageNode } from "./types";

/** page > section > [row > [button, badge], kpi] */
function fixture() {
  const button = createComponentNode("button", { variant: "primary" });
  const badge = createComponentNode("badge");
  const kpi = createComponentNode("kpi-tile");
  const row = createLayoutNode("row");
  const section = createLayoutNode("section");
  let tree = createPage();
  tree = insertNode(tree, "page", section);
  tree = insertNode(tree, section.id, row);
  tree = insertNode(tree, row.id, button);
  tree = insertNode(tree, row.id, badge);
  tree = insertNode(tree, section.id, kpi);
  return { tree, section, row, button, badge, kpi };
}

const ids = (n: PageNode) => n.children.map((c) => c.id);

describe("tree ops", () => {
  it("builds the fixture immutably", () => {
    const { tree, section, row, button, badge, kpi } = fixture();
    expect(ids(tree)).toEqual([section.id]);
    expect(ids(findNode(tree, section.id)!)).toEqual([row.id, kpi.id]);
    expect(ids(findNode(tree, row.id)!)).toEqual([button.id, badge.id]);
    expect(countNodes(tree)).toBe(5);
    expect(usedSlugs(tree)).toEqual(["button", "badge", "kpi-tile"]);
    // The original page object was never mutated.
    expect(createPage().children).toEqual([]);
  });

  it("enforces containment rules", () => {
    expect(canContain("page", "section")).toBe(true);
    expect(canContain("page", "column")).toBe(false);
    expect(canContain("component", "component")).toBe(false);
    const { tree, button } = fixture();
    const before = tree;
    expect(insertNode(tree, button.id, createComponentNode("x"))).toBe(before);
    expect(insertNode(tree, "page", createLayoutNode("column"))).toBe(before);
    expect(insertNode(tree, "nope", createLayoutNode("row"))).toBe(before);
  });

  it("inserts at an index and clamps out-of-range indexes", () => {
    const { tree, row } = fixture();
    const mid = createComponentNode("mid");
    const t1 = insertNode(tree, row.id, mid, 1);
    expect(ids(findNode(t1, row.id)!)[1]).toBe(mid.id);
    const t2 = insertNode(tree, row.id, mid, 99);
    expect(ids(findNode(t2, row.id)!).at(-1)).toBe(mid.id);
    const t3 = insertNode(tree, row.id, mid, -5);
    expect(ids(findNode(t3, row.id)!)[0]).toBe(mid.id);
  });

  it("removes nodes but never the root", () => {
    const { tree, row, button } = fixture();
    const t = removeNode(tree, row.id);
    expect(findNode(t, row.id)).toBeNull();
    expect(findNode(t, button.id)).toBeNull();
    expect(removeNode(tree, "page")).toBe(tree);
    expect(removeNode(tree, "missing")).toBe(tree);
  });

  it("moves across parents and reorders within a parent", () => {
    const { tree, section, row, button, badge, kpi } = fixture();
    const t1 = moveNode(tree, kpi.id, row.id, 0);
    expect(ids(findNode(t1, row.id)!)).toEqual([kpi.id, button.id, badge.id]);
    expect(ids(findNode(t1, section.id)!)).toEqual([row.id]);
    // Array-move semantics within the same parent.
    const t2 = moveNode(tree, button.id, row.id, 1);
    expect(ids(findNode(t2, row.id)!)).toEqual([badge.id, button.id]);
  });

  it("refuses cycles, root moves and invalid parents", () => {
    const { tree, section, row, button } = fixture();
    expect(moveNode(tree, section.id, row.id, 0)).toBe(tree); // into own descendant
    expect(moveNode(tree, row.id, row.id, 0)).toBe(tree); // into itself
    expect(moveNode(tree, "page", row.id, 0)).toBe(tree);
    expect(moveNode(tree, row.id, button.id, 0)).toBe(tree); // component is a leaf
    expect(isWithin(tree, section.id, button.id)).toBe(true);
    expect(isWithin(tree, row.id, section.id)).toBe(false);
  });

  it("shifts siblings and stops at the edges", () => {
    const { tree, row, button, badge } = fixture();
    const down = shiftNode(tree, button.id, 1);
    expect(ids(findNode(down, row.id)!)).toEqual([badge.id, button.id]);
    expect(shiftNode(tree, button.id, -1)).toBe(tree);
    expect(shiftNode(tree, badge.id, 1)).toBe(tree);
  });

  it("duplicates a subtree with fresh ids right after the original", () => {
    const { tree, section, row, button } = fixture();
    const { tree: t, id } = duplicateNode(tree, row.id);
    const sec = findNode(t, section.id)!;
    expect(sec.children).toHaveLength(3);
    expect(sec.children[1]!.id).toBe(id);
    const copy = findNode(t, id!)!;
    expect(copy.children).toHaveLength(2);
    expect(copy.children[0]!.id).not.toBe(button.id);
    expect(copy.children[0]!.props).toEqual({ variant: "primary" });
    expect(copy.children[0]!.props).not.toBe(button.props);
    expect(duplicateNode(tree, "page").id).toBeNull();
  });

  it("edits props", () => {
    const { tree, button } = fixture();
    const t1 = setProp(tree, button.id, "size", "lg");
    expect(findNode(t1, button.id)!.props).toEqual({ variant: "primary", size: "lg" });
    const t2 = setProp(t1, button.id, "variant", undefined);
    expect(findNode(t2, button.id)!.props).toEqual({ size: "lg" });
    const t3 = replaceProps(t2, button.id, { loading: true });
    expect(findNode(t3, button.id)!.props).toEqual({ loading: true });
    expect(findParent(t3, button.id)!.index).toBe(0);
    expect(setProp(tree, "missing", "a", 1)).toBe(tree);
  });

  it("validates trees read from storage", () => {
    const { tree } = fixture();
    expect(isPageNode(JSON.parse(JSON.stringify(tree)))).toBe(true);
    expect(isPageNode(null)).toBe(false);
    expect(isPageNode({ id: "x", type: "hero", props: {}, children: [] })).toBe(false);
    expect(isPageNode({ id: "x", type: "component", props: {}, children: [] })).toBe(false);
    expect(isPageNode({ id: "x", type: "row", props: {}, children: [{}] })).toBe(false);
  });
});
