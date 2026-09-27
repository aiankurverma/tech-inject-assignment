// Headless Chrome screenshots of local pages. Usage:
// node scripts/shot.mjs <out.png> <url> [width] [height] [--cookie name=value] [--click "text"]...
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [out, url, w = "1440", h = "900", ...rest] = process.argv.slice(2);
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9400 + (process.pid % 500); // per-run port: a closing Chrome can still hold the last one
const profile = join(tmpdir(), `ti-shot-${process.pid}-${Date.now()}`);
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
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
await send("Page.navigate", { url });
await sleep(4000);
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--eval") {
    console.log(await evaluate(rest[++i]));
    await sleep(2500);
  }
  if (rest[i] === "--wait") await sleep(+rest[++i]);
}
// --clip <css selector>: crop the screenshot to one element (e.g. the preview iframe).
const clipAt = rest.indexOf("--clip");
const clip =
  clipAt >= 0
    ? await evaluate(
        `(()=>{const r=document.querySelector(${JSON.stringify(rest[clipAt + 1])}).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`,
      )
    : undefined;
const { data } = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) });
writeFileSync(out, Buffer.from(data, "base64"));
ws.close();
chrome.kill();
process.exit(0);
