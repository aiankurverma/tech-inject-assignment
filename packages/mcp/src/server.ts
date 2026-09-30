import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getComponent,
  installComponent,
  listCategories,
  searchComponents,
  type ToolDeps,
} from "./tools.js";

const slug = z.string().min(1).max(100).describe('Component slug, e.g. "deal-card"');

/** Wrap a handler so results and errors both come back as MCP text content. */
function run<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      const result = await fn(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: "text" as const, text: message }] };
    }
  };
}

export function createServer(deps: ToolDeps, version = "1.0.0") {
  const server = new McpServer({ name: "kitbase", version });

  server.registerTool(
    "search_components",
    {
      description:
        "Search the Kitbase CRM component library. Returns slug, name, description, category and access (free/premium).",
      inputSchema: {
        query: z.string().max(200).describe('Keywords, e.g. "pipeline board"'),
        category: z.string().max(100).optional().describe("Exact category from list_categories"),
      },
      annotations: { readOnlyHint: true },
    },
    run((args) => searchComponents(deps, args)),
  );

  server.registerTool(
    "list_categories",
    {
      description: "List Kitbase component categories with component counts.",
      annotations: { readOnlyHint: true },
    },
    run(() => listCategories(deps)),
  );

  server.registerTool(
    "get_component",
    {
      description:
        "Get a Kitbase component's props, usage, examples and npm dependencies. Premium components need KITBASE_TOKEN.",
      inputSchema: { slug },
      annotations: { readOnlyHint: true },
    },
    run((args) => getComponent(deps, args)),
  );

  server.registerTool(
    "install_component",
    {
      description:
        "Write a Kitbase component's source files into the user's project (<dir>/<src>/...). Never overwrites changed files unless overwrite is true. Does not run npm install; returns the dependencies to install.",
      inputSchema: {
        slug,
        dir: z
          .string()
          .max(500)
          .optional()
          .describe(
            "Project root (folder with package.json). Defaults to the server's working directory.",
          ),
        src: z
          .string()
          .max(100)
          .optional()
          .describe('Source folder inside the project. Default "src".'),
        overwrite: z.boolean().optional().describe("Replace files that differ. Default false."),
        dryRun: z.boolean().optional().describe("Only report what would be written."),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    run((args) => installComponent(deps, args)),
  );

  return server;
}
