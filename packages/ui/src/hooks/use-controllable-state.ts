import * as React from "react";

/**
 * State that is controlled when `value` is defined and uncontrolled otherwise.
 * `onChange` fires in both modes; the setter identity is stable.
 */
export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [inner, setInner] = React.useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? (value as T) : inner;
  const ref = React.useRef({ current, controlled, onChange });
  ref.current = { current, controlled, onChange };

  const set = React.useCallback((next: T | ((prev: T) => T)) => {
    const { current: prev, controlled: c, onChange: cb } = ref.current;
    const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    if (Object.is(resolved, prev)) return;
    if (!c) setInner(resolved);
    ref.current.current = resolved;
    cb?.(resolved);
  }, []);

  return [current, set];
}
