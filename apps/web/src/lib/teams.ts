/** Pure helpers for team workspaces (unit-tested without a DOM). */

export type TeamRole = "owner" | "admin" | "member";

export interface TeamSummary {
  slug: string;
  name: string;
  role: TeamRole;
  memberCount: number;
  componentCount: number;
}

const RANK: Record<TeamRole, number> = { member: 1, admin: 2, owner: 3 };
export const atLeast = (role: TeamRole | null | undefined, min: TeamRole) =>
  !!role && RANK[role] >= RANK[min];

/**
 * API URLs for a component page. Public pages use `/api`; a team page uses
 * `/api/teams/<team>`, so the same `ComponentPage` renders both.
 */
export function componentApi(apiBase: string, slug: string) {
  const base = `${apiBase.replace(/\/+$/, "")}/components/${slug}`;
  return {
    detail: base,
    preview: `${base}/preview`,
    draftPreview: `${base}/draft-preview`,
    copy: `${base}/copy`,
    prompt: `${base}/prompt`,
    thumbnail: `${base}/thumbnail`,
  };
}

/** `npx ... add @team/slug`, the same text the API puts in `installCommand`. */
export function teamInstallCommand(origin: string, team: string, slug: string) {
  return `npx --yes ${origin}/cli/kitbase.tgz add @${team}/${slug}`;
}

/** Slug suggestion from a team name: "Acme Inc." -> "acme-inc". */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const TOKEN_RE = /^kbi_[A-Za-z0-9_-]{40,50}$/;

/**
 * Reads the invite token from `location.hash` and removes it from the URL at once, so it is
 * never kept in history, bookmarks or referrers. Returns null when there is no valid token.
 */
export function readJoinToken(
  loc: { hash: string; pathname: string; search: string },
  history: { replaceState: (data: unknown, unused: string, url?: string) => void },
): string | null {
  const raw = loc.hash.startsWith("#") ? loc.hash.slice(1) : loc.hash;
  if (raw) history.replaceState(null, "", `${loc.pathname}${loc.search}`);
  return TOKEN_RE.test(raw) ? raw : null;
}

/** Where a signed-out visitor's token waits while they sign in (this tab only). */
export const JOIN_TOKEN_KEY = "kitbase.join.token";
