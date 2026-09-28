// SSRF guard: the capture browser may only reach public http(s) hosts.
// Checked on the submitted URL and again on every request the page makes (redirects included).
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type GuardResult = { ok: true; url: URL } | { ok: false; reason: string };

const BLOCKED_NAMES = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/i;

const v4ToInt = (ip: string) => ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;

// [network, prefix bits]: loopback, private, CGNAT, link-local (cloud metadata), test, multicast, reserved.
const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function blockedV4(ip: string) {
  const n = v4ToInt(ip);
  return V4_BLOCKS.some(([net, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(net) & mask);
  });
}

/** Expands an IPv6 literal to 8 hextets (handles `::` and a trailing dotted IPv4). */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0]!;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s)?.[1];
  if (v4) {
    const n = v4ToInt(v4);
    s = s.slice(0, -v4.length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split("::") as [string, string | undefined];
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const fill = s.includes("::") ? 8 - h.length - t.length : 0;
  const all = [...h, ...Array<string>(Math.max(0, fill)).fill("0"), ...t];
  if (all.length !== 8) return null;
  return all.map((x) => parseInt(x || "0", 16));
}

/** True for any address the capture browser must never touch. */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return blockedV4(ip);
  if (kind !== 6) return true;
  const h = expandV6(ip);
  if (!h) return true;
  const zeroPrefix = h.slice(0, 5).every((x) => x === 0);
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible: judge the embedded IPv4.
  if (zeroPrefix && (h[5] === 0xffff || h[5] === 0)) {
    if (h[5] === 0 && h[6] === 0 && (h[7] === 0 || h[7] === 1)) return true; // :: and ::1
    const v4 = `${h[6]! >> 8}.${h[6]! & 255}.${h[7]! >> 8}.${h[7]! & 255}`;
    return blockedV4(v4);
  }
  if (h[0] === 0x64 && h[1] === 0xff9b) return true; // NAT64 can reach private IPv4
  if ((h[0]! & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((h[0]! & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((h[0]! & 0xff00) === 0xff00) return true; // multicast
  if (h[0] === 0x2001 && h[1] === 0xdb8) return true; // documentation
  return false;
}

/** Shape check only (no DNS): http/https, no credentials, standard-looking host, sane length. */
export function parseCaptureUrl(input: string): GuardResult {
  if (input.length > 2048) return { ok: false, reason: "URL is too long." };
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "Not a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { ok: false, reason: "Only http and https URLs can be captured." };
  if (url.username || url.password)
    return { ok: false, reason: "URLs with credentials are not allowed." };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || BLOCKED_NAMES.test(host) || !(host.includes(".") || isIP(host)))
    return { ok: false, reason: "That host is not a public website." };
  if (isIP(host) && isBlockedIp(host))
    return { ok: false, reason: "Private, loopback and metadata addresses are blocked." };
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port))
    return { ok: false, reason: "Only ports 80, 443, 8080 and 8443 are allowed." };
  url.hash = "";
  return { ok: true, url };
}

export type Resolver = (host: string) => Promise<string[]>;

const dnsResolver: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

/** Full check: shape, then every DNS answer must be public (defeats `evil.com -> 127.0.0.1`). */
export async function assertPublicUrl(
  input: string,
  resolve: Resolver = dnsResolver,
): Promise<GuardResult> {
  const shape = parseCaptureUrl(input);
  if (!shape.ok) return shape;
  const host = shape.url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return shape;
  let addrs: string[];
  try {
    addrs = await resolve(host);
  } catch {
    return { ok: false, reason: "The host name does not resolve." };
  }
  if (!addrs.length) return { ok: false, reason: "The host name does not resolve." };
  if (addrs.some(isBlockedIp))
    return { ok: false, reason: "The host resolves to a private or reserved address." };
  return shape;
}
