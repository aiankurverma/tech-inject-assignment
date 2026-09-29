import * as React from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Braces,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Slash,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Action {
  id: string;
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  run: (e: Editor) => void;
  active?: (e: Editor) => boolean;
  can?: (e: Editor) => boolean;
}

const ACTIONS: (Action | "sep")[] = [
  {
    id: "bold",
    label: "Bold",
    shortcut: "Ctrl+B",
    icon: Bold,
    run: (e) => e.chain().focus().toggleBold().run(),
    active: (e) => e.isActive("bold"),
  },
  {
    id: "italic",
    label: "Italic",
    shortcut: "Ctrl+I",
    icon: Italic,
    run: (e) => e.chain().focus().toggleItalic().run(),
    active: (e) => e.isActive("italic"),
  },
  {
    id: "underline",
    label: "Underline",
    shortcut: "Ctrl+U",
    icon: Underline,
    run: (e) => e.chain().focus().toggleUnderline().run(),
    active: (e) => e.isActive("underline"),
  },
  {
    id: "strike",
    label: "Strikethrough",
    icon: Strikethrough,
    run: (e) => e.chain().focus().toggleStrike().run(),
    active: (e) => e.isActive("strike"),
  },
  "sep",
  {
    id: "bullet",
    label: "Bulleted list",
    icon: List,
    run: (e) => e.chain().focus().toggleBulletList().run(),
    active: (e) => e.isActive("bulletList"),
  },
  {
    id: "ordered",
    label: "Numbered list",
    icon: ListOrdered,
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    active: (e) => e.isActive("orderedList"),
  },
  {
    id: "quote",
    label: "Quote",
    icon: Quote,
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    active: (e) => e.isActive("blockquote"),
  },
  "sep",
  {
    id: "merge",
    label: "Insert merge field",
    shortcut: "{{",
    icon: Braces,
    run: (e) => e.chain().focus().insertContent(" {{").run(),
  },
  {
    id: "snippet",
    label: "Insert snippet",
    shortcut: "/",
    icon: Slash,
    run: (e) => e.chain().focus().insertContent(" /").run(),
  },
  "sep",
  {
    id: "undo",
    label: "Undo",
    shortcut: "Ctrl+Z",
    icon: Undo2,
    run: (e) => e.chain().focus().undo().run(),
    can: (e) => e.can().undo(),
  },
  {
    id: "redo",
    label: "Redo",
    shortcut: "Ctrl+Shift+Z",
    icon: Redo2,
    run: (e) => e.chain().focus().redo().run(),
    can: (e) => e.can().redo(),
  },
];

const BUTTONS = ACTIONS.filter((a): a is Action => a !== "sep");

/** Formatting toolbar with a roving tabindex (one tab stop, arrow keys move between tools). */
export function ComposerToolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      Object.fromEntries(
        BUTTONS.map((a) => [a.id, { on: a.active?.(e) ?? false, can: a.can?.(e) ?? true }]),
      ) as Record<string, { on: boolean; can: boolean }>,
  });
  const [focus, setFocus] = React.useState(0);
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const move = (to: number) => {
    const n = BUTTONS.length;
    const i = (to + n) % n;
    setFocus(i);
    refs.current[i]?.focus();
  };

  let index = -1;
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-disabled={disabled || undefined}
      className="flex flex-wrap items-center gap-0.5 border-b border-crm-border px-2 py-1.5"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") move(focus + 1);
        else if (e.key === "ArrowLeft") move(focus - 1);
        else if (e.key === "Home") move(0);
        else if (e.key === "End") move(BUTTONS.length - 1);
        else return;
        e.preventDefault();
      }}
    >
      {ACTIONS.map((a, i) => {
        if (a === "sep")
          return <span key={`s${i}`} aria-hidden className="mx-1 h-4 w-px bg-crm-border" />;
        index += 1;
        const my = index;
        const s = state[a.id] ?? { on: false, can: true };
        const Icon = a.icon;
        return (
          <button
            key={a.id}
            ref={(el) => {
              refs.current[my] = el;
            }}
            type="button"
            tabIndex={my === focus ? 0 : -1}
            onFocus={() => setFocus(my)}
            onClick={() => a.run(editor)}
            disabled={disabled || !s.can}
            aria-pressed={a.active ? s.on : undefined}
            aria-label={a.label}
            title={a.shortcut ? `${a.label} (${a.shortcut})` : a.label}
            className={cn(
              "grid size-7 place-items-center rounded-[6px] text-crm-muted-fg transition-colors hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
              s.on && "bg-crm-muted text-crm-fg",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
