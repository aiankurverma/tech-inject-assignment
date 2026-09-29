import * as React from "react";
import { Document, Page, Thumbnail, pdfjs } from "react-pdf";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronDown,
  ChevronUp,
  FileWarning,
  MoveHorizontal,
  PanelLeft,
  RotateCw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePdfSearch, type SearchablePdf } from "@/hooks/use-pdf-search";
import type { PreviewFile } from "@/components/crm/pro-file-preview/types";
import {
  Spinner,
  ToolButton,
  ToolDivider,
  Toolbar,
  ViewerMessage,
} from "@/components/crm/pro-file-preview/toolbar";

export interface PdfViewerHandle {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  rotate(): void;
  focusSearch(): void;
}

export interface PdfViewerProps {
  file: PreviewFile;
  /**
   * URL of pdf.worker.min.mjs. Defaults to the matching pdfjs-dist build on unpkg; self-host it
   * (e.g. `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`) under a strict CSP.
   */
  workerSrc?: string;
  /** Show the thumbnail rail initially (hidden automatically below 640px). */
  defaultShowThumbnails?: boolean;
}

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const PAGE_GAP = 16;
const THUMB_WIDTH = 104;

function ensureWorker(src?: string) {
  if (src) pdfjs.GlobalWorkerOptions.workerSrc = src;
  else if (!pdfjs.GlobalWorkerOptions.workerSrc)
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * PDF viewer on react-pdf / pdf.js: virtualised page list (only visible pages mount), virtualised
 * thumbnail rail, fit-width and step zoom, rotation, page jump and full-text search with
 * highlighted, navigable matches.
 */
export const PdfViewer = React.forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { file, workerSrc, defaultShowThumbnails = true },
  ref,
) {
  ensureWorker(workerSrc);

  // pdf.js transfers (detaches) byte buffers to its worker, so hand it a private copy.
  const source = React.useMemo(() => {
    const src = file.src;
    if (!src) return null;
    if (typeof src === "string" || src instanceof Blob) return src;
    return { data: src instanceof Uint8Array ? src.slice() : new Uint8Array(src.slice(0)) };
  }, [file.src]);

  const [pdf, setPdf] = React.useState<(SearchablePdf & object) | null>(null);
  const [numPages, setNumPages] = React.useState(0);
  const [aspect, setAspect] = React.useState(1.294); // US Letter until page 1 is measured
  const [error, setError] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState<number | "fit">("fit");
  const [rotation, setRotation] = React.useState(0);
  const [showThumbs, setShowThumbs] = React.useState(defaultShowThumbnails);
  const [current, setCurrent] = React.useState(1);
  const [pageInput, setPageInput] = React.useState("1");
  const [query, setQuery] = React.useState("");
  const [activeMatch, setActiveMatch] = React.useState(0);
  const [viewportWidth, setViewportWidth] = React.useState(800);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const thumbsRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setPdf(null);
    setNumPages(0);
    setError(null);
    setCurrent(1);
    setQuery("");
    setRotation(0);
  }, [source]);

  // Track the scroll container width for fit-to-width.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setViewportWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rotated = rotation % 180 !== 0;
  const pageAspect = rotated ? 1 / aspect : aspect;
  const baseWidth = 612; // PDF points of a letter page; zoom 1 == 100%
  const pageWidth =
    zoom === "fit"
      ? Math.max(200, Math.min(viewportWidth - 48, 1400))
      : Math.round(baseWidth * zoom);
  const pageHeight = Math.round(pageWidth * pageAspect);
  const effectiveZoom = pageWidth / baseWidth;

  const pages = useVirtualizer({
    count: numPages,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => pageHeight + PAGE_GAP,
    overscan: 2,
  });
  const thumbs = useVirtualizer({
    count: numPages,
    getScrollElement: () => thumbsRef.current,
    estimateSize: () => Math.round(THUMB_WIDTH * pageAspect) + 28,
    overscan: 4,
  });

  React.useEffect(() => {
    pages.measure();
    thumbs.measure();
  }, [pageHeight, pageAspect, pages, thumbs]);

  // Current page = the page occupying the top third of the viewport.
  const onScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el || !numPages) return;
    const probe = el.scrollTop + el.clientHeight / 3;
    const n = Math.min(numPages, Math.max(1, Math.floor(probe / (pageHeight + PAGE_GAP)) + 1));
    setCurrent(n);
  }, [numPages, pageHeight]);

  React.useEffect(() => setPageInput(String(current)), [current]);
  React.useEffect(() => {
    if (showThumbs && numPages) thumbs.scrollToIndex(current - 1, { align: "auto" });
  }, [current, showThumbs, numPages, thumbs]);

  const goTo = React.useCallback(
    (n: number) => {
      const page = Math.min(Math.max(1, n), numPages || 1);
      pages.scrollToIndex(page - 1, { align: "start" });
      setCurrent(page);
    },
    [numPages, pages],
  );

  const stepZoom = React.useCallback(
    (dir: 1 | -1) => {
      setZoom(() => {
        const cur = effectiveZoom;
        const next =
          dir > 0
            ? ZOOM_STEPS.find((s) => s > cur + 0.01)
            : [...ZOOM_STEPS].reverse().find((s) => s < cur - 0.01);
        return next ?? (dir > 0 ? ZOOM_STEPS[ZOOM_STEPS.length - 1]! : ZOOM_STEPS[0]!);
      });
    },
    [effectiveZoom],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => stepZoom(1),
      zoomOut: () => stepZoom(-1),
      reset: () => setZoom("fit"),
      rotate: () => setRotation((r) => (r + 90) % 360),
      focusSearch: () => searchRef.current?.focus(),
    }),
    [stepZoom],
  );

  // ---- search ----
  const search = usePdfSearch(pdf, query);
  const matchCount = search.matches.length;
  React.useEffect(() => setActiveMatch(0), [query]);
  const hitPages = React.useMemo(
    () => new Set(search.matches.map((m) => m.page)),
    [search.matches],
  );
  const active = search.matches[Math.min(activeMatch, matchCount - 1)];
  const jumpToMatch = (i: number) => {
    if (!matchCount) return;
    const idx = (i + matchCount) % matchCount;
    setActiveMatch(idx);
    goTo(search.matches[idx]!.page);
  };
  // Keep the first hit in view as results stream in.
  const firstHitPage = search.matches[0]?.page;
  React.useEffect(() => {
    if (firstHitPage && activeMatch === 0) goTo(firstHitPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstHitPage]);

  const textRenderer = React.useCallback(
    ({ str, itemIndex, pageNumber }: { str: string; itemIndex: number; pageNumber: number }) => {
      const regex = search.regex;
      if (!regex) return escapeHtml(str);
      let k = search.itemOffsets.get(pageNumber)?.[itemIndex] ?? 0;
      let out = "";
      let last = 0;
      for (const m of str.matchAll(regex)) {
        const i = m.index ?? 0;
        const isActive = active && active.page === pageNumber && active.indexOnPage === k;
        out += escapeHtml(str.slice(last, i));
        out += `<mark class="kb-hit${isActive ? " kb-hit-active" : ""}">${escapeHtml(m[0])}</mark>`;
        last = i + m[0].length;
        k++;
      }
      return out + escapeHtml(str.slice(last));
    },
    [search.regex, search.itemOffsets, active],
  );

  if (!source)
    return <ViewerMessage icon={<FileWarning className="h-8 w-8" />} title="No PDF source" />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <style>{TEXT_LAYER_CSS}</style>
      <Toolbar label="PDF controls" className="gap-0.5 overflow-x-auto">
        <ToolButton
          label="Toggle thumbnails (T)"
          active={showThumbs}
          onClick={() => setShowThumbs((s) => !s)}
          className="max-sm:hidden"
        >
          <PanelLeft className="h-4 w-4" />
        </ToolButton>
        <ToolDivider />
        <form
          className="flex items-center gap-1 text-xs text-crm-muted-fg"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(pageInput);
            if (Number.isFinite(n)) goTo(n);
          }}
        >
          <input
            aria-label="Page number"
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
            onBlur={() => setPageInput(String(current))}
            className="h-7 w-10 rounded-crm border border-crm-input bg-crm-bg text-center text-xs tabular-nums text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
          />
          <span className="tabular-nums">/ {numPages || "-"}</span>
        </form>
        <ToolDivider />
        <ToolButton label="Zoom out (-)" onClick={() => stepZoom(-1)}>
          <ZoomOut className="h-4 w-4" />
        </ToolButton>
        <span
          className="w-11 text-center text-xs tabular-nums text-crm-muted-fg"
          aria-live="polite"
        >
          {Math.round(effectiveZoom * 100)}%
        </span>
        <ToolButton label="Zoom in (+)" onClick={() => stepZoom(1)}>
          <ZoomIn className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Fit width (0)" active={zoom === "fit"} onClick={() => setZoom("fit")}>
          <MoveHorizontal className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Rotate (R)" onClick={() => setRotation((r) => (r + 90) % 360)}>
          <RotateCw className="h-4 w-4" />
        </ToolButton>
        <div className="ml-auto flex items-center gap-1 pl-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-crm-muted-fg"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="search"
              role="searchbox"
              aria-label="Search in document"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  jumpToMatch(activeMatch + (e.shiftKey ? -1 : 1));
                } else if (e.key === "Escape" && query) {
                  e.stopPropagation();
                  setQuery("");
                }
              }}
              className="h-7 w-36 rounded-crm border border-crm-input bg-crm-bg pl-7 pr-2 text-xs text-crm-fg placeholder:text-crm-muted-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring sm:w-48"
            />
          </div>
          {query && (
            <>
              <span
                className="min-w-14 text-center text-xs tabular-nums text-crm-muted-fg"
                aria-live="polite"
              >
                {matchCount
                  ? `${Math.min(activeMatch + 1, matchCount)} / ${matchCount}`
                  : search.searching
                    ? "..."
                    : "0 / 0"}
              </span>
              <ToolButton
                label="Previous match (Shift+Enter)"
                disabled={!matchCount}
                onClick={() => jumpToMatch(activeMatch - 1)}
              >
                <ChevronUp className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="Next match (Enter)"
                disabled={!matchCount}
                onClick={() => jumpToMatch(activeMatch + 1)}
              >
                <ChevronDown className="h-4 w-4" />
              </ToolButton>
              <ToolButton label="Clear search" onClick={() => setQuery("")}>
                <X className="h-4 w-4" />
              </ToolButton>
            </>
          )}
        </div>
      </Toolbar>
      {search.searching && query && numPages > 0 && (
        <div
          className="h-0.5 bg-crm-primary transition-[width]"
          style={{ width: `${(search.indexed / numPages) * 100}%` }}
          role="progressbar"
          aria-label="Indexing document text"
          aria-valuemin={0}
          aria-valuemax={numPages}
          aria-valuenow={search.indexed}
        />
      )}
      <Document
        file={source}
        suspense={false}
        className="flex min-h-0 flex-1"
        loading={
          <div className="flex-1">
            <Spinner label="Opening PDF" />
          </div>
        }
        error={
          <div className="flex-1">
            <ViewerMessage
              icon={<FileWarning className="h-8 w-8" />}
              title="This PDF could not be opened"
              detail={error ?? "The file may be damaged, password-protected or blocked."}
            />
          </div>
        }
        onLoadError={(e) => setError(e.message)}
        onLoadSuccess={async (doc) => {
          setPdf(doc);
          setNumPages(doc.numPages);
          try {
            const p1 = await doc.getPage(1);
            const vp = p1.getViewport({ scale: 1 });
            setAspect(vp.height / vp.width);
          } catch {
            /* keep default aspect */
          }
        }}
      >
        {showThumbs && numPages > 0 && (
          <nav
            ref={thumbsRef}
            aria-label="Page thumbnails"
            className="w-36 shrink-0 overflow-y-auto border-r border-crm-border bg-crm-card max-sm:hidden"
          >
            <ol className="relative" style={{ height: thumbs.getTotalSize() }}>
              {thumbs.getVirtualItems().map((v) => {
                const n = v.index + 1;
                const selected = n === current;
                const hits = hitPages.has(n);
                return (
                  <li
                    key={v.key}
                    className="absolute inset-x-0 flex flex-col items-center gap-1 pt-3"
                    style={{ transform: `translateY(${v.start}px)` }}
                  >
                    <button
                      type="button"
                      aria-label={`Page ${n}`}
                      aria-current={selected ? "page" : undefined}
                      onClick={() => goTo(n)}
                      className={cn(
                        "relative overflow-hidden rounded-[3px] bg-white ring-offset-2 ring-offset-crm-card transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
                        selected
                          ? "ring-2 ring-crm-primary"
                          : "ring-1 ring-crm-border hover:ring-crm-ring",
                      )}
                      style={{ width: THUMB_WIDTH, height: Math.round(THUMB_WIDTH * pageAspect) }}
                    >
                      <Thumbnail
                        pageNumber={n}
                        width={THUMB_WIDTH}
                        rotate={rotation}
                        loading={null}
                        suspense={false}
                        onItemClick={() => goTo(n)}
                      />
                      {hits && (
                        <span
                          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-crm-warning"
                          aria-hidden
                        />
                      )}
                    </button>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        selected ? "text-crm-fg" : "text-crm-muted-fg",
                      )}
                    >
                      {n}
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          tabIndex={0}
          aria-label={`${file.name}, page ${current} of ${numPages}`}
          className="kb-pdf relative min-w-0 flex-1 overflow-auto bg-crm-bg focus-visible:outline-none"
        >
          <div
            className="relative mx-auto"
            style={{ height: pages.getTotalSize(), width: pageWidth + 32, minWidth: "100%" }}
          >
            {pages.getVirtualItems().map((v) => (
              <div
                key={v.key}
                className="absolute left-0 flex w-full justify-center"
                style={{ transform: `translateY(${v.start + PAGE_GAP}px)`, height: pageHeight }}
              >
                <div
                  className="relative bg-white shadow-crm-raised"
                  style={{ width: pageWidth, height: pageHeight }}
                  aria-label={`Page ${v.index + 1}`}
                  role="img"
                >
                  <Page
                    pageNumber={v.index + 1}
                    width={pageWidth}
                    rotate={rotation}
                    renderAnnotationLayer={false}
                    renderTextLayer
                    customTextRenderer={textRenderer}
                    loading={null}
                    suspense={false}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Document>
    </div>
  );
});

// Essential subset of pdf.js' text_layer_builder.css (Apache-2.0, Mozilla Foundation), inlined so
// the text layer lines up with the canvas without importing library CSS. See THIRD_PARTY_NOTICES.md.
const TEXT_LAYER_CSS = `
:root{--react-pdf-text-layer:1}
.kb-pdf .react-pdf__Page{position:relative}
.kb-pdf .react-pdf__Page__canvas{display:block}
.kb-pdf .textLayer{position:absolute;text-align:initial;inset:0;overflow:clip;opacity:1;line-height:1;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;z-index:0;--min-font-size:1;--text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size));--min-font-size-inv:calc(1 / var(--min-font-size))}
.kb-pdf .textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;margin:0;transform-origin:0 0}
.kb-pdf .textLayer > :not(.markedContent),.kb-pdf .textLayer .markedContent span:not(.markedContent){z-index:1;--font-height:0;font-size:calc(var(--text-scale-factor) * var(--font-height));--scale-x:1;--rotate:0deg;transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))}
.kb-pdf .textLayer .markedContent{display:contents}
.kb-pdf .textLayer ::selection{background:rgb(65 36 251 / .3)}
.kb-pdf .textLayer br::selection{background:transparent}
.kb-pdf .textLayer .endOfContent{display:block;position:absolute;inset:100% 0 0;z-index:0;cursor:default;user-select:none}
.kb-pdf .textLayer mark.kb-hit{color:transparent;background:rgb(251 191 36 / .45);border-radius:2px;margin:-1px;padding:1px;position:static}
.kb-pdf .textLayer mark.kb-hit-active{background:rgb(249 115 22 / .7);outline:2px solid rgb(249 115 22)}
.react-pdf__Thumbnail__page canvas{display:block}
`;
