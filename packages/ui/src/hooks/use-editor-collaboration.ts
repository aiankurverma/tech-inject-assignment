import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  bindEditorToYDoc,
  cursorFromEditor,
  type BlockCursor,
  type CollaborationConfig,
  type CollabUser,
} from "@/components/crm/pro-rich-text-editor/collab";

export interface RemotePeer {
  clientId: number;
  user: CollabUser;
  cursor: BlockCursor | null;
}

/**
 * Wires a Tiptap editor to a Y.Doc (via the in-house block binding) and publishes this user's
 * presence + cursor through an awareness instance. Returns the other peers in the room.
 */
export function useEditorCollaboration(editor: Editor | null, config?: CollaborationConfig) {
  const [peers, setPeers] = React.useState<RemotePeer[]>([]);
  const doc = config?.doc;
  const awareness = config?.awareness;
  const field = config?.field;
  const userName = config?.user.name;
  const userColor = config?.user.color;

  React.useEffect(() => {
    if (!editor || !doc) return;
    return bindEditorToYDoc(editor, doc, field);
  }, [editor, doc, field]);

  React.useEffect(() => {
    if (!editor || !awareness || !userName) return;
    awareness.setLocalStateField("user", { name: userName, color: userColor });
    let frame = 0;
    const publish = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        awareness.setLocalStateField("cursor", editor.isFocused ? cursorFromEditor(editor) : null),
      );
    };
    const read = () => {
      const next: RemotePeer[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const user = state.user as CollabUser | undefined;
        if (user) next.push({ clientId, user, cursor: (state.cursor as BlockCursor) ?? null });
      });
      setPeers(next);
    };
    editor.on("selectionUpdate", publish);
    editor.on("focus", publish);
    editor.on("blur", publish);
    awareness.on("change", read);
    read();
    return () => {
      cancelAnimationFrame(frame);
      editor.off("selectionUpdate", publish);
      editor.off("focus", publish);
      editor.off("blur", publish);
      awareness.off("change", read);
      awareness.setLocalStateField("cursor", null);
    };
  }, [editor, awareness, userName, userColor]);

  return peers;
}
