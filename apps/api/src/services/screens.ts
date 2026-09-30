import {
  catalogueSummary,
  decideAccess,
  exportPage,
  PAGE_TREE_LIMITS,
  toPageComponent,
  validatePageTree,
  type Bundle,
  type PageComponent,
  type PageExport,
  type PageNode,
  type ThemeFiles,
  type Viewer,
} from "@ti/core";
import { completeJson, type ProviderChain } from "@ti/feature-radar/server";
import { HttpError } from "../utils/http";
import { previewPayload } from "./catalog";

export interface ScreenDeps {
  theme: ThemeFiles;
  apiOrigin: string;
  /** null when no AI key is configured: /generate answers 503, /render still works. */
  chain: ProviderChain | null;
  /** Published bundles (every access level); the service filters per viewer. */
  loadPublished: () => Promise<Bundle[]>;
}

/** What the page shows: the tree plus everything needed to preview and export it. */
export type ScreenResult = PageExport & {
  tree: PageNode;
  preview: ReturnType<typeof previewPayload>;
};

const systemPrompt = (catalogue: string) =>
  [
    "You compose one screen for a dark CRM web app out of an existing React component catalogue.",
    "Output ONLY one JSON object (no prose, no markdown fences): the root page node.",
    'A node is { "id": string, "type": string, "props"?: object, "children"?: node[] }.',
    "Rules:",
    '- "type" must be a slug from the catalogue below, or "slug/Export" for one of its other exports, or "text" (props.text = a string leaf).',
    "- Never invent components, exports or props. Props must be plain JSON (strings, numbers, booleans, arrays, objects): no functions, JSX, icons or dates.",
    `- At most ${PAGE_TREE_LIMITS.maxNodes} nodes and ${PAGE_TREE_LIMITS.maxDepth} levels deep. Short unique ids.`,
    "- Start with a layout or shell component, add a page header, then the sections the user asked for. Use short realistic sample content.",
    "- Content lives in children (nodes or text leaves), not in a children prop.",
    "Catalogue (slug: description. exports. props, * = required):",
    catalogue,
  ].join("\n");

export function makeScreens(deps: ScreenDeps) {
  /** Published components this viewer may use. Locked items are left out so pages stay buildable. */
  async function components(viewer: Viewer): Promise<PageComponent[]> {
    const bundles = await deps.loadPublished();
    return bundles
      .filter((b) => decideAccess({ status: "published", access: b.access }, viewer).allowed)
      .map(toPageComponent);
  }

  function assemble(tree: PageNode, list: PageComponent[]): ScreenResult {
    const page = exportPage(tree, list, deps.apiOrigin);
    return {
      ...page,
      tree,
      preview: previewPayload(
        {
          slug: "page",
          version: "1.0.0",
          files: page.files,
          examples: [{ title: "Page", code: page.code }],
        },
        deps.theme,
      ),
    };
  }

  return {
    /** Validates a tree supplied by the client (after a manual edit) and rebuilds the page. */
    async render(tree: unknown, viewer: Viewer): Promise<ScreenResult> {
      const list = await components(viewer);
      const v = validatePageTree(tree, list);
      if (!v.ok) throw new HttpError(422, "invalid_tree", "The page tree is not valid.", v.errors);
      return assemble(v.tree, list);
    },

    /** Asks the AI for a tree; one retry with the validation errors, then gives up. */
    async generate(prompt: string, viewer: Viewer): Promise<ScreenResult> {
      if (!deps.chain)
        throw new HttpError(503, "builder_not_configured", "AI is not configured on this server.");
      const list = await components(viewer);
      if (list.length === 0)
        throw new HttpError(409, "no_components", "No published components to build from.");
      const system = systemPrompt(catalogueSummary(list));
      let user = `Screen description: "${prompt}"`;
      let errors: string[] = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await completeJson(system, user, deps.chain);
        if (!r.ok) throw new HttpError(502, "ai_failed", r.error);
        const v = validatePageTree(r.json, list);
        if (v.ok) return assemble(v.tree, list);
        errors = v.errors;
        user += `\nYour previous tree was rejected: ${errors.slice(0, 15).join("; ")}\nReturn a corrected full JSON tree.`;
      }
      throw new HttpError(422, "invalid_tree", "The AI could not build a valid page.", errors);
    },
  };
}

export type Screens = ReturnType<typeof makeScreens>;
