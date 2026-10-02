#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertSafeApi,
  checkRegistryItem,
  parseArgs,
  parseTarget,
  planWrites,
  registryUrl,
} from "../lib.js";
import { DEFAULT_API } from "../config.js";

const HELP = `Kitbase installer

Usage:
  kitbase add <slug> [--src src] [--overwrite] [--dry-run] [--api URL]
  kitbase add @<team>/<slug> ...   (a team's private component)

Premium and team components: set KITBASE_TOKEN in your shell (create one on your Account page,
or a team token under Team > Tokens). The token is only ever read from that variable.
Files are written only inside <project>/<src>. Changed files are never overwritten unless --overwrite is passed.
Dependencies are printed, not installed.`;

/** One-line hint for a failed registry request. */
function errorHint(status, code, target, token, message) {
  const name = target.team ? `@${target.team}/${target.slug}` : target.slug;
  if (status === 401 && code === "token_scope")
    return " Team tokens only install @team/... components.";
  if (status === 401 && target.team)
    return ` ${name} is private. Set KITBASE_TOKEN to your personal token (Account) or a team token (Team > Tokens).`;
  if (status === 404 && target.team)
    return ` Not found in @${target.team}, or you are not a member of @${target.team}.`;
  if (status === 401 && !token && !message.includes("KITBASE_TOKEN"))
    return " Set KITBASE_TOKEN to a token from your Account page.";
  return "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== "add" || !args.slug) {
    console.log(HELP);
    process.exit(args.command ? 1 : 0);
  }
  const target = parseTarget(args.slug);

  const api = (args.api ?? process.env.KITBASE_API ?? DEFAULT_API).replace(/\/+$/, "");
  const token = process.env.KITBASE_TOKEN;
  assertSafeApi(api, !!token);
  const res = await fetch(registryUrl(api, target), {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.message ?? `Request failed (${res.status}).`;
    throw new Error(`${message}${errorHint(res.status, body.error, target, token, message)}`);
  }
  const item = checkRegistryItem(await res.json());

  const root = process.cwd();
  if (!existsSync(path.join(root, "package.json"))) {
    throw new Error("Run this from your project root (no package.json found here).");
  }
  const plan = planWrites(item.files, {
    root,
    srcDir: args.src,
    overwrite: args.overwrite,
    readExisting: (abs) => (existsSync(abs) ? readFileSync(abs, "utf8") : null),
  });

  const conflicts = plan.filter((p) => p.action === "conflict");
  if (conflicts.length) {
    console.error("These files already exist with different content:");
    for (const c of conflicts) console.error(`  ${args.src}/${c.path}`);
    console.error("Nothing was written. Re-run with --overwrite to replace them.");
    process.exit(2);
  }

  for (const p of plan) {
    const label = { create: "created  ", overwrite: "replaced ", unchanged: "unchanged" }[p.action];
    if (!args.dryRun && p.action !== "unchanged") {
      mkdirSync(path.dirname(p.abs), { recursive: true });
      writeFileSync(p.abs, p.content);
    }
    console.log(`${args.dryRun ? "[dry-run] " : ""}${label} ${args.src}/${p.path}`);
  }

  console.log(`\n${item.name} v${item.version} added.\nNext steps:`);
  console.log(`  1. npm install ${item.dependencies.join(" ")}`);
  console.log(
    `  2. Start your main CSS with these lines (font import first):\n     @import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap");\n     @import "tailwindcss";\n     @import "./styles/crm-theme.css";`,
  );
  console.log(`  3. Make sure "@/..." points to ${args.src}/ (tsconfig paths + bundler alias).`);
}

main().catch((err) => {
  console.error(`kitbase: ${err.message}`);
  process.exit(1);
});
