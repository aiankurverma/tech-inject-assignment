import * as React from "react";

/** Minimal slice of pdf.js' PDFDocumentProxy that search needs (keeps this hook library-agnostic). */
export interface SearchablePdf {
  numPages: number;
  getPage(n: number): Promise<{
    getTextContent(): Promise<{ items: Array<{ str?: string } | object> }>;
  }>;
}

export interface PdfMatch {
  /** 1-based page number. */
  page: number;
  /** Index of the match within its page, in reading order. */
  indexOnPage: number;
}

export interface PdfSearchState {
  matches: PdfMatch[];
  /** Pages whose text has been extracted so far (progress while indexing a large file). */
  indexed: number;
  searching: boolean;
  /**
   * For page p and text item i: number of matches that occur in earlier items of that page.
   * Lets a text renderer mark which highlight is the active one.
   */
  itemOffsets: Map<number, number[]>;
  regex: RegExp | null;
}

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Full-document text search over a pdf.js document. Page text is extracted once per document
 * (cached, sequential so large PDFs never flood the worker) and each query is matched against
 * the cache, so re-typing is instant after the first pass.
 */
export function usePdfSearch(pdf: SearchablePdf | null, query: string, caseSensitive = false) {
  const cache = React.useRef(new Map<number, string[]>());
  const [indexed, setIndexed] = React.useState(0);
  const [version, setVersion] = React.useState(0);
  const [debounced, setDebounced] = React.useState(query);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Reset the cache when the document changes.
  React.useEffect(() => {
    cache.current = new Map();
    setIndexed(0);
    setVersion((v) => v + 1);
  }, [pdf]);

  // Extract page text lazily: only once somebody searches.
  React.useEffect(() => {
    if (!pdf || !debounced.trim() || cache.current.size === pdf.numPages) return;
    let alive = true;
    (async () => {
      for (let n = 1; n <= pdf.numPages && alive; n++) {
        if (cache.current.has(n)) continue;
        try {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          cache.current.set(
            n,
            content.items.map((it) => ("str" in it && typeof it.str === "string" ? it.str : "")),
          );
        } catch {
          cache.current.set(n, []);
        }
        if (n % 8 === 0 || n === pdf.numPages) {
          setIndexed(cache.current.size);
          setVersion((v) => v + 1);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [pdf, debounced]);

  return React.useMemo<PdfSearchState>(() => {
    const q = debounced.trim();
    const empty = { matches: [], itemOffsets: new Map(), regex: null };
    if (!pdf || !q) return { ...empty, indexed, searching: false };
    const regex = new RegExp(escapeRegExp(q), caseSensitive ? "g" : "gi");
    const matches: PdfMatch[] = [];
    const itemOffsets = new Map<number, number[]>();
    for (let n = 1; n <= pdf.numPages; n++) {
      const items = cache.current.get(n);
      if (!items) continue;
      const offsets: number[] = [];
      let count = 0;
      for (const str of items) {
        offsets.push(count);
        const found = str.match(regex);
        if (found) {
          for (let k = 0; k < found.length; k++) matches.push({ page: n, indexOnPage: count + k });
          count += found.length;
        }
      }
      itemOffsets.set(n, offsets);
    }
    return {
      matches,
      itemOffsets,
      regex,
      indexed,
      searching: cache.current.size < pdf.numPages,
    };
    // version bumps when new pages land in the cache
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, debounced, caseSensitive, indexed, version]);
}
