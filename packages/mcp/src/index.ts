#!/usr/bin/env node
// Kitbase MCP server over stdio. Config: KITBASE_API (default https://kitbase.onrender.com), KITBASE_TOKEN.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApi } from "./api.js";
import { createServer } from "./server.js";

const server = createServer({
  api: createApi({ api: process.env.KITBASE_API, token: process.env.KITBASE_TOKEN }),
  cwd: process.env.KITBASE_PROJECT_DIR || process.cwd(),
  fs: {
    exists: existsSync,
    read: (abs) => readFileSync(abs, "utf8"),
    write: (abs, content) => {
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    },
  },
});

server.connect(new StdioServerTransport()).catch((err: unknown) => {
  // stdout is the protocol channel; log to stderr only.
  console.error("kitbase-mcp:", err instanceof Error ? err.message : err);
  process.exit(1);
});
