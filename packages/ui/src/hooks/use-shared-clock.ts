import * as React from "react";

type Listener = () => void;

/**
 * One interval per tick size shared by every subscriber, so 50 visible SLA timers cost one timer,
 * and only the timer leaves re-render (rows stay memoised).
 */
const clocks = new Map<number, { now: number; listeners: Set<Listener>; id?: number }>();

function clockFor(ms: number) {
  let c = clocks.get(ms);
  if (!c) {
    c = { now: Date.now(), listeners: new Set() };
    clocks.set(ms, c);
  }
  return c;
}

export function useSharedClock(tickMs = 1000, frozen?: Date | number): number {
  const clock = clockFor(tickMs);
  const subscribe = React.useCallback(
    (cb: Listener) => {
      clock.listeners.add(cb);
      if (clock.id === undefined) {
        clock.id = window.setInterval(() => {
          clock.now = Date.now();
          clock.listeners.forEach((l) => l());
        }, tickMs);
      }
      return () => {
        clock.listeners.delete(cb);
        if (!clock.listeners.size && clock.id !== undefined) {
          window.clearInterval(clock.id);
          clock.id = undefined;
        }
      };
    },
    [clock, tickMs],
  );
  const now = React.useSyncExternalStore(
    subscribe,
    () => clock.now,
    () => clock.now,
  );
  return frozen === undefined ? now : +frozen;
}
