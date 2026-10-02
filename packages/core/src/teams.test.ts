import { describe, expect, it } from "vitest";
import {
  agentPromptText,
  buildRegistryItem,
  canInviteRole,
  decideTeamAccess,
  installCommand,
  validateBundle,
  type ComponentStatus,
  type TeamAction,
  type TeamRole,
  type TeamViewer,
} from "./index";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const SVG = "data:image/svg+xml;base64,PHN2Zy8+";

const bundle = (over: Record<string, unknown> = {}) => ({
  name: "Pipeline card",
  slug: "pipeline-card",
  description: "A card that shows one deal in the pipeline.",
  category: "Cards",
  version: "1.0.0",
  access: "free",
  files: [{ path: "components/acme/pipeline-card.tsx", content: "export const X = () => null;" }],
  examples: [{ title: "Basic", code: "export default function E() { return null; }" }],
  ...over,
});

describe("decideTeamAccess", () => {
  const viewers: [string, TeamViewer][] = [
    ["anon", { kind: "anonymous" }],
    ["null", { kind: "customer", role: null }],
    ["member", { kind: "customer", role: "member" }],
    ["admin", { kind: "customer", role: "admin" }],
    ["owner", { kind: "customer", role: "owner" }],
  ];
  const statuses: (ComponentStatus | null)[] = ["draft", "published", "unpublished", null];
  const actions: TeamAction[] = [
    "read",
    "read_draft",
    "manage_components",
    "manage_members",
    "manage_owners",
  ];
  const minRole: Record<TeamAction, number> = {
    read: 1,
    read_draft: 2,
    manage_components: 2,
    manage_members: 2,
    manage_owners: 3,
  };
  const rank = { member: 1, admin: 2, owner: 3 };

  for (const [label, viewer] of viewers) {
    for (const status of statuses) {
      for (const action of actions) {
        it(`${label} × ${status} × ${action}`, () => {
          const component = status ? { status } : null;
          const d = decideTeamAccess(component, viewer, action);
          if (viewer.kind === "anonymous") {
            expect(d).toEqual({ allowed: false, reason: "sign_in_required" });
          } else if (viewer.role === null) {
            expect(d).toEqual({ allowed: false, reason: "not_found" });
          } else if (action === "read" && status !== "published") {
            expect(d).toEqual({ allowed: false, reason: "not_found" });
          } else if (rank[viewer.role] < minRole[action]) {
            expect(d).toEqual({ allowed: false, reason: "team_role_required" });
          } else {
            expect(d).toEqual({ allowed: true });
          }
        });
      }
    }
  }

  it("anonymous is decided before anything else (no component needed)", () => {
    expect(decideTeamAccess(null, { kind: "anonymous" }, "manage_owners")).toEqual({
      allowed: false,
      reason: "sign_in_required",
    });
  });
});

describe("canInviteRole", () => {
  const roles: TeamRole[] = ["member", "admin", "owner"];
  it.each(roles)("nobody can invite an owner (%s)", (actor) => {
    expect(canInviteRole(actor, "owner")).toBe(false);
  });
  it("members cannot invite at all", () => {
    expect(canInviteRole("member", "member")).toBe(false);
    expect(canInviteRole("member", "admin")).toBe(false);
  });
  it("admins invite members and admins", () => {
    expect(canInviteRole("admin", "member")).toBe(true);
    expect(canInviteRole("admin", "admin")).toBe(true);
  });
  it("owners invite members and admins", () => {
    expect(canInviteRole("owner", "member")).toBe(true);
    expect(canInviteRole("owner", "admin")).toBe(true);
  });
});

describe("validateBundle with { team }", () => {
  it("rejects an SVG thumbnail", () => {
    const r = validateBundle(bundle({ thumbnail: SVG }), { team: "acme" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/thumbnail.*SVG/);
  });
  it("accepts a PNG thumbnail", () => {
    expect(validateBundle(bundle({ thumbnail: PNG }), { team: "acme" }).ok).toBe(true);
  });
  it("rejects components/crm/x.tsx", () => {
    const r = validateBundle(
      bundle({ files: [{ path: "components/crm/x.tsx", content: "export const X = 1;" }] }),
      { team: "acme" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContain("files: components/crm/x.tsx must be under components/acme/");
  });
  it("accepts components/acme/x.tsx", () => {
    const r = validateBundle(
      bundle({ files: [{ path: "components/acme/x.tsx", content: "export const X = 1;" }] }),
      { team: "acme" },
    );
    expect(r.ok).toBe(true);
  });
  it("public defaults are unchanged (SVG thumbnails and components/crm still fine)", () => {
    const r = validateBundle(
      bundle({
        thumbnail: SVG,
        files: [{ path: "components/crm/x.tsx", content: "export const X = 1;" }],
      }),
    );
    expect(r.ok).toBe(true);
  });
});

describe("installCommand / agentPromptText", () => {
  const theme = { themeCss: ":root{}", utilsTs: "export const cn = () => ''" };
  it("builds the @team/slug form", () => {
    expect(installCommand("https://kit.example", "pipeline-card", "acme")).toBe(
      "npx --yes https://kit.example/cli/kitbase.tgz add @acme/pipeline-card",
    );
    expect(installCommand("https://kit.example", "pipeline-card")).toBe(
      "npx --yes https://kit.example/cli/kitbase.tgz add pipeline-card",
    );
  });
  it("team prompt mentions KITBASE_TOKEN and never a token value", () => {
    const parsed = validateBundle(bundle(), { team: "acme" });
    if (!parsed.ok) throw new Error(parsed.errors.join());
    const item = buildRegistryItem(parsed.bundle, theme);
    const text = agentPromptText(item, {
      apiOrigin: "https://kit.example",
      auth: "team",
      team: "acme",
    });
    expect(text).toContain("KITBASE_TOKEN");
    expect(text).toContain("private to team @acme");
    expect(text).toContain("add @acme/pipeline-card");
    expect(text).not.toMatch(/ti_[A-Za-z0-9_-]{10,}/);
  });
});
