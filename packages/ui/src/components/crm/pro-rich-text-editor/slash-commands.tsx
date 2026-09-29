import * as React from "react";
import type { Editor, Range } from "@tiptap/react";
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table2,
} from "lucide-react";
import type { SuggestionItem } from "@/components/crm/pro-rich-text-editor/suggestion-menu";

export interface SlashCommand extends SuggestionItem {
  run: (ctx: { editor: Editor; range: Range; requestImage: () => void }) => void;
}

/** Built-in block commands. Extend or replace with the `slashCommands` prop. */
export const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "text",
    label: "Text",
    description: "Plain paragraph",
    group: "Basic blocks",
    icon: <Pilcrow />,
    keywords: ["paragraph", "p"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  ...([1, 2, 3] as const).map<SlashCommand>((level) => ({
    id: `h${level}`,
    label: `Heading ${level}`,
    description: `${"#".repeat(level)} section title`,
    group: "Basic blocks",
    icon: level === 1 ? <Heading1 /> : level === 2 ? <Heading2 /> : <Heading3 />,
    keywords: ["title", "heading", `h${level}`],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level }).run(),
  })),
  {
    id: "bullet",
    label: "Bulleted list",
    description: "- item",
    group: "Lists",
    icon: <List />,
    keywords: ["ul", "unordered"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "numbered",
    label: "Numbered list",
    description: "1. item",
    group: "Lists",
    icon: <ListOrdered />,
    keywords: ["ol", "ordered"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "todo",
    label: "To-do list",
    description: "[ ] task",
    group: "Lists",
    icon: <CheckSquare />,
    keywords: ["task", "checkbox", "check"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: "quote",
    label: "Quote",
    description: "> callout text",
    group: "Blocks",
    icon: <Quote />,
    keywords: ["blockquote"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "code",
    label: "Code block",
    description: "``` monospace",
    group: "Blocks",
    icon: <Code2 />,
    keywords: ["snippet", "pre"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "table",
    label: "Table",
    description: "3 × 3 with header row",
    group: "Blocks",
    icon: <Table2 />,
    keywords: ["grid", "columns"],
    run: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    id: "divider",
    label: "Divider",
    description: "--- horizontal rule",
    group: "Blocks",
    icon: <Minus />,
    keywords: ["hr", "separator", "line"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: "image",
    label: "Image",
    description: "Upload or paste an image",
    group: "Media",
    icon: <ImageIcon />,
    keywords: ["photo", "picture", "upload"],
    run: ({ editor, range, requestImage }) => {
      editor.chain().focus().deleteRange(range).run();
      requestImage();
    },
  },
];

/** Rank commands for a query: label prefix > label contains > keyword match. */
export function filterCommands<T extends SuggestionItem>(
  items: T[],
  query: string,
  limit = 12,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, limit);
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const label = item.label.toLowerCase();
    let score = -1;
    if (label.startsWith(q)) score = 3;
    else if (label.includes(q)) score = 2;
    else if (item.keywords?.some((k) => k.toLowerCase().startsWith(q))) score = 1;
    else if (item.description?.toLowerCase().includes(q)) score = 0;
    if (score >= 0) scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}
