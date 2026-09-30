/** Page builder data model: a JSON tree of layout and component nodes. */

export type LayoutType = "section" | "row" | "column";
export type NodeType = "page" | LayoutType | "component";

export interface PageNode {
  id: string;
  type: NodeType;
  /** Registry slug; only for `type === "component"`. */
  slug?: string;
  props: Record<string, unknown>;
  children: PageNode[];
}

/** One documented prop from a registry entry (`props` in the bundle JSON). */
export interface PropDoc {
  name: string;
  type: string;
  default?: string;
  required: boolean;
  description: string;
}

/** Subset of `GET /api/components/:slug` the builder reads. */
export interface ComponentDetail {
  slug: string;
  name: string;
  category: string;
  access: "free" | "premium";
  locked: null | "sign_in_required" | "premium_required";
  props?: PropDoc[];
  dependencies?: string[];
  examples?: { title: string; code: string }[];
  files?: { path: string; content: string }[];
  installCommand?: string;
}

/** What code generation needs to know about a component. */
export interface ComponentMeta {
  slug: string;
  name: string;
  exportName: string;
  importPath: string;
  installCommand: string;
  dependencies: string[];
}
