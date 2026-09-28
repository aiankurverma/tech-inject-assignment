// Headless Chrome over the DevTools protocol (pipe transport, zero deps, no open debug port).
// Every network request is paused and checked by the SSRF guard before Chrome may send it.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";
import { assertPublicUrl, type Resolver } from "./guard";
import { EXTRACT_SCRIPT, type InventoryItem } from "./extract";
import type { RawStyles } from "./tokens";

export interface CaptureLimits {
  /** Whole capture (launch, load, extract, screenshot). */
  timeoutMs: number;
  /** Total bytes the page may download before it is aborted. */
  maxBytes: number;
  /** Max network requests the page may make. */
  maxRequests: number;
}

export const DEFAULT_LIMITS: CaptureLimits = {
  timeoutMs: 45_000,
  maxBytes: 15 * 1024 * 1024,
  maxRequests: 400,
};

export interface PageCapture {
  finalUrl: string;
  title: string;
  raw: RawStyles;
  inventory: InventoryItem[];
  /** JPEG data URL of the first viewport (1280x800). */
  screenshot: string | null;
}

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

export function findChrome(): string | null {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return CHROME_CANDIDATES.find((p) => existsSync(p)) ?? null;
}

type Json = Record<string, unknown>;
interface CdpMessage {
  id?: number;
  method?: string;
  params?: Json;
  result?: Json;
  error?: { message: string };
  sessionId?: string;
}

/** Minimal CDP client over Chrome's --remote-debugging-pipe (NUL-delimited JSON). */
class PipeCdp {
  private nextId = 1;
  private pending = new Map<number, { ok: (r: Json) => void; fail: (e: Error) => void }>();
  private listeners = new Set<(m: CdpMessage) => void>();
  private buf = "";

  constructor(
    private readonly out: Writable,
    input: Readable,
  ) {
    input.setEncoding("utf8");
    input.on("data", (chunk: string) => {
      this.buf += chunk;
      let i: number;
      while ((i = this.buf.indexOf("\0")) >= 0) {
        const msg = JSON.parse(this.buf.slice(0, i)) as CdpMessage;
        this.buf = this.buf.slice(i + 1);
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) p?.fail(new Error(msg.error.message));
          else p?.ok(msg.result ?? {});
        } else for (const l of this.listeners) l(msg);
      }
    });
  }

  send(method: string, params: Json = {}, sessionId?: string): Promise<Json> {
    const id = this.nextId++;
    return new Promise((ok, fail) => {
      this.pending.set(id, { ok, fail });
      this.out.write(JSON.stringify({ id, method, params, sessionId }) + "\0");
    });
  }

  on(fn: (m: CdpMessage) => void) {
    this.listeners.add(fn);
  }

  failAll(e: Error) {
    for (const p of this.pending.values()) p.fail(e);
    this.pending.clear();
  }
}

/** Loads `url` in a fresh headless Chrome and returns raw style counts, inventory and a screenshot. */
export async function capturePage(
  url: string,
  limits: CaptureLimits = DEFAULT_LIMITS,
  resolve?: Resolver,
): Promise<PageCapture> {
  const chromePath = findChrome();
  if (!chromePath) throw new Error("Chrome not found on the server. Set CHROME_PATH.");
  const profile = mkdtempSync(join(tmpdir(), "ti-capture-"));
  const chrome: ChildProcess = spawn(
    chromePath,
    [
      "--headless=new",
      "--remote-debugging-pipe",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-gpu",
      "--mute-audio",
      "--hide-scrollbars",
      "--window-size=1280,800",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
  );
  const cdp = new PipeCdp(chrome.stdio[3] as Writable, chrome.stdio[4] as Readable);
  chrome.on("exit", () => cdp.failAll(new Error("Browser exited.")));

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Capture timed out.")), limits.timeoutMs);
  });
  try {
    return await Promise.race([run(cdp, url, limits, resolve), timeout]);
  } finally {
    clearTimeout(timer);
    cdp.failAll(new Error("Capture finished."));
    chrome.kill();
    await new Promise((r) => setTimeout(r, 300));
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome may still hold files on Windows; the OS temp cleaner gets them.
    }
  }
}

async function run(
  cdp: PipeCdp,
  url: string,
  limits: CaptureLimits,
  resolve?: Resolver,
): Promise<PageCapture> {
  const { targetId } = (await cdp.send("Target.createTarget", { url: "about:blank" })) as {
    targetId: string;
  };
  const { sessionId } = (await cdp.send("Target.attachToTarget", { targetId, flatten: true })) as {
    sessionId: string;
  };
  const s = (method: string, params: Json = {}) => cdp.send(method, params, sessionId);

  let bytes = 0;
  let requests = 0;
  let aborted: string | null = null;
  const hostOk = new Map<string, Promise<boolean>>();
  let resolveLoad!: () => void;
  const loaded = new Promise<void>((r) => (resolveLoad = r));

  cdp.on((m) => {
    if (m.sessionId !== sessionId) return;
    const p = m.params ?? {};
    if (m.method === "Fetch.requestPaused") {
      const requestId = p.requestId as string;
      const reqUrl = (p.request as { url: string }).url;
      requests += 1;
      const deny = () => void s("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
      if (requests > limits.maxRequests || aborted) return deny();
      let origin: string;
      try {
        const u = new URL(reqUrl);
        if (u.protocol !== "http:" && u.protocol !== "https:") return deny();
        origin = `${u.protocol}//${u.host}`;
      } catch {
        return deny();
      }
      // One DNS check per origin per capture.
      let check = hostOk.get(origin);
      if (!check) {
        check = assertPublicUrl(`${origin}/`, resolve).then((r) => r.ok);
        hostOk.set(origin, check);
      }
      void check.then((ok) =>
        ok ? s("Fetch.continueRequest", { requestId }).catch(() => undefined) : deny(),
      );
    } else if (m.method === "Network.dataReceived") {
      bytes += (p.encodedDataLength as number) || (p.dataLength as number) || 0;
      if (bytes > limits.maxBytes && !aborted) {
        aborted = "Page is larger than the capture size limit.";
        void s("Page.stopLoading").catch(() => undefined);
      }
    } else if (m.method === "Page.loadEventFired") {
      resolveLoad();
    }
  });

  await s("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await s("Network.enable");
  await s("Page.enable");
  await s("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // No downloads, no popups doing work behind our back.
  await s("Browser.setDownloadBehavior", { behavior: "deny" }).catch(() => undefined);

  const nav = (await s("Page.navigate", { url })) as { errorText?: string };
  if (nav.errorText) throw new Error(`Could not load the page (${nav.errorText}).`);
  // Load event, capped so slow trackers do not hold the job; then a short settle for late CSS.
  await Promise.race([loaded, new Promise((r) => setTimeout(r, limits.timeoutMs * 0.5))]);
  await new Promise((r) => setTimeout(r, 1200));
  if (aborted) throw new Error(aborted);

  const evald = (await s("Runtime.evaluate", {
    expression: EXTRACT_SCRIPT,
    returnByValue: true,
    timeout: 10_000,
  })) as { result?: { value?: unknown }; exceptionDetails?: { text?: string } };
  if (evald.exceptionDetails || !evald.result?.value)
    throw new Error("Could not read styles from the page.");
  const value = evald.result.value as { raw: RawStyles; inventory: InventoryItem[]; title: string };

  const shot = (await s("Page.captureScreenshot", {
    format: "jpeg",
    quality: 60,
    clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 },
  }).catch(() => ({}))) as { data?: string };
  const hist = (await s("Page.getNavigationHistory")) as {
    currentIndex: number;
    entries: { url: string }[];
  };
  return {
    finalUrl: hist.entries[hist.currentIndex]?.url ?? url,
    title: value.title,
    raw: value.raw,
    inventory: value.inventory,
    // ~150 KB typical; drop anything oversized rather than bloat the document.
    screenshot:
      shot.data && shot.data.length < 1_500_000 ? `data:image/jpeg;base64,${shot.data}` : null,
  };
}
