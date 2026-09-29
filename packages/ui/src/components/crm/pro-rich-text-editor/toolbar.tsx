import * as React from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Code,
  Code2,
  Columns3,
  Heading2,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] text-crm-muted-fg outline-none transition-colors",
        "hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        "disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5",
        active && "bg-crm-muted text-crm-fg",
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-crm-border" />;

/** Roving-tabindex keyboard navigation for a toolbar (WAI-ARIA toolbar pattern). */
function useRovingToolbar() {
  return React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
    e.preventDefault();
  }, []);
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

/** Fixed toolbar with block, table and history controls. */
export function EditorToolbar({
  editor,
  onRequestImage,
  trailing,
}: {
  editor: Editor;
  onRequestImage: () => void;
  trailing?: React.ReactNode;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      editable: e.isEditable,
      h2: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      inTable: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const onKeyDown = useRovingToolbar();
  const c = () => editor.chain().focus();
  const off = !s.editable;
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className="flex items-center gap-0.5 overflow-x-auto border-b border-crm-border px-2 py-1.5"
    >
      <ToolButton
        label="Undo"
        shortcut={`${mod}+Z`}
        disabled={off || !s.canUndo}
        onClick={() => c().undo().run()}
      >
        <Undo2 />
      </ToolButton>
      <ToolButton
        label="Redo"
        shortcut={`${mod}+Shift+Z`}
        disabled={off || !s.canRedo}
        onClick={() => c().redo().run()}
      >
        <Redo2 />
      </ToolButton>
      <Sep />
      <ToolButton
        label="Heading"
        shortcut="## "
        active={s.h2}
        disabled={off}
        onClick={() => c().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </ToolButton>
      <ToolButton
        label="Bulleted list"
        shortcut="- "
        active={s.bullet}
        disabled={off}
        onClick={() => c().toggleBulletList().run()}
      >
        <List />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        shortcut="1. "
        active={s.ordered}
        disabled={off}
        onClick={() => c().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolButton>
      <ToolButton
        label="To-do list"
        shortcut="[ ] "
        active={s.task}
        disabled={off}
        onClick={() => c().toggleTaskList().run()}
      >
        <CheckSquare />
      </ToolButton>
      <ToolButton
        label="Quote"
        shortcut="> "
        active={s.quote}
        disabled={off}
        onClick={() => c().toggleBlockquote().run()}
      >
        <Quote />
      </ToolButton>
      <ToolButton
        label="Code block"
        shortcut="``` "
        active={s.code}
        disabled={off}
        onClick={() => c().toggleCodeBlock().run()}
      >
        <Code2 />
      </ToolButton>
      <Sep />
      <ToolButton
        label="Insert table"
        disabled={off || s.inTable}
        onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <Table2 />
      </ToolButton>
      <ToolButton label="Insert image" disabled={off} onClick={onRequestImage}>
        <ImageIcon />
      </ToolButton>
      {s.inTable ? (
        <>
          <Sep />
          <ToolButton label="Add row below" disabled={off} onClick={() => c().addRowAfter().run()}>
            <Rows3 />
          </ToolButton>
          <ToolButton
            label="Add column right"
            disabled={off}
            onClick={() => c().addColumnAfter().run()}
          >
            <Columns3 />
          </ToolButton>
          <ToolButton label="Delete row" disabled={off} onClick={() => c().deleteRow().run()}>
            <X />
          </ToolButton>
          <ToolButton label="Delete table" disabled={off} onClick={() => c().deleteTable().run()}>
            <Trash2 />
          </ToolButton>
        </>
      ) : null}
      {trailing ? (
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">{trailing}</div>
      ) : null}
    </div>
  );
}

/** Selection bubble: inline marks and a link editor. Positioned by Tiptap's BubbleMenu (Floating UI). */
export function EditorBubbleToolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
    }),
  });
  const [editingLink, setEditingLink] = React.useState(false);
  const [href, setHref] = React.useState("");
  const onKeyDown = useRovingToolbar();
  const c = () => editor.chain().focus();

  const applyLink = () => {
    const url = href.trim();
    if (!url) c().extendMarkRange("link").unsetLink().run();
    else {
      const safe = /^(https?:|mailto:|\/)/i.test(url) ? url : `https://${url}`;
      c().extendMarkRange("link").setLink({ href: safe }).run();
    }
    setEditingLink(false);
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e, state }) =>
        e.isEditable && !state.selection.empty && !e.isActive("codeBlock") && !e.isActive("image")
      }
      options={{ placement: "top", offset: 8 }}
      className="z-40"
    >
      <div
        role="toolbar"
        aria-label="Text formatting"
        onKeyDown={onKeyDown}
        className="flex items-center gap-0.5 rounded-crm border border-crm-border bg-crm-popover p-1 font-crm shadow-crm-overlay"
      >
        {editingLink ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              applyLink();
            }}
          >
            <input
              autoFocus
              aria-label="Link URL"
              value={href}
              placeholder="https://"
              onChange={(e) => setHref(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditingLink(false);
                  editor.commands.focus();
                }
              }}
              className="h-7 w-56 rounded-[6px] border border-crm-border bg-crm-bg px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            />
            <button
              type="submit"
              className="h-7 rounded-[6px] bg-crm-primary px-2 text-xs text-crm-primary-fg"
            >
              Apply
            </button>
          </form>
        ) : (
          <>
            <ToolButton
              label="Bold"
              shortcut={`${mod}+B`}
              active={s.bold}
              onClick={() => c().toggleBold().run()}
            >
              <Bold />
            </ToolButton>
            <ToolButton
              label="Italic"
              shortcut={`${mod}+I`}
              active={s.italic}
              onClick={() => c().toggleItalic().run()}
            >
              <Italic />
            </ToolButton>
            <ToolButton
              label="Underline"
              shortcut={`${mod}+U`}
              active={s.underline}
              onClick={() => c().toggleUnderline().run()}
            >
              <Underline />
            </ToolButton>
            <ToolButton
              label="Strikethrough"
              shortcut={`${mod}+Shift+S`}
              active={s.strike}
              onClick={() => c().toggleStrike().run()}
            >
              <Strikethrough />
            </ToolButton>
            <ToolButton
              label="Inline code"
              shortcut={`${mod}+E`}
              active={s.code}
              onClick={() => c().toggleCode().run()}
            >
              <Code />
            </ToolButton>
            <ToolButton
              label={s.link ? "Edit link" : "Add link"}
              shortcut={`${mod}+K`}
              active={s.link}
              onClick={() => {
                setHref(s.href);
                setEditingLink(true);
              }}
            >
              <Link2 />
            </ToolButton>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}
