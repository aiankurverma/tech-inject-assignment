import { useEffect, useRef, useState } from "react";
import { lookupFeature, reportSearch } from "./api";
import type { LookupResult } from "./api";

interface Props {
  /** The current search query string. */
  query: string;
  /** True when the search returned no component results. */
  noResults: boolean;
}

/** Tracks terms already reported during this page session (avoids double-reporting). */
const reportedTerms = new Set<string>();

/**
 * Shown next to a no-results search. Debounces 800 ms, reports the term once
 * per page session, then shows a "coming soon" notice if the feature is being built.
 */
export function ComingSoonNotice({ query, noResults }: Props) {
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [noted, setNoted] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const trimmed = query.trim();
  const shouldAct = noResults && trimmed.length >= 2;

  useEffect(() => {
    if (!shouldAct) {
      setLookup(null);
      setNoted(false);
      return;
    }

    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(() => {
      const term = trimmed.toLowerCase().replace(/\s+/g, " ");

      if (!reportedTerms.has(term)) {
        reportedTerms.add(term);
        // Fire-and-forget; 429s are expected under rate limiting
        reportSearch(term).catch(() => undefined);
      }

      lookupFeature(term)
        .then((result) => {
          setLookup(result);
          setNoted(true);
        })
        .catch(() => {
          setNoted(true);
        });
    }, 800);

    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [shouldAct, trimmed]);

  if (!shouldAct || !noted) return null;

  // No feature request found yet — subtle acknowledgement
  if (!lookup || lookup.status === "none") {
    return (
      <p className="mt-1 text-xs text-neutral-400" role="status">
        We noted your search.
      </p>
    );
  }

  // Feature is actively being built
  const eta = lookup.eta != null ? new Date(lookup.eta) : null;
  const daysAway =
    eta != null ? Math.max(0, Math.ceil((eta.getTime() - Date.now()) / 86_400_000)) : null;

  return (
    <div
      role="status"
      className="mt-2 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
    >
      <span className="font-medium">Coming soon: {lookup.term}</span>
      {eta != null && daysAway != null && (
        <span className="ml-1 text-neutral-500">
          {" — "}expected by {eta.toLocaleDateString(undefined, { dateStyle: "medium" })}, about{" "}
          {daysAway} {daysAway === 1 ? "day" : "days"}
        </span>
      )}
      <span className="ml-2 text-neutral-400">
        &mdash;{" "}
        {lookup.interested != null
          ? `${lookup.interested} ${lookup.interested === 1 ? "developer" : "developers"} asked for this`
          : "Be one of the first to ask for this"}
      </span>
    </div>
  );
}
