/** Pure tree operations. Every function returns a new tree (immer) and never mutates its input. */
import { produce } from "immer";
import type { LayoutType, NodeType, PageNode } from "./types";

export const ROOT_ID = "page";

let counter = 0;
/** Short unique id: time + counter + randomness, safe for use in DOM ids. */
export function createId(): string {
  counter = (counter + 1) % 1296;
  return `n${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createPage(): PageNode {
  return { id: ROOT_ID, type: "page", props: {}, children: [] };
}

export function createLayoutNode(type: LayoutType, props: Record<string, unknown> = {}): PageNode {
  return { id: createId(), type, props, children: [] };
}

export function createComponentNode(slug: string, props: Record<string, unknown> = {}): PageNode {
  return { id: createId(), type: "component", slug, props, children: [] };
}

/** Which node types may sit inside which. Components are leaves. */
const CONTAINS: Record<NodeType, readonly NodeType[]> = {
  page: ["section", "row", "component"],
  section: ["row", "column", "component"],
  row: ["column", "component"],
  column: ["row", "component"],
  component: [],
};

export function canContain(parent: NodeType, child: NodeType): boolean {
  return CONTAINS[parent].includes(child);
}

export const isContainer = (node: PageNode) => node.type !== "component";

export function findNode(tree: PageNode, id: string): PageNode | null {
  if (tree.id === id) return tree;
  for (const child of tree.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

/** Parent and position of `id`; null for the root or an unknown id. */
export function findParent(tree: PageNode, id: string): { parent: PageNode; index: number } | null {
  const index = tree.children.findIndex((c) => c.id === id);
  if (index !== -1) return { parent: tree, index };
  for (const child of tree.children) {
    const hit = findParent(child, id);
    if (hit) return hit;
  }
  return null;
}

/** True when `id` is `ancestorId` itself or sits anywhere below it. */
export function isWithin(tree: PageNode, ancestorId: string, id: string): boolean {
  const ancestor = findNode(tree, ancestorId);
  return ancestor ? findNode(ancestor, id) !== null : false;
}

export function walk(tree: PageNode, fn: (node: PageNode, depth: number) => void, depth = 0): void {
  fn(tree, depth);
  for (const child of tree.children) walk(child, fn, depth + 1);
}

/** Number of nodes below the root. */
export function countNodes(tree: PageNode): number {
  let n = -1;
  walk(tree, () => n++);
  return n;
}

/** Distinct component slugs in document order. */
export function usedSlugs(tree: PageNode): string[] {
  const out: string[] = [];
  walk(tree, (n) => {
    if (n.type === "component" && n.slug && !out.includes(n.slug)) out.push(n.slug);
  });
  return out;
}

/**
 * Inserts `node` under `parentId` at `index` (appends when omitted or out of range).
 * Returns the input tree unchanged when the parent is unknown or cannot hold the node.
 */
export function insertNode(
  tree: PageNode,
  parentId: string,
  node: PageNode,
  index?: number,
): PageNode {
  const parent = findNode(tree, parentId);
  if (!parent || !canContain(parent.type, node.type)) return tree;
  return produce(tree, (draft) => {
    const p = findNode(draft, parentId)!;
    const at =
      index === undefined ? p.children.length : Math.max(0, Math.min(index, p.children.length));
    p.children.splice(at, 0, node);
  });
}

export function removeNode(tree: PageNode, id: string): PageNode {
  if (id === tree.id || !findParent(tree, id)) return tree;
  return produce(tree, (draft) => {
    const hit = findParent(draft, id)!;
    hit.parent.children.splice(hit.index, 1);
  });
}

/**
 * Moves `id` under `parentId` at `index` (array-move semantics: the index refers to the list
 * after the node has been taken out). Refuses to move the root, into itself or into a descendant.
 */
export function moveNode(tree: PageNode, id: string, parentId: string, index: number): PageNode {
  const node = findNode(tree, id);
  const target = findNode(tree, parentId);
  if (!node || !target || id === tree.id) return tree;
  if (isWithin(tree, id, parentId) || !canContain(target.type, node.type)) return tree;
  const without = removeNode(tree, id);
  return insertNode(without, parentId, node, index);
}

/** Moves a node up (-1) or down (+1) among its siblings. */
export function shiftNode(tree: PageNode, id: string, delta: -1 | 1): PageNode {
  const hit = findParent(tree, id);
  if (!hit) return tree;
  const next = hit.index + delta;
  if (next < 0 || next >= hit.parent.children.length) return tree;
  return moveNode(tree, id, hit.parent.id, next);
}

/** Deep copy with fresh ids so the clone can live in the same tree. */
export function cloneNode(node: PageNode): PageNode {
  return {
    ...node,
    id: createId(),
    props: structuredClone(node.props),
    children: node.children.map(cloneNode),
  };
}

/** Inserts a copy right after the original; returns the tree and the copy's id. */
export function duplicateNode(tree: PageNode, id: string): { tree: PageNode; id: string | null } {
  const hit = findParent(tree, id);
  if (!hit) return { tree, id: null };
  const copy = cloneNode(hit.parent.children[hit.index]!);
  return { tree: insertNode(tree, hit.parent.id, copy, hit.index + 1), id: copy.id };
}

/** Replaces one prop; `undefined` deletes it. */
export function setProp(tree: PageNode, id: string, name: string, value: unknown): PageNode {
  if (!findNode(tree, id)) return tree;
  return produce(tree, (draft) => {
    const n = findNode(draft, id)!;
    if (value === undefined) delete n.props[name];
    else n.props[name] = value;
  });
}

/** Replaces the whole props object (JSON editor). */
export function replaceProps(tree: PageNode, id: string, props: Record<string, unknown>): PageNode {
  if (!findNode(tree, id)) return tree;
  return produce(tree, (draft) => {
    findNode(draft, id)!.props = props;
  });
}

/** Runtime check for trees read back from storage or pasted JSON. */
export function isPageNode(value: unknown, depth = 0): value is PageNode {
  if (depth > 64 || typeof value !== "object" || value === null) return false;
  const n = value as Partial<PageNode>;
  const okType = typeof n.type === "string" && n.type in CONTAINS;
  return (
    typeof n.id === "string" &&
    okType &&
    typeof n.props === "object" &&
    n.props !== null &&
    Array.isArray(n.children) &&
    (n.type !== "component" || typeof n.slug === "string") &&
    n.children.every((c) => isPageNode(c, depth + 1))
  );
}
