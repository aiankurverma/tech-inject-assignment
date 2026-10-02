/**
 * Anonymous "view" beacon for the usage analytics. Fire-and-forget: sendBeacon survives page
 * unloads and never blocks rendering. Only the slug is sent; nothing about the visitor.
 */
export function trackView(slug: string) {
  try {
    const body = new Blob([JSON.stringify({ slug, type: "view" })], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/events", body)) return;
    void fetch("/api/events", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // Analytics must never break the page.
  }
}
