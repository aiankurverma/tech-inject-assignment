/** Test helper: reads a packages/ui registry entry as the API's ComponentDetail. */
import { readdirSync, readFileSync } from "node:fs";
import type { ComponentDetail, PropDoc } from "./types";

const ui = new URL("../../../../packages/ui/", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, ui), "utf8");

interface Manifest {
  slug: string;
  name: string;
  category: string;
  access: "free" | "premium";
  dependencies?: string[];
  files: string[];
  examples: { title: string; file: string }[];
  props?: PropDoc[];
}

export const registrySlugs = (): string[] =>
  readdirSync(new URL("registry/", ui))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();

export function registryDetail(slug: string): ComponentDetail {
  const m = JSON.parse(read(`registry/${slug}.json`)) as Manifest;
  return {
    slug: m.slug,
    name: m.name,
    category: m.category,
    access: m.access,
    locked: null,
    props: m.props ?? [],
    dependencies: m.dependencies ?? [],
    examples: m.examples.map((e) => ({ title: e.title, code: read(`examples/${e.file}`) })),
    files: [
      { path: "lib/utils.ts", content: read("src/lib/utils.ts") },
      ...m.files.map((path) => ({ path, content: read(`src/${path}`) })),
    ],
  };
}
