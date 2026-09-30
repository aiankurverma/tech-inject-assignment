/** Drop-target resolution shared by pointer and keyboard drags. Pure, so it is unit tested. */
import { findNode, findParent } from "./tree";
import type { PageNode } from "./types";

export const DROP_PREFIX = "drop:";
/** Droppable id for the empty area at the end of a container. */
export const dropId = (containerId: string) => `${DROP_PREFIX}${containerId}`;

export interface DropTarget {
  parentId: string;
  index: number;
}

/**
 * Where a drag released over `overId` should land:
 * - a container's drop zone appends to that container;
 * - the root appends to the page;
 * - any other node inserts at that node's position (array-move semantics for reorders).
 */
export function resolveDrop(tree: PageNode, overId: string): DropTarget | null {
  if (overId.startsWith(DROP_PREFIX)) {
    const container = findNode(tree, overId.slice(DROP_PREFIX.length));
    return container ? { parentId: container.id, index: container.children.length } : null;
  }
  if (overId === tree.id) return { parentId: tree.id, index: tree.children.length };
  const hit = findParent(tree, overId);
  return hit ? { parentId: hit.parent.id, index: hit.index } : null;
}
