import * as React from "react";

/** Controlled / uncontrolled state in one hook: `value` wins when defined. */
export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] {
  const [inner, setInner] = React.useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? (value as T) : inner;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const set = React.useCallback(
    (next: T) => {
      if (!controlled) setInner(next);
      onChangeRef.current?.(next);
    },
    [controlled],
  );
  return [current, set];
}
