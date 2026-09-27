export type ComponentStatus = "draft" | "published" | "unpublished";
export type AccessLevel = "free" | "premium";
export type Plan = "free" | "premium";

export type Viewer = { kind: "anonymous" } | { kind: "customer"; plan: Plan };

export type DenyReason = "not_found" | "sign_in_required" | "premium_required";
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
