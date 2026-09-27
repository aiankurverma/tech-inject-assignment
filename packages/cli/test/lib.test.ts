import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkRegistryItem, parseArgs, planWrites, resolveTarget } from "../lib.js";

const root = path.resolve("/tmp/project");

describe("resolveTarget", () => {
  it("keeps files inside <root>/src", () => {
    expect(resolveTarget(root, "src", "components/crm/button.tsx")).toBe(
      path.join(root, "src", "components", "crm", "button.tsx"),
    );
  });

  it.each([
    "../evil.ts",
    "components/../../evil.ts",
    "/etc/passwd",
    "C:\\evil.ts",
    "components\\crm\\x.tsx",
    "package.json",
    "src/index.ts",
    ".env",
  ])("rejects unsafe path %s", (p) => {
    expect(() => resolveTarget(root, "src", p)).toThrow(/unsafe|outside/i);
  });

  it("rejects a src folder outside the project", () => {
    expect(() => resolveTarget(root, "../other", "lib/utils.ts")).toThrow();
  });
});

describe("planWrites", () => {
  const files = [
    { path: "lib/utils.ts", content: "same\n" },
    { path: "components/crm/button.tsx", content: "new" },
    { path: "components/crm/tag.tsx", content: "fresh" },
  ];
  const existing: Record<string, string> = {
    [path.join(root, "src", "lib", "utils.ts")]: "same\r\n",
    [path.join(root, "src", "components", "crm", "button.tsx")]: "user changed this",
  };
  const readExisting = (abs: string) => existing[abs] ?? null;

  it("never overwrites changed files by default", () => {
    const plan = planWrites(files, { root, srcDir: "src", overwrite: false, readExisting });
    expect(plan.map((p: { action: string }) => p.action)).toEqual([
      "unchanged",
      "conflict",
      "create",
    ]);
  });

  it("overwrites only with --overwrite", () => {
    const plan = planWrites(files, { root, srcDir: "src", overwrite: true, readExisting });
    expect(plan.map((p: { action: string }) => p.action)).toEqual([
      "unchanged",
      "overwrite",
      "create",
    ]);
  });
});

describe("parseArgs / checkRegistryItem", () => {
  it("parses flags and rejects unknown ones", () => {
    expect(parseArgs(["add", "button", "--src", "app", "--overwrite"])).toMatchObject({
      command: "add",
      slug: "button",
      src: "app",
      overwrite: true,
    });
    expect(() => parseArgs(["add", "button", "--exec", "rm"])).toThrow();
  });

  it("rejects malformed registry responses and odd dependency names", () => {
    expect(() => checkRegistryItem({ slug: "x", files: "nope", dependencies: [] })).toThrow();
    expect(() =>
      checkRegistryItem({ slug: "x", files: [], dependencies: ["lodash; rm -rf /"] }),
    ).toThrow();
    expect(
      checkRegistryItem({ slug: "x", files: [], dependencies: ["@radix-ui/react-slot"] }),
    ).toBeTruthy();
  });
});
