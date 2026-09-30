// Bundles the server (and the shared CLI installer logic) into a single runnable dist/index.js.
// npm packages stay external and are installed from "dependencies".
import { chmodSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  packages: "external",
});
chmodSync("dist/index.js", 0o755);
console.log("Built dist/index.js");
