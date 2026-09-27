// Captures reference screenshots of the Sales CRM via Chrome DevTools Protocol (no deps).
// Usage: node scripts/capture-crm.mjs
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SITE = "https://sales-crm-kargulstudio.vercel.app/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = new URL("../docs/reference/screens/", import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  "$1",
);
const RAW = new URL("../docs/reference/raw/", import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  "$1",
);
const PORT = 9333;
mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });

const profile = join(tmpdir(), "crm-capture-profile");
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await getWsUrl());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });

async function evaluate(expr) {
  const r = await send("Runtime.evaluate", {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description || "eval error");
  return r.result.value;
}

let viewport = { w: 1440, h: 900, mobile: false };
async function setViewport(w, h, mobile = false) {
  viewport = { w, h, mobile };
  await send("Emulation.setDeviceMetricsOverride", {
    width: w,
    height: h,
    deviceScaleFactor: 1,
    mobile,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
}

async function load() {
  await send("Page.navigate", { url: SITE });
  await sleep(4000);
  await evaluate("document.fonts.ready.then(()=>true)");
  await sleep(500);
}

const log = [];
async function shot(name, { full = false } = {}) {
  const params = { format: "png" };
  if (full) {
    const size = await evaluate(
      "({w:document.documentElement.scrollWidth,h:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)})",
    );
    params.captureBeyondViewport = true;
    params.clip = { x: 0, y: 0, width: size.w, height: size.h, scale: 1 };
  }
  const { data } = await send("Page.captureScreenshot", params);
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  // Record any open overlays for the inventory.
  const overlays =
    await evaluate(`[...document.querySelectorAll('[role=dialog],[role=menu],[role=listbox],[role=tooltip],[data-slot$=content],[data-sonner-toast],[role=status]')]
    .filter(el=>el.offsetParent!==null||getComputedStyle(el).position==='fixed')
    .map(el=>({role:el.getAttribute('role'),slot:el.getAttribute('data-slot'),text:el.innerText.replace(/\\s+/g,' ').slice(0,600)}))`);
  log.push({ name, viewport: `${viewport.w}x${viewport.h}`, overlays });
  if (overlays.length) {
    const html = await evaluate(
      `[...document.querySelectorAll('[role=dialog],[role=menu],[role=listbox],[role=tooltip],[data-slot$=content]')].map(e=>e.outerHTML).join('\\n\\n<!-- next -->\\n\\n')`,
    );
    if (html) writeFileSync(join(RAW, `${name}.overlay.html`), html);
  }
  console.log("saved", name, overlays.length ? `(overlays: ${overlays.length})` : "");
}

// Find element center by aria-label (exact) or visible text (contains). Returns null when missing.
async function center(query, { nth = 0, within = "document" } = {}) {
  return evaluate(`(()=>{const q=${JSON.stringify(query)};const root=${within};
    const all=[...root.querySelectorAll('button,a,[role=tab],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=option],[role=checkbox],[role=separator],input,textarea,th,td,span,div,li')]
      .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});
    const norm=t=>(t||'').replace(/\s+/g,' ').trim();
    let m=q.startsWith('css:')?[...root.querySelectorAll(q.slice(4))].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}):all.filter(e=>e.getAttribute('aria-label')===q);
    if(!m.length)m=all.filter(e=>norm(e.innerText)===q&&e.tagName==='BUTTON');
    if(!m.length)m=all.filter(e=>(e.innerText||'').trim()===q);
    if(!m.length)m=all.filter(e=>(e.innerText||'').trim().startsWith(q)&&e.children.length<6);
    const e=m[${nth}];if(!e)return null;e.scrollIntoView({block:'nearest',inline:'nearest'});
    const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
}

async function mouse(type, x, y, button = "left") {
  await send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button,
    clickCount: type === "mouseMoved" ? 0 : 1,
    pointerType: "mouse",
  });
}
async function hover(query, opts) {
  const c = await center(query, opts);
  if (!c) return (console.warn("  missing:", query), false);
  await mouse("mouseMoved", c.x, c.y);
  await sleep(700);
  return true;
}
async function click(query, opts) {
  const c = await center(query, opts);
  if (!c) return (console.warn("  missing:", query), false);
  if (viewport.mobile) {
    await send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: c.x, y: c.y }],
    });
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await mouse("mouseMoved", c.x, c.y);
    await mouse("mousePressed", c.x, c.y);
    await mouse("mouseReleased", c.x, c.y);
  }
  await sleep(900);
  return true;
}
async function key(k, code = k, keyCode = 0) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: k,
    code,
    windowsVirtualKeyCode: keyCode,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: k,
    code,
    windowsVirtualKeyCode: keyCode,
  });
  await sleep(250);
}
const esc = async () => {
  await key("Escape", "Escape", 27);
  await sleep(500);
};
const tab = () => key("Tab", "Tab", 9);
async function moveAway() {
  await mouse("mouseMoved", 5, viewport.h - 5);
  await sleep(300);
}
async function scrollAt(x, y, dy) {
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dy });
  await sleep(800);
}
// Scroll the first open dialog/sheet body to the bottom.
async function scrollOverlay() {
  await evaluate(
    `(()=>{const d=document.querySelector('[role=dialog]');if(!d)return;const els=[d,...d.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+10&&/(auto|scroll)/.test(getComputedStyle(e).overflowY));els.forEach(e=>e.scrollTop=e.scrollHeight)})()`,
  );
  await sleep(600);
}

const safe = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    console.warn("  step failed:", label, e.message);
  }
};

// ---------------- Desktop 1440x900 ----------------
await send("Page.enable");
await send("Runtime.enable");
await setViewport(1440, 900);
await load();
await moveAway();
await shot("d01-default");
await shot("d02-default-fullpage", { full: true });

// Sidebar
await safe("sidebar hover", async () => {
  await hover("Deals Board");
  await shot("d03-sidebar-item-hover");
});
await safe("sidebar active", async () => {
  await click("Deals Board");
  await moveAway();
  await shot("d04-sidebar-item-active-deals");
  await click("css:aside button, [data-slot=sidebar] button");
});
await safe("sidebar pipelines hover", async () => {
  await hover("North America");
  await shot("d05-sidebar-pipeline-hover");
});
await safe("add billings hover", async () => {
  await hover("Add Billings");
  await shot("d06-add-billings-hover");
});
await safe("add billings click", async () => {
  await click("Add Billings");
  await shot("d07-add-billings-click");
  await esc();
});
await safe("invite click", async () => {
  await click("Invite teammates");
  await shot("d08-invite-click");
  await esc();
});
await safe("help click", async () => {
  await click("Help");
  await shot("d09-help-click");
  await esc();
});

// Header
await safe("search", async () => {
  await click("Search");
  await shot("d10-search-open");
  await esc();
});
await safe("search hover", async () => {
  await hover("Search");
  await shot("d11-icon-button-hover");
});
await safe("notifications", async () => {
  await click("Notifications, 3 unread");
  await shot("d12-notifications-open");
  await esc();
});
await safe("profile", async () => {
  await click("Open profile for Jensen Ackles");
  await shot("d13-profile-sheet");
  await scrollOverlay();
  await shot("d14-profile-sheet-scrolled");
  await esc();
});

// Tabs
await safe("tabs", async () => {
  await hover("Deals");
  await shot("d15-tab-hover");
  await click("Deals");
  await moveAway();
  await shot("d16-tab-deals-active");
  await click("Forecast", { nth: 1 });
  await moveAway();
  await shot("d17-tab-forecast-active");
  await click("Companies", { nth: 1 });
  await moveAway();
});

// Toolbar dropdowns
for (const [label, name] of [
  [0, "sort"],
  [1, "owners"],
  [2, "stage"],
  [3, "last-activity"],
]) {
  const sel = "css:[data-slot=dropdown-menu-trigger]";
  await safe(name, async () => {
    await hover(sel, { nth: label });
    await shot(`d18-${name}-trigger-hover`);
    await click(sel, { nth: label });
    await shot(`d19-${name}-menu-open`);
    await key("ArrowDown", "ArrowDown", 40);
    await key("ArrowDown", "ArrowDown", 40);
    await shot(`d20-${name}-menu-item-focus`);
    await esc();
  });
}
await safe("sort change", async () => {
  await click("css:[data-slot=dropdown-menu-trigger]", { nth: 0 });
  await click("Company Name", { within: "document.querySelector('[role=menu]')" });
  await moveAway();
  await shot("d21-sorted-by-company-name");
  await load();
});
await safe("stage filter", async () => {
  await click("css:[data-slot=dropdown-menu-trigger]", { nth: 2 });
  const items = await evaluate(
    `[...document.querySelectorAll('[role=menu] [role^=menuitem]')].map(e=>e.innerText.trim())`,
  );
  console.log("  stage items:", items);
  if (items[1]) {
    await click(items[1], { within: "document.querySelector('[role=menu]')" });
  }
  await esc();
  await moveAway();
  await shot("d22-filtered-by-stage");
  await load();
});

await safe("export", async () => {
  await hover("Export");
  await shot("d23-export-hover");
  await click("Export");
  await shot("d24-export-click");
  await esc();
});
await safe("new company btn hover", async () => {
  await hover("New Company");
  await shot("d25-primary-button-hover");
});

// New Company dialog
await safe("new company", async () => {
  await click("New Company");
  await shot("d26-new-company-dialog");
  await scrollOverlay();
  await shot("d27-new-company-dialog-scrolled");
  const selects = await evaluate(
    `[...document.querySelectorAll('[role=dialog] [role=combobox],[role=dialog] button[aria-haspopup]')].map(e=>(e.getAttribute('aria-label')||e.innerText).trim())`,
  );
  console.log("  dialog selects:", selects);
  await evaluate(
    `document.querySelector('[role=dialog] [role=combobox],[role=dialog] button[aria-haspopup]')?.scrollIntoView({block:'center'})`,
  );
  await sleep(400);
  if (selects[0]) {
    await click(selects[0], { within: "document.querySelector('[role=dialog]')" });
    await shot("d28-new-company-select-open");
    await esc();
  }
  // Try submitting empty to reveal validation.
  const btns = await evaluate(
    `[...document.querySelectorAll('[role=dialog] button')].map(e=>e.innerText.trim()).filter(Boolean)`,
  );
  console.log("  dialog buttons:", btns);
  const submit = btns.find((b) => /create|add|save/i.test(b));
  if (submit) {
    await click(submit, { within: "document.querySelector('[role=dialog]')" });
    await shot("d29-new-company-validation");
  }
  // Focused input state
  await evaluate(
    `(()=>{const i=document.querySelector('[role=dialog] input[type=text],[role=dialog] input:not([type])');i?.scrollIntoView({block:'center'});i?.focus()})()`,
  );
  await sleep(400);
  await shot("d30-new-company-input-focus");
  await esc();
  await sleep(400);
  await esc();
});

// Table
await safe("row hover", async () => {
  await hover("Open Snowflake details");
  await shot("d31-row-hover");
});
await safe("tag +2 hover", async () => {
  await hover("+2");
  await shot("d32-tag-overflow-hover");
  await click("+2");
  await shot("d33-tag-overflow-click");
  await esc();
});
await safe("win bar hover", async () => {
  const c = await evaluate(
    `(()=>{const th=[...document.querySelectorAll('th,[role=columnheader]')].find(e=>/Win Probability/.test(e.innerText));if(!th)return null;const r=th.getBoundingClientRect();return {x:r.x+r.width/2-20,y:r.bottom+30}})()`,
  );
  if (c) {
    await mouse("mouseMoved", c.x, c.y);
    await sleep(800);
    await shot("d34-win-probability-hover");
  }
});
await safe("trend hover", async () => {
  const c = await evaluate(
    `(()=>{const th=[...document.querySelectorAll('th,[role=columnheader]')].find(e=>/Activity Trend/.test(e.innerText));if(!th)return null;const r=th.getBoundingClientRect();return {x:r.x+r.width/2,y:r.bottom+30}})()`,
  );
  if (c) {
    await mouse("mouseMoved", c.x, c.y);
    await sleep(800);
    await shot("d35-activity-trend-hover");
  }
});
await safe("header hover", async () => {
  await hover("Pipeline Value", { nth: 0 });
  await shot("d36-column-header-hover");
});
await safe("checkbox", async () => {
  await moveAway();
  await click("Select Apple");
  await click("Select Stripe");
  await moveAway();
  await shot("d37-rows-selected");
  await click("Select all companies");
  await moveAway();
  await shot("d38-all-selected");
  await click("Select all companies");
  await moveAway();
  await shot("d39-none-selected");
});
await safe("person profile", async () => {
  await click("Open Alex Santos profile");
  await shot("d40-person-profile");
  await scrollOverlay();
  await shot("d41-person-profile-scrolled");
  await esc();
});
await safe("company details", async () => {
  await click("Open Apple details");
  await shot("d42-company-details");
  await scrollOverlay();
  await shot("d43-company-details-scrolled");
  await esc();
});
await safe("row action", async () => {
  const c = await evaluate(
    `(()=>{const rows=[...document.querySelectorAll('tbody tr')];const r=rows[0];if(!r)return null;const b=[...r.querySelectorAll('button')].pop();const x=b.getBoundingClientRect();return {x:x.x+x.width/2,y:x.y+x.height/2}})()`,
  );
  if (c) {
    await mouse("mouseMoved", c.x, c.y);
    await sleep(500);
    await shot("d44-row-action-hover");
    await mouse("mousePressed", c.x, c.y);
    await mouse("mouseReleased", c.x, c.y);
    await sleep(900);
    await shot("d45-row-action-open");
    await esc();
  }
});
await safe("row click", async () => {
  await click("Snowflake");
  await shot("d46-row-click");
  await esc();
});
await safe("footer", async () => {
  await hover("Sum of pipeline");
  await shot("d47-footer-calc-hover");
  await click("Sum of pipeline");
  await shot("d48-footer-calc-click");
  await esc();
  await click("Add Calculation");
  await shot("d49-footer-add-calculation");
  await esc();
});
await safe("table scroll bottom", async () => {
  await evaluate(
    `[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+20&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)).forEach(e=>e.scrollTop=e.scrollHeight)`,
  );
  await sleep(700);
  await shot("d50-table-scrolled-bottom");
});
await safe("keyboard focus", async () => {
  await load();
  for (let i = 0; i < 3; i++) await tab();
  await shot("d51-focus-sidebar-item");
  for (let i = 0; i < 17; i++) await tab();
  await shot("d52-focus-header");
  for (let i = 0; i < 5; i++) await tab();
  await shot("d53-focus-toolbar");
  for (let i = 0; i < 6; i++) await tab();
  await shot("d54-focus-table");
});
await safe("sidebar resize", async () => {
  await load();
  const c = await center("Resize sidebar");
  if (c) {
    await mouse("mouseMoved", c.x, c.y);
    await sleep(500);
    await shot("d55-sidebar-resize-hover");
    await mouse("mousePressed", c.x, c.y);
    for (let dx = 0; dx <= 120; dx += 20) await mouse("mouseMoved", c.x + dx, c.y);
    await mouse("mouseReleased", c.x + 120, c.y);
    await sleep(500);
    await shot("d56-sidebar-resized-wider");
    await mouse("mousePressed", c.x + 120, c.y);
    for (let dx = 120; dx >= -200; dx -= 20) await mouse("mouseMoved", c.x + dx, c.y);
    await mouse("mouseReleased", c.x - 200, c.y);
    await sleep(500);
    await shot("d57-sidebar-resized-collapsed");
  }
});

// ---------------- Other desktop sizes ----------------
for (const [w, h] of [
  [1920, 1080],
  [1280, 800],
  [1024, 768],
]) {
  await setViewport(w, h);
  await load();
  await moveAway();
  await shot(`s-${w}x${h}`);
}

// ---------------- Tablet 768x1024 ----------------
await setViewport(768, 1024, true);
await load();
await shot("t01-tablet-default");
await safe("tablet nav", async () => {
  await click("Open navigation");
  await shot("t02-tablet-nav-open");
  await esc();
});

// ---------------- Mobile 390x844 ----------------
await setViewport(390, 844, true);
await load();
await shot("m01-mobile-default");
await shot("m02-mobile-fullpage", { full: true });
await safe("mobile nav", async () => {
  await click("Open navigation");
  await shot("m03-mobile-nav-open");
  await esc();
});
await safe("mobile filters", async () => {
  await click("Filters");
  await shot("m04-mobile-filters-open");
  await scrollOverlay();
  await shot("m05-mobile-filters-scrolled");
  await esc();
});
await safe("mobile notifications", async () => {
  await click("Notifications, 3 unread");
  await shot("m06-mobile-notifications");
  await esc();
});
await safe("mobile profile", async () => {
  await click("Open profile for Jensen Ackles");
  await shot("m07-mobile-profile");
  await esc();
});
await safe("mobile new company", async () => {
  await load();
  await click("New Company");
  await shot("m08-mobile-new-company");
  await esc();
});
await safe("mobile scrolled", async () => {
  await load();
  await evaluate(
    `[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+20&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)).forEach(e=>e.scrollTop=e.scrollHeight/2)`,
  );
  await sleep(600);
  await shot("m09-mobile-scrolled");
});
await safe("mobile company details", async () => {
  await load();
  await click("Open Apple details");
  await shot("m10-mobile-company-details");
  await esc();
});

writeFileSync(join(RAW, "capture-log.json"), JSON.stringify(log, null, 2));
ws.close();
chrome.kill();
console.log("done:", log.length, "screens");
process.exit(0);
