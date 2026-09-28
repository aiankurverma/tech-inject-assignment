// Builds every packages/ui/registry/*.json into a bundle (the same way apps/api/src/seed.ts does)
// and runs validateBundle() on it. Exits 1 if any entry is invalid.
// Run: npx tsx packages/ui/scripts/validate-registry.ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateBundle } from "@ti/core";

const ui = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));

interface Entry {
  slug: string;
  files: string[];
  examples: { title: string; file: string }[];
  access?: string;
  dependencies?: string[];
  props?: unknown[];
  usage?: string;
  [key: string]: unknown;
}

const failures: string[] = [];
const registry = readdirSync(ui("registry")).filter((f) => f.endsWith(".json"));

for (const file of registry) {
  try {
    const e = JSON.parse(readFileSync(ui(`registry/${file}`), "utf8")) as Entry;
    const missing = [
      ...e.files.map((p) => `src/${p}`),
      ...e.examples.map((x) => `examples/${x.file}`),
    ].filter((p) => !existsSync(ui(p)));
    if (missing.length) {
      failures.push(`${file}: missing ${missing.join(", ")}`);
      continue;
    }
    const bundle = {
      ...e,
      access: e.access ?? "free",
      dependencies: e.dependencies ?? [],
      props: e.props ?? [],
      usage: e.usage ?? "",
      files: e.files.map((path) => ({ path, content: readFileSync(ui(`src/${path}`), "utf8") })),
      examples: e.examples.map((x) => ({
        title: x.title,
        code: readFileSync(ui(`examples/${x.file}`), "utf8"),
      })),
    };
    if (e.slug !== file.replace(/\.json$/, ""))
      failures.push(`${file}: slug "${e.slug}" != file name`);
    const result = validateBundle(bundle);
    if (!result.ok) failures.push(`${file}:\n  ${result.errors.join("\n  ")}`);
  } catch (err) {
    failures.push(`${file}: ${(err as Error).message}`);
  }
}

if (failures.length) {
  console.error(`${failures.length} of ${registry.length} registry entries are invalid:\n`);
  console.error(failures.join("\n\n"));
  process.exit(1);
}
console.log(`All ${registry.length} registry entries are valid.`);
