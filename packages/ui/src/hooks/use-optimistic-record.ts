import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface UseOptimisticRecordOptions<T> {
  queryKey: readonly unknown[];
  /** Initial / fallback data. */
  record?: T;
  /** Server fetch; omit to treat `record` as the source of truth. */
  loadRecord?: (signal: AbortSignal) => Promise<T>;
  /**
   * Persist a partial update; resolve with the saved record (or void to keep the optimistic one).
   * `next` is the record with the patch already applied. Reject to roll back.
   */
  onSave: (patch: Partial<T>, next: T) => Promise<T | void>;
  onSaved?: (record: T) => void;
  onSaveError?: (error: Error, patch: Partial<T>) => void;
}

/**
 * Record query + optimistic patch mutation. The cache is patched before the request and rolled
 * back to the snapshot if it fails (TanStack Query "optimistic updates via the cache" recipe).
 */
export function useOptimisticRecord<T extends object>({
  queryKey,
  record,
  loadRecord,
  onSave,
  onSaved,
  onSaveError,
}: UseOptimisticRecordOptions<T>) {
  const qc = useQueryClient();
  const query = useQuery<T>({
    queryKey,
    queryFn: loadRecord
      ? ({ signal }) => loadRecord(signal)
      : () => qc.getQueryData<T>(queryKey) ?? (record as T),
    initialData: record,
    enabled: !!loadRecord || record !== undefined,
    staleTime: loadRecord ? 30_000 : Infinity,
  });

  const mutation = useMutation<T | void, Error, Partial<T>, { previous?: T }>({
    mutationFn: async (patch) => {
      const next = qc.getQueryData<T>(queryKey) ?? ({ ...record, ...patch } as T);
      return onSave(patch, next);
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<T>(queryKey);
      if (previous) qc.setQueryData<T>(queryKey, { ...previous, ...patch });
      return { previous };
    },
    onError: (error, patch, ctx) => {
      if (ctx?.previous) qc.setQueryData<T>(queryKey, ctx.previous);
      onSaveError?.(error, patch);
    },
    onSuccess: (saved) => {
      if (saved) qc.setQueryData<T>(queryKey, saved);
      const current = qc.getQueryData<T>(queryKey);
      if (current) onSaved?.(current);
    },
    onSettled: () => {
      if (loadRecord) void qc.invalidateQueries({ queryKey });
    },
  });

  return { query, mutation };
}
