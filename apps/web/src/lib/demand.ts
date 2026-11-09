/**
 * Anonymous on-site search signal. The server stores only the normalised query, result count,
 * zero-result flag and whether a result was clicked. No IP, account or email is sent.
 */
export interface SearchSignal {
  query: string;
  resultCount: number;
  clicked?: boolean;
  matchedSlug?: string;
}

export function reportSearch(signal: SearchSignal) {
  const query = signal.query.trim();
  if (query.length < 2) return;
  try {
    void fetch("/api/demand/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ ...signal, query }),
    }).catch(() => undefined);
  } catch {
    // Analytics must never break search.
  }
}
