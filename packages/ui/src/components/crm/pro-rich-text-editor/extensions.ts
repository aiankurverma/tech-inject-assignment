import {
  Extension,
  Node,
  mergeAttributes,
  type AnyExtension,
  type Editor,
  type Range,
} from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { Mention, type MentionNodeAttrs } from "@tiptap/extension-mention";
import { Suggestion, SuggestionPluginKey, type SuggestionProps } from "@tiptap/suggestion";
import type {
  SuggestionItem,
  SuggestionStore,
} from "@/components/crm/pro-rich-text-editor/suggestion-menu";
import {
  filterCommands,
  type SlashCommand,
} from "@/components/crm/pro-rich-text-editor/slash-commands";

/** A mention trigger: `@` for people, `#` for CRM records, or anything else. */
export interface MentionSource {
  char: string;
  /** Group header shown above results. */
  label?: string;
  search: (query: string) => SuggestionItem[] | Promise<SuggestionItem[]>;
  /** Optional href for rendered HTML output, e.g. (id) => `/deals/${id}`. */
  href?: (id: string) => string;
}

// @tiptap/pm is not an approved import, so derive a PluginKey constructor from an existing key.
const PluginKeyCtor = SuggestionPluginKey.constructor as new (
  name: string,
) => typeof SuggestionPluginKey;

function suggestionRender<I extends SuggestionItem, S>(
  store: SuggestionStore,
  kind: string,
  pick: (props: SuggestionProps<I, S>, item: I) => void,
) {
  return () => {
    const sync = (props: SuggestionProps<I, S>, reset: boolean) =>
      store.set({
        open: true,
        kind,
        query: props.query,
        items: props.items,
        loading: false,
        rect: props.clientRect ?? null,
        select: (item) => pick(props, item as I),
        ...(reset ? { selected: 0 } : {}),
      });
    return {
      onStart: (props: SuggestionProps<I, S>) => sync(props, true),
      onUpdate: (props: SuggestionProps<I, S>) => sync(props, false),
      onKeyDown: ({ event }: { event: KeyboardEvent }) => store.keyDown(event),
      onExit: () => store.close(),
    };
  };
}

interface SlashOptions {
  store: SuggestionStore | null;
  getCommands: () => SlashCommand[];
  requestImage: () => void;
}

/** "/" menu powered by @tiptap/suggestion. */
export const SlashCommandExtension = Extension.create<SlashOptions>({
  name: "slashCommand",
  addOptions() {
    return { store: null, getCommands: () => [], requestImage: () => {} };
  },
  addProseMirrorPlugins() {
    const { store, getCommands, requestImage } = this.options;
    if (!store) return [];
    return [
      Suggestion<SlashCommand, SlashCommand>({
        editor: this.editor,
        char: "/",
        pluginKey: new PluginKeyCtor("slashCommand"),
        allowedPrefixes: null,
        items: ({ query }) => filterCommands(getCommands(), query),
        allow: ({ state }) => !state.selection.$from.parent.type.spec.code,
        command: ({ editor, range, props }) => props.run({ editor, range, requestImage }),
        render: suggestionRender<SlashCommand, SlashCommand>(store, "/", (props, item) =>
          props.command(item),
        ),
      }),
    ];
  },
});

/** Top-level block ids so the yjs binding can diff documents per block. Not rendered to HTML. */
export const BlockId = Extension.create({
  name: "blockId",
  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "blockquote",
          "codeBlock",
          "bulletList",
          "orderedList",
          "taskList",
          "table",
          "horizontalRule",
          "image",
        ],
        attributes: { bid: { default: null, keepOnSplit: false, rendered: false } },
      },
    ];
  },
});

/** Block image node (Tiptap's image extension is not an approved dependency; this is ~20 lines). */
export const ImageBlock = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: null }, title: { default: null } };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(
        { class: "my-3 max-h-[420px] rounded-crm border border-crm-border", loading: "lazy" },
        HTMLAttributes,
      ),
    ];
  },
});

export interface BuildExtensionsOptions {
  store: SuggestionStore;
  placeholder: string;
  getCommands: () => SlashCommand[];
  requestImage: () => void;
  mentionSources: MentionSource[];
  characterLimit?: number;
  collaborative: boolean;
  extra?: AnyExtension[];
}

/** Assemble the editor schema: StarterKit + tables + tasks + mentions + slash menu + image. */
export function buildExtensions(o: BuildExtensionsOptions): AnyExtension[] {
  const sources = new Map(o.mentionSources.map((s) => [s.char, s]));
  return [
    StarterKit.configure({
      // Remote changes are applied with addToHistory=false, so local undo stays local.
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow" },
      },
      codeBlock: { HTMLAttributes: { spellcheck: "false" } },
      // Peers would each append their own trailing paragraph and fight over it.
      ...(o.collaborative ? { trailingNode: false as const } : {}),
    }),
    TableKit.configure({ table: { resizable: false } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === "heading" ? `Heading ${node.attrs.level as number}` : o.placeholder,
    }),
    CharacterCount.configure({ limit: o.characterLimit ?? null }),
    ImageBlock,
    BlockId,
    SlashCommandExtension.configure({
      store: o.store,
      getCommands: o.getCommands,
      requestImage: o.requestImage,
    }),
    ...(o.mentionSources.length
      ? [
          Mention.configure({
            deleteTriggerWithBackspace: true,
            renderText: ({ node }) =>
              `${(node.attrs.mentionSuggestionChar as string) ?? "@"}${node.attrs.label ?? node.attrs.id}`,
            renderHTML: ({ node, options }) => {
              const char = (node.attrs.mentionSuggestionChar as string) ?? "@";
              const src = sources.get(char);
              const id = String(node.attrs.id);
              const attrs = mergeAttributes(options.HTMLAttributes, {
                "data-type": "mention",
                "data-kind": char,
                "data-id": id,
                class:
                  char === "@"
                    ? "rounded bg-crm-primary/20 px-1 text-crm-fg"
                    : "rounded bg-crm-status/15 px-1 text-crm-status",
              });
              const text = `${char}${(node.attrs.label as string) ?? id}`;
              return src?.href
                ? ["a", { ...attrs, href: src.href(id) }, text]
                : ["span", attrs, text];
            },
            suggestions: o.mentionSources.map((s) => ({
              char: s.char,
              allowSpaces: false,
              items: async ({ query }: { query: string }) => {
                o.store.set({ loading: true, query });
                const found = await s.search(query);
                return found.map((f) => ({ ...f, group: f.group ?? s.label }));
              },
              render: suggestionRender<SuggestionItem, MentionNodeAttrs>(
                o.store,
                s.char,
                (props, item) => props.command({ id: item.id, label: item.label }),
              ),
            })),
          }),
        ]
      : []),
    ...(o.extra ?? []),
  ];
}

export type { Editor, Range };
