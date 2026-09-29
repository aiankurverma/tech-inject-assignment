import * as React from "react";
import { EditorContent, Extension, useEditor, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Mention } from "@tiptap/extension-mention";
import { useDropzone } from "react-dropzone";
import {
  Bold,
  Code,
  Italic,
  List,
  Paperclip,
  SendHorizontal,
  Smile,
  Strikethrough,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/crm/pro-chat-workspace/emoji-picker";
import {
  MentionMenu,
  type MentionMenuHandle,
  type MentionState,
} from "@/components/crm/pro-chat-workspace/mention-menu";
import { CHAT_PROSE, formatBytes } from "@/components/crm/pro-chat-workspace/message-item";
import type { ChatSendPayload, ChatUser } from "@/components/crm/pro-chat-workspace/types";
import type { ChatDraft } from "@/hooks/use-chat-drafts";

export interface ComposerProps {
  /** Draft slot, e.g. channel id or `thread:<id>`. Switching keys swaps drafts. */
  draftKey: string;
  getDraft: (key: string) => ChatDraft | undefined;
  setDraft: (key: string, draft: ChatDraft | null) => void;
  users: ChatUser[];
  currentUserId: string;
  placeholder?: string;
  disabled?: boolean;
  maxFileSize?: number;
  maxFiles?: number;
  recentEmoji: string[];
  onEmojiUsed?: (emoji: string) => void;
  onSend: (payload: Omit<ChatSendPayload, "channelId" | "threadId">) => void;
  compact?: boolean;
}

interface PendingFile {
  id: string;
  file: File;
}

function collectMentions(editor: Editor) {
  const ids = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === "mention" && node.attrs.id) ids.add(String(node.attrs.id));
  });
  return [...ids];
}

/**
 * Rich composer on Tiptap: bold/italic/strike/code/lists, @mentions with a keyboard-driven
 * floating menu, emoji insert, drag/paste/click attachments (react-dropzone) shown as chips,
 * per-conversation drafts, Enter to send and Shift+Enter for a new line.
 */
export function Composer({
  draftKey,
  getDraft,
  setDraft,
  users,
  currentUserId,
  placeholder = "Write a message",
  disabled,
  maxFileSize = 25 * 1024 * 1024,
  maxFiles = 10,
  recentEmoji,
  onEmojiUsed,
  onSend,
  compact,
}: ComposerProps) {
  const [files, setFiles] = React.useState<PendingFile[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [mention, setMention] = React.useState<MentionState | null>(null);
  const menuRef = React.useRef<MentionMenuHandle>(null);
  const mentionOpen = React.useRef(false);
  const keyRef = React.useRef(draftKey);
  const sendRef = React.useRef<() => void>(() => {});
  const usersRef = React.useRef(users);
  React.useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const extensions = React.useMemo(
    () => [
      StarterKit.configure({ heading: false, horizontalRule: false, link: { openOnClick: false } }),
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: {
          char: "@",
          items: ({ query }: { query: string }) => {
            const q = query.toLowerCase();
            return usersRef.current
              .filter((u) => u.id !== currentUserId && u.name.toLowerCase().includes(q))
              .slice(0, 8);
          },
          render: () => ({
            onStart: (p) => {
              mentionOpen.current = true;
              setMention({
                items: p.items as ChatUser[],
                rect: p.clientRect ?? null,
                command: p.command,
              });
            },
            onUpdate: (p) =>
              setMention({
                items: p.items as ChatUser[],
                rect: p.clientRect ?? null,
                command: p.command,
              }),
            onKeyDown: ({ event }) => menuRef.current?.onKeyDown(event) ?? false,
            onExit: () => {
              mentionOpen.current = false;
              setMention(null);
            },
          }),
        },
      }),
      Extension.create({
        name: "sendOnEnter",
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              if (mentionOpen.current) return false;
              sendRef.current();
              return true;
            },
          };
        },
      }),
    ],
    [currentUserId],
  );

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editable: !disabled,
    content: (getDraft(draftKey)?.doc as object | undefined) ?? "",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": placeholder,
        class: cn(
          CHAT_PROSE,
          "max-h-48 overflow-y-auto px-3 py-2 text-sm text-crm-fg outline-none",
          compact ? "min-h-9" : "min-h-11",
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      setDraft(keyRef.current, { doc: ed.getJSON(), text: ed.getText() });
    },
  });

  // Swap drafts when the conversation changes.
  React.useEffect(() => {
    if (!editor || keyRef.current === draftKey) return;
    keyRef.current = draftKey;
    editor.commands.setContent((getDraft(draftKey)?.doc as object | undefined) ?? "", {
      emitUpdate: false,
    });
    setFiles([]);
    setFileError(null);
    editor.commands.focus("end");
  }, [draftKey, editor, getDraft]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const send = React.useCallback(() => {
    if (!editor || disabled) return;
    const text = editor.getText().trim();
    if (!text && files.length === 0) return;
    onSend({
      text,
      html: editor.getHTML(),
      mentions: collectMentions(editor),
      files: files.map((f) => f.file),
    });
    editor.commands.clearContent(true);
    setDraft(keyRef.current, null);
    setFiles([]);
  }, [editor, disabled, files, onSend, setDraft]);
  React.useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    noClick: true,
    noKeyboard: true,
    disabled,
    maxSize: maxFileSize,
    onDrop: (accepted, rejected) => {
      setFileError(
        rejected.length
          ? `${rejected[0]!.file.name}: ${rejected[0]!.errors[0]?.message ?? "rejected"}`
          : null,
      );
      setFiles((prev) =>
        [
          ...prev,
          ...accepted.map((file) => ({
            id: `${file.name}-${file.size}-${file.lastModified}`,
            file,
          })),
        ].slice(0, maxFiles),
      );
    },
  });

  const onPaste = (e: React.ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files);
    if (!pasted.length) return;
    e.preventDefault();
    setFiles((prev) =>
      [...prev, ...pasted.map((file) => ({ id: `${file.name}-${Date.now()}`, file }))].slice(
        0,
        maxFiles,
      ),
    );
  };

  const tool = (label: string, Icon: typeof Bold, run: () => void, active?: boolean) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={cn(
        "grid size-7 place-items-center rounded-md text-crm-icon hover:bg-crm-muted hover:text-crm-fg disabled:opacity-40",
        active && "bg-crm-muted text-crm-fg",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );

  const canSend = !disabled && (files.length > 0 || !!editor?.getText().trim());

  return (
    <div className="px-4 pb-4">
      <div
        {...getRootProps({ onPaste })}
        className={cn(
          "relative rounded-crm border bg-crm-card transition-colors focus-within:border-crm-primary",
          isDragActive ? "border-crm-primary bg-crm-primary/10" : "border-crm-input",
          disabled && "opacity-60",
        )}
      >
        <input {...getInputProps()} aria-label="Attach files" />
        {isDragActive ? (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-crm text-sm font-medium text-crm-fg">
            Drop files to attach
          </div>
        ) : null}
        <div className="relative">
          <EditorContent editor={editor} />
          {editor && editor.isEmpty ? (
            <span className="pointer-events-none absolute top-2 left-3 text-sm text-crm-muted-fg">
              {placeholder}
            </span>
          ) : null}
        </div>
        {files.length ? (
          <ul className="flex flex-wrap gap-1.5 px-3 pb-2" aria-label="Attachments">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-1.5 rounded-full border border-crm-border bg-crm-raised py-0.5 pr-1 pl-2.5 text-xs"
              >
                <span className="max-w-40 truncate text-crm-fg">{f.file.name}</span>
                <span className="text-crm-muted-fg">{formatBytes(f.file.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${f.file.name}`}
                  onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                  className="grid size-4 place-items-center rounded-full text-crm-icon hover:bg-crm-muted"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {fileError ? (
          <p role="alert" className="px-3 pb-2 text-xs text-crm-danger">
            {fileError}
          </p>
        ) : null}
        <div className="flex items-center gap-0.5 border-t border-crm-border px-1.5 py-1">
          {tool(
            "Bold",
            Bold,
            () => editor?.chain().focus().toggleBold().run(),
            editor?.isActive("bold"),
          )}
          {tool(
            "Italic",
            Italic,
            () => editor?.chain().focus().toggleItalic().run(),
            editor?.isActive("italic"),
          )}
          {tool(
            "Strikethrough",
            Strikethrough,
            () => editor?.chain().focus().toggleStrike().run(),
            editor?.isActive("strike"),
          )}
          {tool(
            "Inline code",
            Code,
            () => editor?.chain().focus().toggleCode().run(),
            editor?.isActive("code"),
          )}
          {tool(
            "Bulleted list",
            List,
            () => editor?.chain().focus().toggleBulletList().run(),
            editor?.isActive("bulletList"),
          )}
          <span className="mx-1 h-4 w-px bg-crm-border" />
          {tool("Attach files", Paperclip, open)}
          <EmojiPicker
            recent={recentEmoji}
            onPick={(e) => {
              editor?.chain().focus().insertContent(e).run();
              onEmojiUsed?.(e);
            }}
          >
            {(props) => (
              <button
                {...props}
                type="button"
                aria-label="Insert emoji"
                disabled={disabled}
                className="grid size-7 place-items-center rounded-md text-crm-icon hover:bg-crm-muted hover:text-crm-fg"
              >
                <Smile className="size-3.5" />
              </button>
            )}
          </EmojiPicker>
          <span className="ml-auto hidden pr-2 text-[11px] text-crm-muted-fg sm:inline">
            Enter to send, Shift+Enter for new line
          </span>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label="Send message"
            className="grid size-7 place-items-center rounded-md bg-crm-primary text-white disabled:bg-crm-muted disabled:text-crm-muted-fg"
          >
            <SendHorizontal className="size-3.5" />
          </button>
        </div>
      </div>
      <MentionMenu ref={menuRef} state={mention} />
    </div>
  );
}
