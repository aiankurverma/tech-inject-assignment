// Opens every published component page (signed in as the premium test customer), switches through
// every example variant and reports previews that never render or show an error.
// Usage: node scripts/check-previews.mjs [origin]
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGIN = process.argv[2] ?? "http://localhost:4000";
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const PORT = 9400 + (process.pid % 500);
const chrome = spawn(
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `ti-previews-${process.pid}`)}`,
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
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: `${ORIGIN}/` });
await sleep(2500);
const login = await evaluate(
  `fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(${JSON.stringify({ email: env.SEED_PREMIUM_EMAIL, password: env.SEED_PREMIUM_PASSWORD })})}).then(r=>r.status)`,
);
console.log("premium login", login);

const list = await evaluate(`fetch('/api/components').then(r=>r.json())`);
// A preview is healthy when the loading overlay is gone and no "Preview error" alert is shown.
const state = `(()=>{const t=document.body.innerText;return {loading:/Loading preview/.test(t),error:(t.match(/Preview error:[^\\n]*/)||[null])[0],locked:/Premium required|Sign in with a premium/.test(t)}})()`;
const failures = [];
let checked = 0;
for (const c of list) {
  await send("Page.navigate", { url: `${ORIGIN}/components/${c.slug}` });
  await sleep(4000);
  const variants = (await evaluate(`document.querySelectorAll('select option').length`)) || 1;
  for (let v = 0; v < variants; v++) {
    if (v > 0) {
      await evaluate(
        `(()=>{const s=document.querySelector('select');const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,'${v}');s.dispatchEvent(new Event('change',{bubbles:true}))})()`,
      );
      await sleep(2500);
    }
    // Bigger bundles take longer to compile in the iframe: wait up to ~12s for loading to finish.
    let s = await evaluate(state);
    for (let t = 0; t < 8 && s.loading; t++) {
      await sleep(1000);
      s = await evaluate(state);
    }
    checked++;
    const ok = !s.loading && !s.error && !s.locked;
    if (!ok) failures.push({ slug: c.slug, variant: v, ...s });
    console.log(
      `${ok ? "OK  " : "FAIL"} ${c.slug} #${v}${s.error ? ` ${s.error}` : ""}${s.loading ? " (still loading)" : ""}${s.locked ? " (locked)" : ""}`,
    );
  }
}
console.log(`\n${checked} previews checked, ${failures.length} failing`);
ws.close();
chrome.kill();
process.exit(failures.length ? 1 : 0);
