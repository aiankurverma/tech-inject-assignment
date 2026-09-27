/**
 * Bundle file paths are relative to the consumer's source folder (e.g. `src/`).
 * Only a few folders and extensions are allowed; no traversal, no absolute paths.
 */
const SAFE_PATH =
  /^(components|lib|hooks|styles)\/[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*\.(tsx|ts|css)$/;

export function isSafeRelativePath(path: string): boolean {
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  return SAFE_PATH.test(path);
}

/** "@/components/crm/button" -> "components/crm/button". Null for non-alias imports. */
export function aliasToPath(spec: string): string | null {
  return spec.startsWith("@/") ? spec.slice(2) : null;
}
  