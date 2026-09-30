import { describe, expect, it } from "vitest";
import { atLeast, componentApi, readJoinToken, slugify, teamInstallCommand } from "./teams";

const TOKEN = `kbi_${"a".repeat(43)}`;

describe("readJoinToken (/join page)", () => {
  it("returns the token and clears the hash straight away", () => {
    const calls: string[] = [];
    const token = readJoinToken(
      { hash: `#${TOKEN}`, pathname: "/join", search: "" },
      { replaceState: (_d, _u, url) => calls.push(String(url)) },
    );
    expect(token).toBe(TOKEN);
    expect(calls).toEqual(["/join"]);
  });
  it("clears a junk hash too and returns null", () => {
    const calls: string[] = [];
    expect(
      readJoinToken(
        { hash: "#not-a-token", pathname: "/join", search: "?x=1" },
        { replaceState: (_d, _u, url) => calls.push(String(url)) },
      ),
    ).toBeNull();
    expect(calls).toEqual(["/join?x=1"]);
  });
  it("does nothing without a hash", () => {
    const calls: string[] = [];
    expect(
      readJoinToken(
        { hash: "", pathname: "/join", search: "" },
        { replaceState: (_d, _u, url) => calls.push(String(url)) },
      ),
    ).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe("componentApi (ComponentPage apiBase)", () => {
  it("builds public URLs", () => {
    expect(componentApi("/api", "card")).toEqual({
      detail: "/api/components/card",
      preview: "/api/components/card/preview",
      draftPreview: "/api/components/card/draft-preview",
      copy: "/api/components/card/copy",
      prompt: "/api/components/card/prompt",
      thumbnail: "/api/components/card/thumbnail",
    });
  });
  it("builds team URLs from apiBase", () => {
    const u = componentApi("/api/teams/acme/", "card");
    expect(u.detail).toBe("/api/teams/acme/components/card");
    expect(u.copy).toBe("/api/teams/acme/components/card/copy");
    expect(u.draftPreview).toBe("/api/teams/acme/components/card/draft-preview");
  });
});

describe("team install command and helpers", () => {
  it("matches the API's install command text", () => {
    expect(teamInstallCommand("https://kit.example", "acme", "card")).toBe(
      "npx --yes https://kit.example/cli/kitbase.tgz add @acme/card",
    );
  });
  it("slugify", () => {
    expect(slugify("Acme Inc.")).toBe("acme-inc");
    expect(slugify("  Team  42 ")).toBe("team-42");
  });
  it("atLeast", () => {
    expect(atLeast("owner", "admin")).toBe(true);
    expect(atLeast("member", "admin")).toBe(false);
    expect(atLeast(null, "member")).toBe(false);
  });
});
