import * as React from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface PartialResponse<T = Record<string, unknown>> {
  values: T;
  step: number;
  savedAt: string;
}

export interface UseFormAutosaveOptions<T> {
  /** Called (debounced) with a JSON-safe snapshot. Throw / reject to report a failed save. */
  onSave?: (partial: PartialResponse<T>) => void | Promise<void>;
  /** Also mirror the draft to localStorage under this key (per browser, best effort). */
  storageKey?: string;
  delayMs?: number;
  enabled?: boolean;
}

/** Files cannot be serialised; keep their metadata so the draft still says what was attached. */
export function toSerializable(value: unknown): unknown {
  if (typeof File !== "undefined" && value instanceof File)
    return { name: value.name, size: value.size, type: value.type };
  if (Array.isArray(value)) return value.map(toSerializable);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toSerializable(v);
    return out;
  }
  return value;
}

/** Reads a draft previously mirrored to localStorage (null when absent or storage is blocked). */
export function readStoredDraft<T>(storageKey?: string): PartialResponse<T> | null {
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as PartialResponse<T>) : null;
  } catch {
    return null;
  }
}

/**
 * Debounced partial-response saving. Call `schedule(values, step)` on every change; the latest
 * snapshot is saved after `delayMs` of quiet, and `flush()` saves immediately (e.g. on step change).
 */
export function useFormAutosave<T extends Record<string, unknown>>({
  onSave,
  storageKey,
  delayMs = 800,
  enabled = true,
}: UseFormAutosaveOptions<T>) {
  const [status, setStatus] = React.useState<AutosaveStatus>("idle");
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const pending = React.useRef<PartialResponse<T> | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = React.useRef(onSave);
  saveRef.current = onSave;
  const active = enabled && (!!onSave || !!storageKey);

  const flush = React.useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const snapshot = pending.current;
    if (!snapshot) return;
    pending.current = null;
    setStatus("saving");
    try {
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
        } catch {
          /* storage full or blocked: remote save still counts */
        }
      }
      await saveRef.current?.(snapshot);
      setSavedAt(new Date(snapshot.savedAt));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [storageKey]);

  const schedule = React.useCallback(
    (values: T, step: number) => {
      if (!active) return;
      pending.current = {
        values: toSerializable(values) as T,
        step,
        savedAt: new Date().toISOString(),
      };
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delayMs);
    },
    [active, delayMs, flush],
  );

  const clear = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    setStatus("idle");
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }, [storageKey]);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { status, savedAt, schedule, flush, clear, active };
}
