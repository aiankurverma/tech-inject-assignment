import * as React from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import { useDropzone } from "react-dropzone";
import { AlertCircle, ImageUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildExtensions,
  type MentionSource,
} from "@/components/crm/pro-rich-text-editor/extensions";
import {
  DEFAULT_SLASH_COMMANDS,
  type SlashCommand,
} from "@/components/crm/pro-rich-text-editor/slash-commands";
import {
  SuggestionMenu,
  createSuggestionStore,
} from "@/components/crm/pro-rich-text-editor/suggestion-menu";
import { EditorBubbleToolbar, EditorToolbar } from "@/components/crm/pro-rich-text-editor/toolbar";
import { toMarkdown } from "@/components/crm/pro-rich-text-editor/markdown";
import type { CollaborationConfig } from "@/components/crm/pro-rich-text-editor/collab";
import { PresenceAvatars, RemoteCarets } from "@/components/crm/pro-rich-text-editor/presence";
import { useEditorCollaboration } from "@/hooks/use-editor-collaboration";

export { toMarkdown } from "@/components/crm/pro-rich-text-editor/markdown";
export {
  bindEditorToYDoc,
  createLocalCollabRoom,
  type AwarenessLike,
  type CollaborationConfig,
  type CollabUser,
} from "@/components/crm/pro-rich-text-editor/collab";
export {
  DEFAULT_SLASH_COMMANDS,
  type SlashCommand,
} from "@/components/crm/pro-rich-text-editor/slash-commands";
export type { MentionSource } from "@/components/crm/pro-rich-text-editor/extensions";
export type { SuggestionItem } from "@/components/crm/pro-rich-text-editor/suggestion-menu";

/** Lazy serialisers handed to onChange so large documents only pay for the format you read. */
export interface RichTextValue {
  editor: Editor;
  getJSON: () => JSONContent;
  getHTML: () => string;
  getMarkdown: () => string;
  isEmpty: boolean;
}

export interface ProRichTextEditorHandle {
  editor: Editor | null;
  getJSON: () => JSONContent | null;
  getHTML: () => string;
  getMarkdown: () => string;
  setContent: (content: JSONContent | string) => void;
  focus: () => void;
  clear: () => void;
}

export interface ProRichTextEditorProps {
  /** Initial document (Tiptap JSON or HTML). Ignored when joining a non-empty collaboration room. */
  defaultValue?: JSONContent | string;
  onChange?: (value: RichTextValue) => void;
  placeholder?: string;
  /** Read-only mode. */
  disabled?: boolean;
  /** Shows a skeleton while the document loads. */
  loading?: boolean;
  /** External error, e.g. "Failed to save". */
  error?: string;
  /** `@` people, `#` records, or any trigger character. */
  mentionSources?: MentionSource[];
  /** Replace/extend the slash menu. Defaults to DEFAULT_SLASH_COMMANDS. */
  slashCommands?: SlashCommand[];
  /** Upload a pasted/dropped image and resolve to its URL. Defaults to an inline data URL. */
  onUploadImage?: (file: File) => Promise<string>;
  maxImageBytes?: number;
  characterLimit?: number;
  /** Realtime co-editing through a Y.Doc (+ optional awareness for presence). */
  collaboration?: CollaborationConfig;
  showToolbar?: boolean;
  toolbarTrailing?: React.ReactNode;
  minHeight?: number;
  maxHeight?: number;
  autoFocus?: boolean;
  "aria-label"?: string;
  className?: string;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

/**
 * Notion-style editor for CRM notes: slash menu, @mentions / #record links, markdown shortcuts,
 * tables, code blocks, image paste/drop, bubble toolbar, HTML/JSON/Markdown output and optional
 * yjs collaboration with presence. Tiptap (ProseMirror) does the editing; Kitbase adds the rest.
 */
export const ProRichTextEditor = React.forwardRef<ProRichTextEditorHandle, ProRichTextEditorProps>(
  function ProRichTextEditor(
    {
      defaultValue,
      onChange,
      placeholder = "Write, or press '/' for commands…",
      disabled = false,
      loading = false,
      error,
      mentionSources = [],
      slashCommands = DEFAULT_SLASH_COMMANDS,
      onUploadImage,
      maxImageBytes = 5 * 1024 * 1024,
      characterLimit,
      collaboration,
      showToolbar = true,
      toolbarTrailing,
      minHeight = 220,
      maxHeight,
      autoFocus = false,
      "aria-label": ariaLabel = "Rich text editor",
      className,
    },
    ref,
  ) {
    const menuId = `rte-menu-${React.useId().replace(/:/g, "")}`;
    const store = React.useMemo(() => createSuggestionStore(), []);
    const [uploadState, setUploadState] = React.useState<{ busy: number; error?: string }>({
      busy: 0,
    });
    const surfaceRef = React.useRef<HTMLDivElement>(null);

    // Latest-value refs: extensions are created once, callbacks always see fresh props.
    const commandsRef = React.useRef(slashCommands);
    commandsRef.current = slashCommands;
    const uploadRef = React.useRef(onUploadImage);
    uploadRef.current = onUploadImage;
    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;
    const editorRef = React.useRef<Editor | null>(null);
    const openPickerRef = React.useRef<() => void>(() => {});

    const insertImages = React.useCallback(
      async (files: File[], pos?: number) => {
        const editor = editorRef.current;
        if (!editor || !editor.isEditable) return;
        const images = files.filter((f) => f.type.startsWith("image/"));
        const tooBig = images.find((f) => f.size > maxImageBytes);
        if (tooBig) {
          setUploadState((s) => ({
            ...s,
            error: `${tooBig.name} is larger than ${Math.round(maxImageBytes / 1024 / 1024)} MB`,
          }));
          return;
        }
        for (const file of images) {
          setUploadState((s) => ({ busy: s.busy + 1 }));
          try {
            const src = await (uploadRef.current ?? readAsDataUrl)(file);
            const node = { type: "image", attrs: { src, alt: file.name.replace(/\.[^.]+$/, "") } };
            if (pos != null) editor.chain().focus().insertContentAt(pos, node).run();
            else editor.chain().focus().insertContent(node).run();
          } catch (err) {
            setUploadState((s) => ({
              ...s,
              error: (err as Error).message || "Image upload failed",
            }));
          } finally {
            setUploadState((s) => ({ ...s, busy: Math.max(0, s.busy - 1) }));
          }
        }
      },
      [maxImageBytes],
    );

    const extensions = React.useMemo(
      () =>
        buildExtensions({
          store,
          placeholder,
          getCommands: () => commandsRef.current,
          requestImage: () => openPickerRef.current(),
          mentionSources,
          characterLimit,
          collaborative: !!collaboration,
        }),
      // Schema is fixed for the editor's lifetime; remount (key) to change sources.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    const editor = useEditor({
      extensions,
      content: defaultValue ?? "",
      editable: !disabled && !loading,
      autofocus: autoFocus ? "end" : false,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": ariaLabel,
          "aria-autocomplete": "list",
          "aria-haspopup": "listbox",
          class: "kb-rte-content outline-none",
        },
        handlePaste: (_view, event) => {
          const files = [...(event.clipboardData?.files ?? [])].filter((f) =>
            f.type.startsWith("image/"),
          );
          if (!files.length) return false;
          void insertImages(files);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false;
          const files = [...(event.dataTransfer?.files ?? [])].filter((f) =>
            f.type.startsWith("image/"),
          );
          if (!files.length) return false;
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
          void insertImages(files, at?.pos);
          return true;
        },
      },
      onUpdate: ({ editor: e }) => {
        const cb = onChangeRef.current;
        if (!cb) return;
        cb({
          editor: e,
          getJSON: () => e.getJSON(),
          getHTML: () => e.getHTML(),
          getMarkdown: () => toMarkdown(e.getJSON()),
          isEmpty: e.isEmpty,
        });
      },
    });
    editorRef.current = editor;

    React.useEffect(() => {
      if (editor && !editor.isDestroyed) editor.setEditable(!disabled && !loading);
    }, [editor, disabled, loading]);

    // Combobox semantics on the contenteditable while a suggestion list is open.
    React.useEffect(() => {
      if (!editor) return;
      const sync = () => {
        const dom = editor.view.dom;
        const s = store.get();
        dom.setAttribute("aria-expanded", String(s.open));
        if (s.open) {
          dom.setAttribute("aria-controls", menuId);
          if (s.items.length)
            dom.setAttribute("aria-activedescendant", `${menuId}-opt-${s.selected}`);
          else dom.removeAttribute("aria-activedescendant");
        } else {
          dom.removeAttribute("aria-controls");
          dom.removeAttribute("aria-activedescendant");
        }
      };
      sync();
      return store.subscribe(sync) as () => void;
    }, [editor, store, menuId]);

    const peers = useEditorCollaboration(editor, collaboration);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
      accept: { "image/*": [] },
      noClick: true,
      noKeyboard: true,
      // ProseMirror's handleDrop inserts at the drop point; the dropzone only drives the overlay
      // and the file picker, so ignore its onDrop for drops that landed inside the editor.
      onDrop: (accepted, _rejected, event) => {
        const target = (event as Event | undefined)?.target as Node | null;
        if (target && editor?.view.dom.contains(target)) return;
        void insertImages(accepted);
      },
      onDropRejected: (rejections) =>
        setUploadState((s) => ({
          ...s,
          error: rejections[0]?.errors[0]?.message ?? "Only images can be dropped here",
        })),
      disabled: disabled || loading,
    });
    openPickerRef.current = open;

    React.useImperativeHandle(
      ref,
      () => ({
        editor,
        getJSON: () => editor?.getJSON() ?? null,
        getHTML: () => editor?.getHTML() ?? "",
        getMarkdown: () => (editor ? toMarkdown(editor.getJSON()) : ""),
        setContent: (content) => editor?.commands.setContent(content),
        focus: () => editor?.commands.focus(),
        clear: () => editor?.commands.clearContent(true),
      }),
      [editor],
    );

    const counts = useEditorState({
      editor,
      selector: ({ editor: e }) => {
        const cc = (
          e?.storage as
            { characterCount?: { characters: () => number; words: () => number } } | undefined
        )?.characterCount;
        return { chars: cc?.characters() ?? 0, words: cc?.words() ?? 0 };
      },
    });

    const shownError = error ?? uploadState.error;

    return (
      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-crm border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
          shownError ? "border-crm-danger/60" : "border-crm-border",
          disabled && "opacity-80",
          className,
        )}
        aria-busy={loading || uploadState.busy > 0 || undefined}
      >
        {showToolbar && editor && !loading ? (
          <EditorToolbar
            editor={editor}
            onRequestImage={open}
            trailing={
              <>
                {collaboration ? <PresenceAvatars peers={peers} self={collaboration.user} /> : null}
                {toolbarTrailing}
              </>
            }
          />
        ) : null}

        <div {...getRootProps({ className: "relative flex-1" })}>
          <input {...getInputProps({ "aria-label": "Upload image" })} />
          {loading ? (
            <div className="grid gap-3 p-5" style={{ minHeight }} aria-label="Loading document">
              {[72, 94, 60, 88, 40].map((w, i) => (
                <div
                  key={i}
                  className="h-3.5 animate-pulse rounded bg-crm-muted"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          ) : (
            <div
              ref={surfaceRef}
              className="relative overflow-y-auto px-5 py-4"
              style={{ minHeight, maxHeight }}
              onClick={(e) => {
                if (e.target === e.currentTarget) editor?.commands.focus("end");
              }}
            >
              <EditorContent editor={editor} className="kb-rte" />
              {editor ? <EditorBubbleToolbar editor={editor} /> : null}
              {editor && collaboration ? (
                <RemoteCarets editor={editor} peers={peers} container={surfaceRef} />
              ) : null}
            </div>
          )}
          {isDragActive ? (
            <div className="pointer-events-none absolute inset-2 flex items-center justify-center gap-2 rounded-crm border-2 border-dashed border-crm-primary bg-crm-bg/80 text-sm text-crm-fg">
              <ImageUp className="size-4" aria-hidden /> Drop images to insert
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-crm-border px-3 py-1.5 text-[11px] text-crm-muted-fg">
          <span
            role={shownError ? "alert" : "status"}
            className={cn("flex min-w-0 items-center gap-1", shownError && "text-crm-danger")}
          >
            {shownError ? (
              <>
                <AlertCircle className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{shownError}</span>
                {uploadState.error && !error ? (
                  <button
                    type="button"
                    className="ml-1 underline"
                    onClick={() => setUploadState((s) => ({ busy: s.busy }))}
                  >
                    Dismiss
                  </button>
                ) : null}
              </>
            ) : uploadState.busy ? (
              `Uploading ${uploadState.busy} image${uploadState.busy > 1 ? "s" : ""}…`
            ) : disabled ? (
              "Read only"
            ) : (
              <span>
                Type <kbd className="rounded bg-crm-muted px-1 text-crm-fg">/</kbd> for blocks,{" "}
                <kbd className="rounded bg-crm-muted px-1 text-crm-fg">@</kbd> to mention
              </span>
            )}
          </span>
          <span className="shrink-0 tabular-nums">
            {counts?.words ?? 0} words · {counts?.chars ?? 0}
            {characterLimit ? `/${characterLimit}` : ""} chars
          </span>
        </div>

        <SuggestionMenu store={store} id={menuId} />
        <style>{EDITOR_CSS}</style>
      </div>
    );
  },
);

/* Content typography. Scoped to .kb-rte so it never leaks into the host app. */
const EDITOR_CSS = `
.kb-rte .kb-rte-content{font-size:14px;line-height:1.65;color:var(--color-crm-fg);word-wrap:break-word;white-space:pre-wrap;}
.kb-rte .kb-rte-content>*+*{margin-top:.6em}
.kb-rte h1{font-size:1.6em;font-weight:650;line-height:1.25;margin-top:1em}
.kb-rte h2{font-size:1.3em;font-weight:620;line-height:1.3;margin-top:.9em}
.kb-rte h3{font-size:1.1em;font-weight:600;margin-top:.8em}
.kb-rte ul{list-style:disc;padding-left:1.4em}.kb-rte ol{list-style:decimal;padding-left:1.5em}
.kb-rte li>p{margin:0}
.kb-rte ul[data-type=taskList]{list-style:none;padding-left:.2em}
.kb-rte ul[data-type=taskList] li{display:flex;gap:.5em;align-items:flex-start}
.kb-rte ul[data-type=taskList] li>label{margin-top:.25em;user-select:none}
.kb-rte ul[data-type=taskList] li>div{flex:1}
.kb-rte ul[data-type=taskList] li[data-checked=true]>div{color:var(--color-crm-muted-fg);text-decoration:line-through}
.kb-rte input[type=checkbox]{accent-color:var(--color-crm-primary)}
.kb-rte blockquote{border-left:3px solid var(--color-crm-primary);padding-left:.9em;color:var(--color-crm-soft)}
.kb-rte code{background:var(--color-crm-muted);border-radius:4px;padding:.1em .35em;font-size:.88em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.kb-rte pre{background:var(--color-crm-bg);border:1px solid var(--color-crm-border);border-radius:8px;padding:.8em 1em;overflow-x:auto}
.kb-rte pre code{background:none;padding:0;font-size:12.5px}
.kb-rte a{color:var(--color-crm-primary);text-decoration:underline;text-underline-offset:2px}
.kb-rte hr{border:0;border-top:1px solid var(--color-crm-border);margin:1.2em 0}
.kb-rte img.ProseMirror-selectednode{outline:2px solid var(--color-crm-primary)}
.kb-rte table{border-collapse:collapse;width:100%;table-layout:fixed;margin:.8em 0;overflow:hidden}
.kb-rte td,.kb-rte th{border:1px solid var(--color-crm-border);padding:.35em .6em;vertical-align:top;position:relative;min-width:60px}
.kb-rte th{background:var(--color-crm-raised);font-weight:600;text-align:left}
.kb-rte .selectedCell:after{content:"";position:absolute;inset:0;background:color-mix(in srgb,var(--color-crm-primary) 18%,transparent);pointer-events:none}
.kb-rte .tableWrapper{overflow-x:auto}
.kb-rte p.is-editor-empty:first-child::before,.kb-rte .is-empty::before{content:attr(data-placeholder);color:var(--color-crm-faint);float:left;height:0;pointer-events:none}
.kb-rte [data-type=mention]{white-space:nowrap}
.kb-rte .suggestion{background:var(--color-crm-muted);border-radius:4px}
`;
