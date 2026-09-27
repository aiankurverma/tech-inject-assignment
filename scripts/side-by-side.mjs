// Builds docs/comparison/side-by-side/<slug>.png: reference screenshot next to our recreation, same height.
// Run: node scripts/side-by-side.mjs   (needs the thumbnails in packages/ui/thumbnails)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const pairs = {
  "data-table": "d37-rows-selected",
  "filter-select": "d19-owners-menu-open",
  "app-sidebar": "m03-mobile-nav-open",
  "page-header": "d01-default",
  notifications: "d12-notifications-open",
  sheet: "d13-profile-sheet",
  dialog: "d26-new-company-dialog",
  "command-palette": "d10-search-open",
  select: "d28-new-company-select-open",
  "score-card": "d43-company-details-scrolled",
  "segmented-meter": "d42-company-details",
  checkbox: "d38-all-selected",
};

const root = new URL("../", import.meta.url);
const out = new URL("docs/comparison/side-by-side/", root);
mkdirSync(out, { recursive: true });

for (const [slug, ref] of Object.entries(pairs)) {
  const refUrl = new URL(`docs/reference/screens/${ref}.png`, root).href;
  const ourUrl = new URL(`packages/ui/thumbnails/${slug}.png`, root).href;
  const html = `<!doctype html><html><body style="margin:0;background:#0e0e0e;font:13px sans-serif;color:#a4a4a4">
  <div style="display:flex;gap:16px;padding:16px;align-items:flex-start">
    <figure style="margin:0"><figcaption style="margin-bottom:6px">Reference: ${ref}.png</figcaption><img src="${refUrl}" style="height:420px;border:1px solid #232323"></figure>
    <figure style="margin:0"><figcaption style="margin-bottom:6px">Recreation: ${slug}</figcaption><img src="${ourUrl}" style="height:420px;border:1px solid #232323"></figure>
  </div></body></html>`;
  const page = new URL(`${slug}.html`, out);
  writeFileSync(page, html);
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync(
        process.execPath,
        [
          new URL("scripts/shot.mjs", root).pathname.replace(/^\/([A-Z]:)/, "$1"),
          new URL(`${slug}.png`, out).pathname.replace(/^\/([A-Z]:)/, "$1"),
          pathToFileURL(page.pathname.replace(/^\/([A-Z]:)/, "$1")).href,
          "1460",
          "480",
          "--wait",
          "500",
        ],
        { stdio: "ignore" },
      );
      break;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
  console.log("built", slug);
}
