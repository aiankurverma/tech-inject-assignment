// Packs the installer into dist/kitbase.tgz with the API origin baked in.
import { cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const origin = process.env.PUBLIC_ORIGIN ?? "http://localhost:4000";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/pkg", { recursive: true });
for (const f of ["package.json", "lib.js", "bin"]) cpSync(f, `dist/pkg/${f}`, { recursive: true });
writeFileSync("dist/pkg/config.js", `export const DEFAULT_API = ${JSON.stringify(origin)};\n`);
const out = execFileSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["pack", "--pack-destination", ".."],
  {
    cwd: "dist/pkg",
    shell: process.platform === "win32",
  },
)
  .toString()
  .trim()
  .split("\n")
  .pop();
renameSync(`dist/${out}`, "dist/kitbase.tgz");
console.log(`Built dist/kitbase.tgz (api: ${origin})`);
