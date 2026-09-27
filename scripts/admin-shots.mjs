// Screenshots many admin pages in ONE logged-in session (avoids the login rate limit).
// Usage: node scripts/admin-shots.mjs <outDir> <width> <height> <path> [path...]
// Reads ADMIN_USERNAME / ADMIN_PASSWORD from .env; never prints them.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [outDir, w, h, ...paths] = process.argv.slice(2);
const ORIGIN = process.env.ADMIN_ORIGIN ?? "http://localhost:4000";
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
mkdirSync(outDir, { recursive: true });

const PORT = 9400 + (process.pid % 500);
const chrome = spawn(
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `ti-admin-${process.pid}`)}`,
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(
      (t) => t.type === "page",
    )?.webSocketDebuggerUrl;
  } catch {}
  await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result
    ?.value;

await send("Emulation.setDeviceMetricsOverride", {
  width: +w,
  height: +h,
  deviceScaleFactor: 1,
  mobile: +w < 600,
});
// Optional THEME=dark|light: stored under the shared theme key before every page load.
const THEME = process.env.THEME;
if (THEME === "dark" || THEME === "light") {
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `try{localStorage.setItem("ti-theme","${THEME}")}catch(e){}document.documentElement.classList.toggle("dark",${THEME === "dark"});`,
  });
}
await send("Page.navigate", { url: `${ORIGIN}/admin/` });
await sleep(2500);
const status = await evaluate(
  `fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(${JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD })})}).then(r=>r.status)`,
);
console.log("login status", status);
for (const p of paths) {
  await send("Page.navigate", { url: `${ORIGIN}${p}` });
  await sleep(6000);
  const name =
    p
      .replace(/^\/admin\/?/, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "") || "overview";
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(join(outDir, `${name}-${w}.png`), Buffer.from(data, "base64"));
  console.log("saved", `${name}-${w}.png`);
}
ws.close();
chrome.kill();
process.exit(0);
