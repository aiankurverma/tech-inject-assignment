import * as React from "react";

export interface RequestHistoryEntry<TDraft = unknown> {
  id: string;
  at: number;
  operationId: string;
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
  /** Request draft to restore. Callers must strip secrets before recording. */
  draft: TDraft;
}

function read<T>(key: string | null): RequestHistoryEntry<T>[] {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as RequestHistoryEntry<T>[]) : [];
  } catch {
    return [];
  }
}

/**
 * Bounded, newest-first request history. Persists to localStorage when `storageKey` is set
 * (failures such as private mode or quota are ignored and history stays in memory).
 */
export function useRequestHistory<TDraft>(storageKey: string | null, limit = 50) {
  const [entries, setEntries] = React.useState<RequestHistoryEntry<TDraft>[]>(() =>
    read<TDraft>(storageKey),
  );

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      // Storage unavailable: keep in-memory history only.
    }
  }, [entries, storageKey]);

  const add = React.useCallback(
    (e: Omit<RequestHistoryEntry<TDraft>, "id" | "at">) =>
      setEntries((prev) =>
        [
          {
            ...e,
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            at: Date.now(),
          },
          ...prev,
        ].slice(0, limit),
      ),
    [limit],
  );
  const remove = React.useCallback(
    (id: string) => setEntries((prev) => prev.filter((x) => x.id !== id)),
    [],
  );
  const clear = React.useCallback(() => setEntries([]), []);

  return { entries, add, remove, clear };
}
