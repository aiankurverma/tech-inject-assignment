export type ComponentStatus = "draft" | "published" | "unpublished";
export type AccessLevel = "free" | "premium";
export type Plan = "free" | "premium";

export type Viewer = { kind: "anonymous" } | { kind: "customer"; plan: Plan };

export type DenyReason =
  "not_found" | "sign_in_required" | "premium_required" | "team_role_required";
export type AccessDecision = { allowed: true } | { allowed: false; reason: DenyReason };

export function decideAccess(
  component: { status: ComponentStatus; access: AccessLevel },
  viewer: Viewer,
): AccessDecision {
  if (component.status !== "published") return { allowed: false, reason: "not_found" };
  if (component.access === "free") return { allowed: true };
  if (viewer.kind === "anonymous") return { allowed: false, reason: "sign_in_required" };
  return viewer.plan === "premium"
    ? { allowed: true }
    : { allowed: false, reason: "premium_required" };
}

// ---------------------------------------------------------------------------
// Team workspaces: private components shared inside one team.
// ---------------------------------------------------------------------------

export type TeamRole = "owner" | "admin" | "member";
/** `role: null` = signed in but not a member of this team. */
export type TeamViewer = { kind: "anonymous" } | { kind: "customer"; role: TeamRole | null };
export type TeamAction =
  "read" | "read_draft" | "manage_components" | "manage_members" | "manage_owners";

const ROLE_RANK: Record<TeamRole, number> = { member: 1, admin: 2, owner: 3 };
const MIN_ROLE: Record<TeamAction, TeamRole> = {
  read: "member",
  read_draft: "admin",
  manage_components: "admin",
  manage_members: "admin",
  manage_owners: "owner",
};

export const roleRank = (role: TeamRole) => ROLE_RANK[role];

/**
 * Deny by default. Order matters: anonymous callers learn nothing (401 before any lookup),
 * non-members see 404 (the team may as well not exist), members with too low a role see 403.
 */
export function decideTeamAccess(
  component: { status: ComponentStatus } | null,
  viewer: TeamViewer,
  action: TeamAction,
): AccessDecision {
  if (viewer.kind === "anonymous") return { allowed: false, reason: "sign_in_required" };
  if (viewer.role === null) return { allowed: false, reason: "not_found" };
  if (action === "read" && component?.status !== "published")
    return { allowed: false, reason: "not_found" };
  if (roleRank(viewer.role) < roleRank(MIN_ROLE[action]))
    return { allowed: false, reason: "team_role_required" };
  return { allowed: true };
}

/** An invite can never grant owner, and never a role above the inviter's own. */
export function canInviteRole(actor: TeamRole, target: TeamRole): boolean {
  if (target === "owner") return false;
  if (roleRank(actor) < roleRank("admin")) return false;
  return roleRank(target) <= roleRank(actor);
}
