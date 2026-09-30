import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSafeApi,
  checkRegistryItem,
  parseArgs,
  parseTarget,
  planWrites,
  registryUrl,
  resolveTarget,
} from "../lib.js";

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

describe("parseTarget / registryUrl (team targets)", () => {
  it("accepts a public slug and an @team/slug", () => {
    expect(parseTarget("x")).toEqual({ slug: "x" });
    expect(parseTarget("pipeline-card")).toEqual({ slug: "pipeline-card" });
    expect(parseTarget("@a/x")).toEqual({ team: "a", slug: "x" });
    expect(parseTarget("@acme-inc/pipeline-card")).toEqual({
      team: "acme-inc",
      slug: "pipeline-card",
    });
  });

  it.each([
    "@A/x",
    "@a/",
    "@/x",
    "a/x",
    "@a/b/c",
    "../x",
    "",
    "@a/x/",
    "x ",
    "@a//x",
    "-x",
    "@-a/x",
  ])("rejects %j", (arg) => {
    expect(() => parseTarget(arg)).toThrow(/Invalid component name/);
  });

  it("builds both registry URL forms", () => {
    expect(registryUrl("https://kit.example", { slug: "x" })).toBe(
      "https://kit.example/api/registry/x",
    );
    expect(registryUrl("https://kit.example", { team: "acme", slug: "x" })).toBe(
      "https://kit.example/api/teams/acme/registry/x",
    );
  });
});

describe("assertSafeApi", () => {
  it("blocks a token over remote http", () => {
    expect(() => assertSafeApi("http://kit.example", true)).toThrow(
      /Refusing to send KITBASE_TOKEN/,
    );
    expect(() => assertSafeApi("http://10.0.0.5:4000", true)).toThrow(/Refusing/);
    expect(() => assertSafeApi("ftp://localhost", true)).toThrow(/Refusing/);
  });
  it("allows https anywhere and http on the local machine", () => {
    expect(() => assertSafeApi("https://kit.example", true)).not.toThrow();
    expect(() => assertSafeApi("http://localhost:4000", true)).not.toThrow();
    expect(() => assertSafeApi("http://127.0.0.1:4000", true)).not.toThrow();
    expect(() => assertSafeApi("http://[::1]:4000", true)).not.toThrow();
  });
  it("does not care without a token, but still needs a valid URL", () => {
    expect(() => assertSafeApi("http://kit.example", false)).not.toThrow();
    expect(() => assertSafeApi("not a url", false)).toThrow(/Invalid API URL/);
  });
});
