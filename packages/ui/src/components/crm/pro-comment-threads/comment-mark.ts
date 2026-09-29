import { Mark, mergeAttributes, type Editor } from "@tiptap/react";

/**
 * In-house text-range anchor for comment threads. Tiptap's own comments
 * extension is part of its proprietary Pro offering, so this is a small,
 * dependency-free ProseMirror mark: each commented range carries its thread id,
 * overlapping ranges are allowed (`excludes: ""`), and typing at the edges does
 * not extend the anchor (`inclusive: false`).
 */
declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    commentAnchor: {
      setCommentAnchor: (threadId: string) => ReturnType;
      unsetCommentAnchor: (threadId: string) => ReturnType;
    };
  }
}

export const COMMENT_ATTR = "data-comment-id";

export const CommentAnchor = Mark.create({
  name: "commentAnchor",
  inclusive: false,
  excludes: "",
  spanning: true,

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => el.getAttribute(COMMENT_ATTR),
        renderHTML: (attrs) => (attrs.threadId ? { [COMMENT_ATTR]: attrs.threadId } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[${COMMENT_ATTR}]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "kb-comment-anchor" }), 0];
  },

  addCommands() {
    return {
      setCommentAnchor:
        (threadId) =>
        ({ commands }) =>
          commands.setMark(this.name, { threadId }),
      unsetCommentAnchor:
        (threadId) =>
        ({ tr, state, dispatch }) => {
          const type = state.schema.marks[this.name];
          if (!type) return false;
          let found = false;
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            for (const m of node.marks) {
              if (m.type === type && m.attrs.threadId === threadId) {
                tr.removeMark(pos, pos + node.nodeSize, m);
                found = true;
              }
            }
          });
          if (found && dispatch) dispatch(tr);
          return found;
        },
    };
  },
});

/** Thread ids whose anchor covers the current cursor / selection head. */
export function threadIdsAtSelection(editor: Editor): string[] {
  const { $head } = editor.state.selection;
  const marks = $head.marks().concat($head.nodeAfter?.marks ?? []);
  const ids = new Set<string>();
  for (const m of marks) {
    if (m.type.name === "commentAnchor" && m.attrs.threadId) ids.add(m.attrs.threadId as string);
  }
  return [...ids];
}

/** Collects the first document position of every anchored thread in one O(doc) pass. */
export function collectAnchors(editor: Editor): Map<string, number> {
  const out = new Map<string, number>();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const m of node.marks) {
      const id = m.attrs.threadId as string | undefined;
      if (m.type.name === "commentAnchor" && id && !out.has(id)) out.set(id, pos);
    }
  });
  return out;
}
