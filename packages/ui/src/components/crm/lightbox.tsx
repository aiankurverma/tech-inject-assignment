import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ImageOff,
  Loader2,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxFile {
  id: string;
  name: string;
  url: string;
  kind: "image" | "pdf" | "other";
  /** Thumbnail for the strip; falls back to `url` for images. */
  thumbUrl?: string;
  /** Bytes, rendered as KB/MB. */
  size?: number;
  uploadedBy?: string;
  uploadedAt?: string | Date;
}

export interface LightboxProps {
  files: LightboxFile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Index to show; controlled together with onIndexChange, else internal. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Loop from last back to first. */
  loop?: boolean;
  /** Hide the download button (e.g. view-only permissions). */
  allowDownload?: boolean;
}

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3, 4];

export function formatBytes(n?: number) {
  if (n === undefined) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const toolBtn =
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-4";

/**
 * Full-screen viewer for record attachments: images (zoom with buttons, +/-/0 keys and
 * ctrl+wheel, drag to pan when zoomed, rotate), PDFs (native embed) and other files
 * (download card). Arrow keys page through files, thumbnails jump, image load errors are
 * handled, and neighbours are preloaded.
 */
export function Lightbox({
  files,
  open,
  onOpenChange,
  index,
  defaultIndex = 0,
  onIndexChange,
  loop = false,
  allowDownload = true,
}: LightboxProps) {
  const [inner, setInner] = React.useState(defaultIndex);
  const i = Math.min(Math.max(0, index ?? inner), Math.max(0, files.length - 1));
  const file = files[i];
  const [zoom, setZoom] = React.useState(1);
  const [rot, setRot] = React.useState(0);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const drag = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const go = React.useCallback(
    (next: number) => {
      const n = files.length;
      if (!n) return;
      const target = loop ? (next + n) % n : Math.min(n - 1, Math.max(0, next));
      if (index === undefined) setInner(target);
      onIndexChange?.(target);
    },
    [files.length, loop, index, onIndexChange],
  );

  React.useEffect(() => {
    setZoom(1);
    setRot(0);
    setPan({ x: 0, y: 0 });
    setStatus(file?.kind === "image" ? "loading" : "ready");
  }, [file?.id, file?.kind]);

  // Preload neighbours so paging feels instant.
  React.useEffect(() => {
    if (!open) return;
    for (const d of [-1, 1]) {
      const f = files[i + d];
      if (f?.kind === "image") new Image().src = f.url;
    }
  }, [open, i, files]);

  const step = (dir: 1 | -1) =>
    setZoom((z) => {
      const idx = ZOOMS.findIndex((v) => v >= z - 0.001);
      const next =
        ZOOMS[
          Math.min(ZOOMS.length - 1, Math.max(0, (idx === -1 ? ZOOMS.length - 1 : idx) + dir))
        ] ?? 1;
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (file?.kind === "image" && (e.key === "+" || e.key === "=")) step(1);
    else if (file?.kind === "image" && e.key === "-") step(-1);
    else if (file?.kind === "image" && e.key === "0") {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else if (file?.kind === "image" && e.key.toLowerCase() === "r") setRot((r) => (r + 90) % 360);
    else return;
    e.preventDefault();
  };

  const canPrev = loop || i > 0;
  const canNext = loop || i < files.length - 1;
  const when = file?.uploadedAt
    ? new Date(file.uploadedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-crm-in" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col font-crm text-crm-fg outline-none"
        >
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-crm-border bg-crm-bg/80 px-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-sm font-medium">
                {file?.name ?? "No files"}
              </DialogPrimitive.Title>
              {file ? (
                <p className="truncate text-xs text-crm-subtle">
                  {[`${i + 1} of ${files.length}`, formatBytes(file.size), file.uploadedBy, when]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            {file?.kind === "image" ? (
              <div className="flex items-center gap-0.5" role="group" aria-label="Image controls">
                <button
                  type="button"
                  className={toolBtn}
                  aria-label="Zoom out"
                  onClick={() => step(-1)}
                  disabled={zoom <= (ZOOMS[0] ?? 0.5)}
                >
                  <ZoomOut />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="hidden h-8 min-w-12 cursor-pointer rounded-full px-2 text-xs text-crm-soft tabular-nums outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 sm:inline"
                  aria-label="Reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  className={toolBtn}
                  aria-label="Zoom in"
                  onClick={() => step(1)}
                  disabled={zoom >= (ZOOMS[ZOOMS.length - 1] ?? 4)}
                >
                  <ZoomIn />
                </button>
                <button
                  type="button"
                  className={toolBtn}
                  aria-label="Rotate"
                  onClick={() => setRot((r) => (r + 90) % 360)}
                >
                  <RotateCw />
                </button>
              </div>
            ) : null}
            {allowDownload && file ? (
              <a
                href={file.url}
                download={file.name}
                className={toolBtn}
                aria-label={`Download ${file.name}`}
              >
                <Download />
              </a>
            ) : null}
            <DialogPrimitive.Close className={toolBtn} aria-label="Close viewer">
              <X />
            </DialogPrimitive.Close>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            onWheel={(e) => {
              if (file?.kind !== "image" || !(e.ctrlKey || e.metaKey)) return;
              step(e.deltaY < 0 ? 1 : -1);
            }}
          >
            {!file ? (
              <p className="text-sm text-crm-subtle">There are no attachments to preview.</p>
            ) : file.kind === "image" ? (
              <>
                {status === "loading" ? (
                  <Loader2
                    className="absolute size-6 animate-spin text-crm-soft"
                    aria-label="Loading image"
                  />
                ) : null}
                {status === "error" ? (
                  <div className="flex flex-col items-center gap-2 text-crm-soft" role="alert">
                    <ImageOff className="size-8" />
                    <p className="text-sm">This image could not be loaded.</p>
                  </div>
                ) : (
                  <img
                    key={file.id}
                    src={file.url}
                    alt={file.name}
                    draggable={false}
                    onLoad={() => setStatus("ready")}
                    onError={() => setStatus("error")}
                    onPointerDown={(e) => {
                      if (zoom <= 1) return;
                      (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
                    }}
                    onPointerMove={(e) => {
                      const d = drag.current;
                      if (d) setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
                    }}
                    onPointerUp={() => (drag.current = null)}
                    onDoubleClick={() =>
                      zoom > 1 ? (setZoom(1), setPan({ x: 0, y: 0 })) : setZoom(2)
                    }
                    className={cn(
                      "max-h-full max-w-full object-contain transition-[transform,opacity] duration-150 ease-crm select-none",
                      status === "loading" && "opacity-0",
                      zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
                    )}
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rot}deg)`,
                    }}
                  />
                )}
              </>
            ) : file.kind === "pdf" ? (
              <iframe title={file.name} src={file.url} className="size-full max-w-5xl bg-white" />
            ) : (
              <div className="flex w-72 flex-col items-center gap-3 rounded-xl border border-crm-border bg-crm-card p-6 text-center shadow-crm-raised">
                <FileText className="size-10 text-crm-soft" />
                <p className="text-sm font-medium break-all">{file.name}</p>
                <p className="text-xs text-crm-subtle">No preview for this file type.</p>
                {allowDownload ? (
                  <a
                    href={file.url}
                    download={file.name}
                    className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg shadow-crm-primary"
                  >
                    <Download className="size-3.5" /> Download {formatBytes(file.size)}
                  </a>
                ) : null}
              </div>
            )}
            {files.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => go(i - 1)}
                  disabled={!canPrev}
                  aria-label="Previous file"
                  className={cn(toolBtn, "absolute left-2 size-10 bg-crm-bg/70 sm:left-4")}
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  onClick={() => go(i + 1)}
                  disabled={!canNext}
                  aria-label="Next file"
                  className={cn(toolBtn, "absolute right-2 size-10 bg-crm-bg/70 sm:right-4")}
                >
                  <ChevronRight />
                </button>
              </>
            ) : null}
          </div>

          {files.length > 1 ? (
            <div
              className="flex shrink-0 justify-center gap-2 overflow-x-auto border-t border-crm-border bg-crm-bg/80 p-2"
              role="tablist"
              aria-label="Attachments"
            >
              {files.map((f, n) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={n === i}
                  aria-label={f.name}
                  onClick={() => go(n)}
                  className={cn(
                    "grid size-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-crm border bg-crm-raised outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                    n === i
                      ? "border-crm-primary"
                      : "border-crm-border opacity-60 hover:opacity-100",
                  )}
                >
                  {f.kind === "image" ? (
                    <img src={f.thumbUrl ?? f.url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-semibold text-crm-soft uppercase">
                      {f.kind === "pdf" ? "PDF" : (f.name.split(".").pop() ?? "file")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
