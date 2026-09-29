import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, FileQuestion, FolderOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectKind, formatBytes, type PreviewFile } from "@/components/crm/pro-file-preview/types";
import { ToolButton, ViewerMessage } from "@/components/crm/pro-file-preview/toolbar";
import {
  ImageViewer,
  type ImageViewerHandle,
} from "@/components/crm/pro-file-preview/image-viewer";
import { PdfViewer, type PdfViewerHandle } from "@/components/crm/pro-file-preview/pdf-viewer";
import { CodeViewer } from "@/components/crm/pro-file-preview/code-viewer";
import { MediaViewer } from "@/components/crm/pro-file-preview/media-viewer";
import { GalleryStrip, KIND_ICONS } from "@/components/crm/pro-file-preview/gallery-strip";

export type {
  PreviewFile,
  PreviewKind,
  PreviewSource,
} from "@/components/crm/pro-file-preview/types";

export interface ProFilePreviewProps {
  files: PreviewFile[];
  /** Controlled active file index. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number, file: PreviewFile) => void;
  /** "inline" renders in place; "dialog" renders a full-screen modal lightbox. */
  mode?: "inline" | "dialog";
  /** Dialog mode only. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Adds a download button. Return nothing; do the download yourself (URL, signed link...). */
  onDownload?: (file: PreviewFile) => void;
  /** Custom renderer for files no built-in viewer handles. */
  renderUnsupported?: (file: PreviewFile) => React.ReactNode;
  /** pdf.js worker URL (see PdfViewer). */
  pdfWorkerSrc?: string;
  showGallery?: boolean;
  loading?: boolean;
  /** Inline mode height; default 640px. */
  height?: number | string;
  className?: string;
}

function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (v: T) => void) {
  const [inner, setInner] = React.useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = React.useCallback(
    (v: T) => {
      if (!controlled) setInner(v);
      onChange?.(v);
    },
    [controlled, onChange],
  );
  return [current, set] as const;
}

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * Pro file previewer: PDFs (thumbnails, zoom, search), images (zoom/pan/rotate), syntax-highlighted
 * code, video and audio, with a virtualised gallery and keyboard navigation. Inline or as a dialog.
 */
export function ProFilePreview(props: ProFilePreviewProps) {
  const { mode = "inline", open, defaultOpen = false, onOpenChange } = props;
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);

  if (mode === "inline") return <PreviewShell {...props} />;

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card shadow-crm-overlay focus:outline-none sm:inset-6"
          aria-describedby={undefined}
        >
          <PreviewShell {...props} height="100%" onClose={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PreviewShell({
  files,
  index,
  defaultIndex = 0,
  onIndexChange,
  onDownload,
  renderUnsupported,
  pdfWorkerSrc,
  showGallery = true,
  loading,
  height = 640,
  className,
  mode = "inline",
  onClose,
}: ProFilePreviewProps & { onClose?: () => void }) {
  const [active, setActiveRaw] = useControllable(index, defaultIndex);
  const safe = files.length ? Math.min(Math.max(0, active), files.length - 1) : 0;
  const file = files[safe] as PreviewFile | undefined;
  const kind = file ? detectKind(file) : "unknown";

  const setActive = React.useCallback(
    (i: number) => {
      if (!files.length) return;
      const next = Math.max(0, Math.min(files.length - 1, i));
      setActiveRaw(next);
      onIndexChange?.(next, files[next]!);
    },
    [files, setActiveRaw, onIndexChange],
  );

  const imageRef = React.useRef<ImageViewerHandle>(null);
  const pdfRef = React.useRef<PdfViewerHandle>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const handle = kind === "pdf" ? pdfRef.current : kind === "image" ? imageRef.current : null;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && kind === "pdf") {
      e.preventDefault();
      pdfRef.current?.focusSearch();
      return;
    }
    if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        setActive(safe + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        setActive(safe - 1);
        break;
      case "Home":
        if (kind !== "pdf" && kind !== "code") setActive(0);
        break;
      case "End":
        if (kind !== "pdf" && kind !== "code") setActive(files.length - 1);
        break;
      case "+":
      case "=":
        handle?.zoomIn();
        break;
      case "-":
        handle?.zoomOut();
        break;
      case "0":
        handle?.reset();
        break;
      case "r":
      case "R":
        handle?.rotate();
        break;
    }
  };

  const Icon = KIND_ICONS[kind];
  const TitleTag = mode === "dialog" ? Dialog.Title : "h2";

  return (
    <section
      aria-label="File preview"
      aria-roledescription="file previewer"
      onKeyDown={onKeyDown}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-crm-card text-crm-fg",
        mode === "inline" && "rounded-crm border border-crm-border shadow-crm-raised",
        className,
      )}
      style={{ height }}
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-crm-border px-3">
        <Icon className="h-4 w-4 shrink-0 text-crm-icon" aria-hidden />
        <div className="min-w-0 flex-1">
          <TitleTag className="truncate text-sm font-medium text-crm-fg">
            {file?.name ?? "No file selected"}
          </TitleTag>
          {file && (file.meta || file.size !== undefined) && (
            <p className="truncate text-[11px] text-crm-muted-fg">
              {[formatBytes(file.size), file.meta].filter(Boolean).join(" - ")}
            </p>
          )}
        </div>
        {files.length > 1 && (
          <span className="text-xs tabular-nums text-crm-muted-fg" aria-live="polite">
            {safe + 1} of {files.length}
          </span>
        )}
        <ToolButton
          label="Previous file (Left arrow)"
          disabled={safe <= 0}
          onClick={() => setActive(safe - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Next file (Right arrow)"
          disabled={safe >= files.length - 1}
          onClick={() => setActive(safe + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </ToolButton>
        {onDownload && file && (
          <ToolButton label="Download" onClick={() => onDownload(file)}>
            <Download className="h-4 w-4" />
          </ToolButton>
        )}
        {onClose && (
          <ToolButton label="Close (Esc)" onClick={onClose}>
            <X className="h-4 w-4" />
          </ToolButton>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full flex-col gap-3 p-6" role="status" aria-label="Loading files">
            <div className="h-6 w-1/3 animate-pulse rounded-crm bg-crm-muted" />
            <div className="flex-1 animate-pulse rounded-crm bg-crm-muted" />
          </div>
        ) : !file ? (
          <ViewerMessage
            icon={<FolderOpen className="h-8 w-8" />}
            title="No files to preview"
            detail="Attachments added to this record will appear here."
          />
        ) : (
          <div key={file.id} className="h-full">
            {kind === "pdf" && <PdfViewer ref={pdfRef} file={file} workerSrc={pdfWorkerSrc} />}
            {kind === "image" && <ImageViewer ref={imageRef} file={file} />}
            {kind === "code" && <CodeViewer file={file} />}
            {(kind === "video" || kind === "audio") && <MediaViewer file={file} kind={kind} />}
            {kind === "unknown" &&
              (renderUnsupported?.(file) ?? (
                <ViewerMessage
                  icon={<FileQuestion className="h-8 w-8" />}
                  title="No preview available"
                  detail={`${file.name} can't be previewed in the browser.`}
                  action={
                    onDownload && (
                      <button
                        type="button"
                        onClick={() => onDownload(file)}
                        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-crm bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </button>
                    )
                  }
                />
              ))}
          </div>
        )}
      </div>

      {showGallery && files.length > 1 && !loading && (
        <GalleryStrip files={files} index={safe} onSelect={setActive} />
      )}
    </section>
  );
}
