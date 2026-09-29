import * as React from "react";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import type { AuditFilters, AuditTimeMode } from "@/components/crm/pro-audit-log/types";

const TIME_MODES = ["relative", "absolute"] as const;

const parsers = {
  q: parseAsString.withDefault(""),
  actor: parseAsArrayOf(parseAsString).withDefault([]),
  action: parseAsArrayOf(parseAsString).withDefault([]),
  resource: parseAsArrayOf(parseAsString).withDefault([]),
  from: parseAsString,
  to: parseAsString,
  time: parseAsStringLiteral(TIME_MODES).withDefault("relative"),
};

/**
 * Persists audit-log filters and the time display mode in the URL (shareable, back-button safe)
 * via nuqs. Requires a nuqs adapter (e.g. NuqsAdapter from "nuqs/adapters/react" or /next/app).
 */
export function useAuditLogUrlState() {
  const [state, setState] = useQueryStates(parsers, { history: "replace", clearOnDefault: true });

  const filters = React.useMemo<AuditFilters>(
    () => ({
      q: state.q,
      actors: state.actor,
      actions: state.action,
      resources: state.resource,
      from: state.from,
      to: state.to,
    }),
    [state.q, state.actor, state.action, state.resource, state.from, state.to],
  );

  const setFilters = React.useCallback(
    (f: AuditFilters) =>
      void setState({
        q: f.q,
        actor: f.actors,
        action: f.actions,
        resource: f.resources,
        from: f.from,
        to: f.to,
      }),
    [setState],
  );

  const setTimeMode = React.useCallback(
    (time: AuditTimeMode) => void setState({ time }),
    [setState],
  );

  return { filters, setFilters, timeMode: state.time as AuditTimeMode, setTimeMode };
}
