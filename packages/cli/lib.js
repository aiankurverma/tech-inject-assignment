// Pure installer logic (no network, no process access) so it can be unit tested.
import path from "node:path";

const SAFE_PATH =
  /^(components|lib|hooks|styles)\/[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*\.(tsx|ts|css)$/;

/**
 * Resolve a registry file path to an absolute path inside `<root>/<srcDir>`.
 * Throws for anything that could escape the target folder.
 * @param {string} root absolute project root
 * @param {string} srcDir source folder relative to root, e.g. "src"
 * @param {string} relPath path from the registry, e.g. "components/crm/button.tsx"
 */
export function resolveTarget(root, srcDir, relPath) {
  if (
    typeof relPath !== "string" ||
    relPath.includes("..") ||
    relPath.includes("\\") ||
    path.isAbsolute(relPath) ||
    !SAFE_PATH.test(relPath)
  ) {
    throw new Error(`Refusing unsafe path from registry: ${JSON.stringify(relPath)}`);
  }
  if (srcDir.includes("..") || path.isAbsolute(srcDir)) {
    throw new Error(`--src must be a folder inside the project, got ${JSON.stringify(srcDir)}`);
  }
  const base = path.resolve(root, srcDir);
  const target = path.resolve(base, relPath);
  if (!target.startsWith(base + path.sep)) {
    throw new Error(`Refusing to write outside ${base}: ${relPath}`);
  }
  return target;
}

/**
 * Decide what to do with each file. Never overwrites a changed file unless `overwrite` is true.
 * @param {{path: string, content: string}[]} files
 * @param {{root: string, srcDir: string, overwrite: boolean, readExisting: (abs: string) => string | null}} opts
 */
export function planWrites(files, opts) {
  return files.map((f) => {
    const abs = resolveTarget(opts.root, opts.srcDir, f.path);
    const existing = opts.readExisting(abs);
    let action = "create";
    if (existing !== null) {
      if (normalize(existing) === normalize(f.content)) action = "unchanged";
      else action = opts.overwrite ? "overwrite" : "conflict";
    }
    return { path: f.path, abs, content: f.content, action };
  });
}

const normalize = (s) => s.replace(/\r\n/g, "\n").trimEnd();

const TARGET_RE = /^(?:@([a-z0-9]+(?:-[a-z0-9]+)*)\/)?([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/**
 * Parse an install target: `slug` (public catalogue) or `@team/slug` (a team's private component).
 * Throws on anything else, so a bad argument can never reach the URL.
 * @param {string} arg
 * @returns {{ team?: string, slug: string }}
 */
export function parseTarget(arg) {
  const m = typeof arg === "string" ? TARGET_RE.exec(arg) : null;
  if (!m)
    throw new Error(`Invalid component name: ${JSON.stringify(arg)} (use slug or @team/slug)`);
  return m[1] ? { team: m[1], slug: m[2] } : { slug: m[2] };
}

/**
 * Registry URL for a parsed target.
 * @param {string} api API origin without trailing slash
 * @param {{ team?: string, slug: string }} target
 */
export function registryUrl(api, target) {
  return target.team
    ? `${api}/api/teams/${target.team}/registry/${target.slug}`
    : `${api}/api/registry/${target.slug}`;
}

/**
 * Refuse to send a token over a channel that could leak it: only https, or plain http to
 * the local machine (dev servers).
 * @param {string} api
 * @param {boolean} hasToken
 */
export function assertSafeApi(api, hasToken) {
  let url;
  try {
    url = new URL(api);
  } catch {
    throw new Error(`Invalid API URL: ${api}`);
  }
  if (!hasToken) return;
  const local =
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.hostname === "::1";
  if (url.protocol === "https:" || (url.protocol === "http:" && local)) return;
  throw new Error(
    `Refusing to send KITBASE_TOKEN over ${url.protocol}//${url.host}. Use https (or http on localhost).`,
  );
}

/** Minimal argv parser: kitbase add <slug|@team/slug> [--src src] [--overwrite] [--api URL] [--dry-run] */
export function parseArgs(argv) {
  const out = {
    command: argv[0],
    slug: argv[1],
    src: "src",
    overwrite: false,
    dryRun: false,
    api: undefined,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--overwrite") out.overwrite = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--src") out.src = argv[++i];
    else if (a === "--api") out.api = argv[++i];
    else throw new Error(`Unknown option: ${a}`);
  }
  return out;
}

/** Validate the registry response shape before touching the disk. */
export function checkRegistryItem(item) {
  const ok =
    item &&
    typeof item.slug === "string" &&
    Array.isArray(item.files) &&
    Array.isArray(item.dependencies) &&
    item.files.every((f) => f && typeof f.path === "string" && typeof f.content === "string") &&
    item.dependencies.every((d) => typeof d === "string" && /^(@[a-z0-9-]+\/)?[a-z0-9-]+$/.test(d));
  if (!ok) throw new Error("Registry returned an unexpected response.");
  return item;
}
