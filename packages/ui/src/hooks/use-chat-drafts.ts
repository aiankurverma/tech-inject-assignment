import * as React from "react";

/** Serialisable draft; `doc` is the editor JSON so formatting and mentions survive a switch. */
export interface ChatDraft {
  doc: unknown;
  text: string;
}

/**
 * Per-conversation composer drafts. Values live in a ref (typing never re-renders the
 * workspace); only the set of keys that hold non-empty drafts is state, so the channel list can
 * show a "draft" marker.
 */
export function useChatDrafts(initial?: Record<string, ChatDraft>) {
  const store = React.useRef<Map<string, ChatDraft>>(new Map(Object.entries(initial ?? {})));
  const [keys, setKeys] = React.useState<ReadonlySet<string>>(
    () => new Set(Object.keys(initial ?? {})),
  );

  const get = React.useCallback((key: string) => store.current.get(key), []);

  const set = React.useCallback((key: string, draft: ChatDraft | null) => {
    const empty = !draft || draft.text.trim() === "";
    if (empty) store.current.delete(key);
    else store.current.set(key, draft);
    setKeys((prev) => {
      if (prev.has(key) === !empty) return prev;
      const next = new Set(prev);
      if (empty) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return { get, set, keys };
}
