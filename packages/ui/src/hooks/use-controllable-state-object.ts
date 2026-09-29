import * as React from "react";

type Updater<T> = T | ((prev: T) => T);

/**
 * State that is controlled when `value` is defined and uncontrolled otherwise.
 * The setter accepts a value or an updater and always reports through `onChange`.
 * Updaters run against the latest value (a ref), so rapid successive updates compose.
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value?: T;
  defaultValue: T | (() => T);
  onChange?: (next: T) => void;
}): [T, (next: Updater<T>) => void] {
  const [inner, setInner] = React.useState<T>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? (value as T) : inner;
  const latest = React.useRef(current);
  const onChangeRef = React.useRef(onChange);

  React.useLayoutEffect(() => {
    latest.current = current;
    onChangeRef.current = onChange;
  });

  const set = React.useCallback(
    (next: Updater<T>) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(latest.current) : next;
      if (Object.is(resolved, latest.current)) return;
      latest.current = resolved;
      if (!controlled) setInner(resolved);
      onChangeRef.current?.(resolved);
    },
    [controlled],
  );

  return [current, set];
}
