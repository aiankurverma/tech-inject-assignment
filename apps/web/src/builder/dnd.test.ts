import { describe, expect, it } from "vitest";
import { dropId, resolveDrop } from "./dnd";
import { createComponentNode, createLayoutNode, createPage, insertNode } from "./tree";

describe("resolveDrop", () => {
  const row = createLayoutNode("row");
  const a = createComponentNode("a");
  const b = createComponentNode("b");
  let tree = createPage();
  tree = insertNode(tree, "page", row);
  tree = insertNode(tree, row.id, a);
  tree = insertNode(tree, row.id, b);

  it("appends on a container drop zone or the root", () => {
    expect(resolveDrop(tree, dropId(row.id))).toEqual({ parentId: row.id, index: 2 });
    expect(resolveDrop(tree, "page")).toEqual({ parentId: "page", index: 1 });
  });

  it("inserts at a sibling's position", () => {
    expect(resolveDrop(tree, b.id)).toEqual({ parentId: row.id, index: 1 });
    expect(resolveDrop(tree, row.id)).toEqual({ parentId: "page", index: 0 });
  });

  it("returns null for unknown targets", () => {
    expect(resolveDrop(tree, "nope")).toBeNull();
    expect(resolveDrop(tree, dropId("nope"))).toBeNull();
  });
});
