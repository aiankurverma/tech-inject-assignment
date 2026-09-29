import * as React from "react";
import {
  createHighlighter,
  createJavaScriptRegexEngine,
  type BundledLanguage,
  type HighlighterGeneric,
  type ThemedToken,
} from "shiki";

export interface HighlightToken {
  content: string;
  color?: string;
  fontStyle?: number;
}

type Highlighter = HighlighterGeneric<BundledLanguage, string>;

const THEME = "github-dark-default";
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();

/** One shared Shiki highlighter per page (JS regex engine: no WASM fetch, CSP friendly). */
async function getHighlighter(lang: string): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [THEME],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  }) as Promise<Highlighter>;
  const hl = await highlighterPromise;
  if (!loadedLangs.has(lang)) {
    await hl.loadLanguage(lang as BundledLanguage);
    loadedLangs.add(lang);
  }
  return hl;
}

const toTokens = (line: ThemedToken[]): HighlightToken[] =>
  line.map((t) => ({ content: t.content, color: t.color, fontStyle: t.fontStyle }));

export interface ShikiLines {
  /** Tokens for a 1-based line of the old/new document, or null while loading/unavailable. */
  tokensFor: (side: "old" | "new", lineNo: number, text: string) => HighlightToken[] | null;
  ready: boolean;
  error: Error | null;
}

/**
 * Highlights both sides of a diff with Shiki. Documents up to `fullLimit` lines are tokenized as a
 * whole (accurate multi-line grammar state); larger ones are tokenized lazily per visible line and
 * cached, which keeps 50k-line files interactive at the cost of multi-line construct accuracy.
 */
export function useShikiLines(
  oldText: string,
  newText: string,
  lang: string | undefined,
  fullLimit = 4000,
): ShikiLines {
  const [hl, setHl] = React.useState<Highlighter | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!lang || lang === "text") return;
    let alive = true;
    getHighlighter(lang).then(
      (h) => alive && setHl(h),
      (e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      alive = false;
    };
  }, [lang]);

  const full = React.useMemo(() => {
    if (!hl || !lang) return null;
    const count = (s: string) => s.split("\n").length;
    if (count(oldText) > fullLimit || count(newText) > fullLimit) return null;
    try {
      const opts = { lang: lang as BundledLanguage, theme: THEME };
      return {
        old: hl.codeToTokensBase(oldText, opts).map(toTokens),
        new: hl.codeToTokensBase(newText, opts).map(toTokens),
      };
    } catch {
      return null;
    }
  }, [hl, lang, oldText, newText, fullLimit]);

  const cache = React.useMemo(() => new Map<string, HighlightToken[]>(), [hl, lang]);

  const tokensFor = React.useCallback(
    (side: "old" | "new", lineNo: number, text: string) => {
      if (!hl || !lang) return null;
      if (full) return full[side][lineNo - 1] ?? null;
      if (text.length > 2000) return null;
      let hit = cache.get(text);
      if (!hit) {
        try {
          hit = toTokens(
            hl.codeToTokensBase(text, { lang: lang as BundledLanguage, theme: THEME })[0] ?? [],
          );
        } catch {
          return null;
        }
        if (cache.size > 20000) cache.clear();
        cache.set(text, hit);
      }
      return hit;
    },
    [hl, lang, full, cache],
  );

  return { tokensFor, ready: !!hl, error };
}
