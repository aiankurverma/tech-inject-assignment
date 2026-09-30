/**
 * Theme Studio state shared with the Page Builder and Prompt-to-screen previews: the theme
 * document, undo/redo history and the last theme persisted in localStorage. Only the theme is
 * persisted; history starts fresh on reload.
 */
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_THEME_DOC,
  generateThemeBlock,
  modeSpec,
  normalizeThemeDoc,
  type Theme,
} from "@ti/core";

export const THEME_STORAGE_KEY = "kitbase.theme";
const HISTORY_LIMIT = 100;
/** Drags on one colour picker within this window collapse into one undo step. */
const COALESCE_MS = 800;

export interface ThemeState {
  theme: Theme;
  past: Theme[];
  future: Theme[];
  /**
   * Applies a change as one undoable step. `coalesce` names a field whose repeated edits within
   * COALESCE_MS share one step (colour picker drags, slider moves, typing a name).
   */
  update: (fn: (theme: Theme) => Theme, coalesce?: string) => void;
  /** Replaces the theme (preset, import, share link). Always its own undo step. */
  replace: (theme: Theme) => void;
  undo: () => void;
  redo: () => void;
}

let lastEdit: { key: string; at: number } | null = null;

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: DEFAULT_THEME_DOC,
      past: [],
      future: [],
      update: (fn, coalesce) => {
        const { theme, past } = get();
        const next = fn(theme);
        if (next === theme) return;
        const now = Date.now();
        const merge = coalesce && lastEdit?.key === coalesce && now - lastEdit.at < COALESCE_MS;
        lastEdit = coalesce ? { key: coalesce, at: now } : null;
        set({
          theme: next,
          past: merge ? past : [...past.slice(-(HISTORY_LIMIT - 1)), theme],
          future: [],
        });
      },
      replace: (next) => {
        lastEdit = null;
        const { theme, past } = get();
        set({ theme: next, past: [...past.slice(-(HISTORY_LIMIT - 1)), theme], future: [] });
      },
      undo: () => {
        const { theme, past, future } = get();
        const prev = past[past.length - 1];
        if (!prev) return;
        lastEdit = null;
        set({ theme: prev, past: past.slice(0, -1), future: [theme, ...future] });
      },
      redo: () => {
        const { theme, past, future } = get();
        const [next, ...rest] = future;
        if (!next) return;
        lastEdit = null;
        set({ theme: next, past: [...past, theme], future: rest });
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      // Storage can be blocked (private mode); the studio still works for the visit.
      storage: createJSONStorage(() => {
        try {
          localStorage.getItem(THEME_STORAGE_KEY);
          return localStorage;
        } catch {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
      }),
      partialize: (s) => ({ theme: s.theme }),
      merge: (persisted, current) => ({
        ...current,
        theme: normalizeThemeDoc((persisted as { theme?: unknown } | undefined)?.theme),
      }),
    },
  ),
);

/**
 * The `@theme` block for the mode being edited, appended to component previews so the Page
 * Builder and Prompt-to-screen render with the user's theme.
 */
export function useThemeCss(): string {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(
    () => generateThemeBlock(modeSpec(theme), `Kitbase theme: ${theme.name}`),
    [theme],
  );
}
