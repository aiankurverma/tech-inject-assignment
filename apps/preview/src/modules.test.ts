import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALLOWED_IMPORTS, dependencyOf } from "../../../packages/core/src/constants";

// Parse the source instead of importing it: the lazy loaders pull in browser-only libraries.
const source = readFileSync(new URL("./modules.ts", import.meta.url), "utf8");
const keys = (block: string) =>
  [...block.matchAll(/^\s+"?([^":\s]+)"?:/gm)].map((m) => m[1]!).filter((k) => k !== "id");
const eager = keys(source.split("export const MODULES")[1]!.split("};")[0]!);
const lazy = keys(source.split("export const LAZY_MODULES")[1]!.split("\n};")[0]!);

describe("preview modules", () => {
  it("exposes every allowed import and nothing else", () => {
    const exposed = [...eager, ...lazy].sort();
    const allowed = [...ALLOWED_IMPORTS].sort();
    expect(exposed).toEqual(allowed);
  });

  it("maps sub-path imports back to their package", () => {
    expect(dependencyOf("react-map-gl/maplibre")).toBe("react-map-gl");
    expect(dependencyOf("@xyflow/react/dist/style.css")).toBe("@xyflow/react");
    expect(dependencyOf("react/jsx-runtime")).toBe("react");
    expect(dependencyOf("left-pad")).toBeUndefined();
  });
});
