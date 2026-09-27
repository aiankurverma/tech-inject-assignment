import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../types";

export interface LoadState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (d: T) => void;
}

/** Runs `fn` on mount (and when `key` changes); exposes data, error and a reload. */
export function useLoad<T>(fn: () => Promise<T>, key = ""): LoadState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fnRef.current();
      if (alive.current) setData(d);
    } catch (e) {
      if (alive.current) setError(errorMessage(e, "Could not load"));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, key]);

  return { data, error, loading, reload, setData };
}
