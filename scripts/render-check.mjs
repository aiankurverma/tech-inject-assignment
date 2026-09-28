// DB-free render check: builds each packages/ui registry entry's preview payload (same shape as
// apps/api previewPayload()), renders every example in the real apps/preview runtime via headless
// Chrome (CDP, zero deps), and writes screenshots + docs/render-check/report.json.
// Usage: node scripts/render-check.mjs [slug1 slug2 ...]
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const ui = (p) => join(root, "packages/ui", p);
const OUT = join(root, "docs/render-check");
const PREVIEW_PORT = 5199;
const PARENT_PORT = 5198;
const PREVIEW = `http://localhost:${PREVIEW_PORT}`;
const PARENT = `http://localhost:${PARENT_PORT}`;
const TIMEOUT = 15000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

// ---- payloads (mirror of seed.ts + theme.ts + previewPayload) ----
const themeCss = readFileSync(ui("src/styles/crm-theme.css"), "utf8");
const utilsTs = readFileSync(ui("src/lib/utils.ts"), "utf8");
const wanted = process.argv.slice(2);
const slugs = (
  wanted.length
    ? wanted
    : readdirSync(ui("registry"))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -5))
).sort();
function payload(slug) {
  const e = JSON.parse(readFileSync(ui(`registry/${slug}.json`), "utf8"));
  return {
    slug: e.slug,
    version: e.version,
    themeCss,
    files: [
      { path: "lib/utils.ts", content: utilsTs },
      ...e.files.map((path) => ({ path, content: readFileSync(ui(`src/${path}`), "utf8") })),
    ],
    examples: e.examples.map((x) => ({
      title: x.title,
      code: readFileSync(ui(`examples/${x.file}`), "utf8"),
    })),
  };
}

// ---- servers ----
const parentHtml = `<!doctype html><html><head><style>html,body{margin:0;background:#161616}iframe{display:block;border:0;width:1280px;height:800px;background:#161616}</style></head><body>
<iframe id="f" sandbox="allow-scripts" src="about:blank"></iframe><script>
window.__msgs=[];addEventListener("message",e=>{if(e.source===document.getElementById("f").contentWindow)window.__msgs.push(e.data)});
window.__load=()=>{__msgs=[];document.getElementById("f").src="${PREVIEW}/?t="+Date.now()};
window.__post=(p,ex)=>document.getElementById("f").contentWindow.postMessage({type:"render",payload:p,example:ex},"*");
</script></body></html>`;
const parentServer = createServer((_, res) =>
  res.writeHead(200, { "content-type": "text/html" }).end(parentHtml),
);
await new Promise((r) => parentServer.listen(PARENT_PORT, "127.0.0.1", r));

const vite = spawn(
  "npx",
  ["vite", "--port", String(PREVIEW_PORT), "--strictPort", "--host", "localhost"],
  {
    cwd: join(root, "apps/preview"),
    shell: true,
    env: { ...process.env, VITE_PARENT_ORIGINS: PARENT },
    stdio: "ignore",
  },
);
for (let i = 0; i < 150; i++) {
  try {
    if ((await fetch(`${PREVIEW}/`)).ok) break;
  } catch {}
  await sleep(200);
}

const CDP = 9400 + (process.pid % 500);
const profile = join(tmpdir(), `ti-render-check-${process.pid}`);
const chrome = spawn(
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless=new",
    `--remote-debugging-port=${CDP}`,
    `--user-data-dir=${profile}`,
    "--disable-site-isolation-trials",
    "--disable-features=IsolateOrigins,site-per-process",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function cleanup() {
  try {
    chrome.kill();
  } catch {}
  try {
    if (process.platform === "win32")
      spawn("taskkill", ["/pid", String(vite.pid), "/T", "/F"], { stdio: "ignore" });
    else vite.kill();
  } catch {}
  parentServer.close();
  await sleep(800);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(
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
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression, extra = {}) =>
  (
    await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      ...extra,
    })
  ).result?.result?.value;

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: `${PARENT}/` });
await sleep(1000);

// Blank = nothing visible inside the example wrapper (no text, no sized element).
const BLANK_JS = `(()=>{const w=document.querySelector('#root > div');if(!w)return true;
if((w.innerText||'').trim())return false;
for(const el of w.querySelectorAll('*')){const r=el.getBoundingClientRect();const s=getComputedStyle(el);
if(r.width>1&&r.height>1&&s.visibility!=='hidden'&&s.opacity!=='0')return false}return true})()`;

async function frameEval(expr) {
  const tree = (await send("Page.getFrameTree")).result.frameTree;
  const child = tree.childFrames?.[0]?.frame;
  if (!child) return undefined;
  const ctx = (await send("Page.createIsolatedWorld", { frameId: child.id, worldName: "rc" }))
    .result?.executionContextId;
  if (!ctx) return undefined;
  return evaluate(expr, { contextId: ctx });
}

async function waitMsg(type, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const msgs = await evaluate("window.__msgs");
    const hit = msgs?.find((m) =>
      Array.isArray(type) ? type.includes(m?.type) : m?.type === type,
    );
    if (hit) return hit;
    await sleep(100);
  }
  return null;
}

const report = [];
const rank = { ok: 0, blank: 1, error: 2, timeout: 3 };
try {
  for (const slug of slugs) {
    let p;
    try {
      p = payload(slug);
    } catch (e) {
      report.push({ slug, status: "error", error: `payload: ${e.message}` });
      continue;
    }
    const results = [];
    for (let ex = 0; ex < Math.max(1, p.examples.length); ex++) {
      await evaluate("window.__load()");
      let status = "ok",
        error = null;
      if (!(await waitMsg("ready", TIMEOUT))) {
        status = "timeout";
        error = "preview never sent ready";
      } else {
        await evaluate(`window.__post(${JSON.stringify(p)},${ex})`);
        const m = await waitMsg(["rendered", "error"], TIMEOUT);
        if (!m) {
          status = "timeout";
          error = "no rendered/error within 15s";
        } else {
          await sleep(700); // tailwind browser compile + effects; async boundary errors
          const late = (await evaluate("window.__msgs")).find((x) => x?.type === "error");
          if (m.type === "error" || late) {
            status = "error";
            error = (late ?? m).message ?? "Preview failed";
          } else if ((await frameEval(BLANK_JS)) === true) {
            status = "blank";
            error = "iframe renders nothing visible";
          }
        }
      }
      const shot = (await send("Page.captureScreenshot", { format: "png" })).result?.data;
      if (shot)
        writeFileSync(
          join(OUT, ex === 0 ? `${slug}.png` : `${slug}--ex${ex + 1}.png`),
          Buffer.from(shot, "base64"),
        );
      results.push({ ex, status, error });
    }
    const worst = results.reduce((a, b) => (rank[b.status] > rank[a.status] ? b : a), results[0]);
    const entry = {
      slug,
      status: worst.status,
      error: worst.status === "ok" ? null : `example ${worst.ex + 1}: ${worst.error}`,
    };
    if (results.length > 1) entry.examples = results.map((r) => r.status);
    report.push(entry);
    console.log(`${entry.status.padEnd(7)} ${slug}${entry.error ? "  " + entry.error : ""}`);
  }
} finally {
  const reportPath = join(OUT, "report.json");
  let merged = report;
  if (wanted.length && existsSync(reportPath)) {
    const prev = JSON.parse(readFileSync(reportPath, "utf8")).filter(
      (r) => !wanted.includes(r.slug),
    );
    merged = [...prev, ...report].sort((a, b) => a.slug.localeCompare(b.slug));
  }
  writeFileSync(reportPath, JSON.stringify(merged, null, 2));
  const bad = report.filter((r) => r.status !== "ok");
  console.log(`\n${report.length - bad.length}/${report.length} ok; report: ${reportPath}`);
  ws.close();
  await cleanup();
}
process.exit(0);
