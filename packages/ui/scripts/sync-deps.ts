// Recomputes `dependencies` in packages/ui/registry/*.json from the imports actually used.
// Run: npx tsx packages/ui/scripts/sync-deps.ts
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dependencyOf, findImports } from "@ti/core";

const ui = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));

for (const file of readdirSync(ui("registry")).filter((f) => f.endsWith(".json"))) {
  const path = ui(`registry/${file}`);
  const entry = JSON.parse(readFileSync(path, "utf8")) as {
    files: string[];
    examples: { file: string }[];
    dependencies: string[];
  };
  const sources = [
    ...entry.files.map((f) => readFileSync(ui(`src/${f}`), "utf8")),
    ...entry.examples.map((e) => readFileSync(ui(`examples/${e.file}`), "utf8")),
  ];
  const used = new Set(
    sources
      .flatMap(findImports)
      .map(dependencyOf)
      .filter((d): d is NonNullable<typeof d> => d !== undefined && d !== "react"),
  );
  entry.dependencies = [...used].sort();
  writeFileSync(path, JSON.stringify(entry, null, 2) + "\n");
}
console.log("dependencies synced");
