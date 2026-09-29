import { useEffect, useState } from "react";
import {
  ProWebhookInspector,
  type WebhookAttempt,
  type WebhookEndpoint,
  type WebhookEvent,
} from "@/components/crm/pro-webhook-inspector";
import { hmacSha256Hex } from "@/hooks/use-webhook-signature";

const endpoints: WebhookEndpoint[] = [
  {
    id: "ep_billing",
    url: "https://api.northwind.io/hooks/stripe-billing",
    description: "Billing",
  },
  { id: "ep_crm", url: "https://crm.acme-corp.com/webhooks/kitbase", description: "CRM sync" },
  {
    id: "ep_slack",
    url: "https://hooks.zapier.com/hooks/catch/88213/ab12cd",
    description: "Zapier",
  },
  { id: "ep_legacy", url: "http://legacy-erp.internal:8080/notify", description: "Legacy ERP" },
];
const secrets: Record<string, string> = {
  ep_billing: "whsec_9f3b1c7e2a40d6",
  ep_crm: "whsec_c2e8a91b44f07d",
  ep_slack: "whsec_71ad0e5f93b2c8",
  ep_legacy: "whsec_legacy_0000",
};
const TYPES = [
  "invoice.paid",
  "invoice.payment_failed",
  "customer.created",
  "customer.updated",
  "subscription.renewed",
  "subscription.cancelled",
  "deal.stage_changed",
  "contact.merged",
];
const NOW = Date.UTC(2026, 8, 29, 12, 0, 0);

// Deterministic PRNG so the preview is stable.
let seed = 42;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;

function resp(
  code: number | null,
): Pick<WebhookAttempt, "responseHeaders" | "responseBody" | "error"> {
  if (code == null)
    return { error: pick(["ETIMEDOUT after 30000ms", "ECONNREFUSED", "TLS handshake failed"]) };
  const body =
    code < 300
      ? JSON.stringify({ received: true })
      : code === 429
        ? JSON.stringify({ error: "rate_limited", retry_after: 30 })
        : code >= 500
          ? "<html><body><h1>502 Bad Gateway</h1>nginx</body></html>"
          : JSON.stringify({
              error: "invalid_signature",
              message: "No signatures found matching the expected signature",
            });
  return {
    responseHeaders: {
      "content-type": body.startsWith("<") ? "text/html" : "application/json",
      "x-request-id": `req_${Math.floor(rnd() * 1e10).toString(36)}`,
      ...(code === 429 ? { "retry-after": "30" } : {}),
    },
    responseBody: body,
  };
}

function buildEvents(n: number) {
  const events: (WebhookEvent & { t: number })[] = [];
  for (let i = 0; i < n; i++) {
    const endpointId =
      rnd() < 0.45 ? "ep_billing" : rnd() < 0.6 ? "ep_crm" : rnd() < 0.7 ? "ep_slack" : "ep_legacy";
    const type = pick(TYPES);
    const created = NOW - Math.floor(rnd() * 14 * 86_400_000);
    const id = `evt_${(1_000_000 + i * 7919).toString(36)}${Math.floor(rnd() * 1e6).toString(36)}`;
    const payload = JSON.stringify({
      id,
      type,
      created: Math.floor(created / 1000),
      livemode: true,
      data: {
        object: {
          id: `${type.split(".")[0]}_${Math.floor(rnd() * 1e8).toString(36)}`,
          amount: Math.round(rnd() * 250_000),
          currency: pick(["usd", "eur", "gbp", "inr"]),
          customer: `cus_${Math.floor(rnd() * 1e8).toString(36)}`,
          metadata: { workspace: pick(["acme", "northwind", "globex"]), source: "api" },
        },
      },
    });
    // Failure profile per endpoint: legacy ERP is flaky, Zapier rate-limits.
    const failP = endpointId === "ep_legacy" ? 0.75 : endpointId === "ep_slack" ? 0.2 : 0.05;
    const attempts: WebhookAttempt[] = [];
    let t = created + 400;
    let done = false;
    for (let a = 0; a < 6 && !done && t < NOW; a++) {
      const fail = rnd() < failP;
      const code = fail
        ? endpointId === "ep_legacy"
          ? pick([null, 500, 502, 503] as const)
          : pick([429, 400, 500] as const)
        : 200;
      attempts.push({
        id: `${id}_a${a}`,
        attemptedAt: t,
        statusCode: code,
        durationMs: code == null ? null : Math.round(40 + rnd() * (code >= 500 ? 2500 : 400)),
        requestHeaders: {
          "content-type": "application/json",
          "user-agent": "Kitbase-Webhooks/2.3",
          "webhook-id": id,
          "webhook-signature": "",
        },
        ...resp(code),
      });
      done = code != null && code < 300;
      t += 60_000 * 5 ** a; // 1m, 5m, 25m, ~2h, ~10h back-off
    }
    const nextRetryAt =
      !done && attempts.length < 6 && t > NOW - 3_600_000 ? Math.max(t, NOW + 120_000) : null;
    events.push({
      id,
      type,
      endpointId,
      createdAt: created,
      payload,
      attempts,
      nextRetryAt,
      t: created,
    });
  }
  return events.sort((a, b) => b.t - a.t);
}

/** Signs every attempt like a real sender would; ~1% get a tampered signature to exercise the verifier. */
async function signAll(events: ReturnType<typeof buildEvents>) {
  const subtle = globalThis.crypto.subtle;
  const enc = new TextEncoder();
  const keys = new Map<string, Promise<CryptoKey>>();
  const key = (s: string) => {
    if (!keys.has(s))
      keys.set(
        s,
        subtle.importKey("raw", enc.encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
      );
    return keys.get(s)!;
  };
  const sign = async (s: string, m: string) =>
    Array.from(new Uint8Array(await subtle.sign("HMAC", await key(s), enc.encode(m))), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  const jobs: Promise<void>[] = [];
  for (const ev of events) {
    for (const [i, a] of ev.attempts.entries()) {
      const ts = Math.floor(Number(a.attemptedAt) / 1000);
      const secret = ev.id.endsWith("7") && i === 0 ? "whsec_rotated_old" : secrets[ev.endpointId]!;
      jobs.push(
        sign(secret, `${ts}.${ev.payload}`).then((sig) => {
          a.requestHeaders["webhook-signature"] = `t=${ts},v1=${sig}`;
        }),
      );
    }
  }
  await Promise.all(jobs);
  return events;
}

export default function Example() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    seed = 42;
    signAll(buildEvents(10_000)).then(
      (e) => {
        setEvents(e);
        setSelected(e[0]?.id ?? null);
        setLoading(false);
      },
      (e: unknown) => {
        // No WebCrypto (insecure origin): fall back to unsigned events rather than failing.
        setEvents(buildEvents(10_000));
        setError(null);
        setLoading(false);
        console.warn(e);
      },
    );
  };
  useEffect(load, []);

  return (
    <ProWebhookInspector
      className="w-full max-w-[1200px]"
      events={events}
      endpoints={endpoints}
      loading={loading}
      error={error}
      onRetryLoad={load}
      now={NOW}
      selectedEventId={selected}
      onSelectedEventChange={setSelected}
      getSigningSecret={(id) => secrets[id]}
      onReplay={async (ev) => {
        await new Promise((r) => setTimeout(r, 900));
        if (ev.endpointId === "ep_legacy")
          throw new Error("Endpoint refused connection (ECONNREFUSED)");
        const ts = Math.floor(Date.now() / 1000);
        return {
          id: `${ev.id}_replay_${ts}`,
          attemptedAt: Date.now(),
          statusCode: 200,
          durationMs: 182,
          requestHeaders: {
            "content-type": "application/json",
            "webhook-id": ev.id,
            "webhook-signature": `t=${ts},v1=${await hmacSha256Hex(secrets[ev.endpointId]!, `${ts}.${ev.payload}`)}`,
          },
          responseHeaders: { "content-type": "application/json" },
          responseBody: JSON.stringify({ received: true, replay: true }),
        };
      }}
    />
  );
}
