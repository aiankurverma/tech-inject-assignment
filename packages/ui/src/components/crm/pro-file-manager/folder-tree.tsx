import * as React from "react";
import { Tree, type NodeRendererProps } from "react-arborist";
import { ChevronRight, Folder, FolderOpen, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { useElementSize } from "@/hooks/use-file-selection";
import { FILE_DRAG_MIME, type FileNode } from "@/components/crm/pro-file-manager/types";

interface TreeItem {
  id: string;
  name: string;
  children: TreeItem[];
}

export const ROOT_ID = "__root__";

export interface FolderTreeProps {
  folders: FileNode[];
  currentId: string | null;
  rootLabel: string;
  onNavigate: (id: string | null) => void;
  /** Move nodes (from the tree itself, or files dragged from the list) into a folder. */
  onMoveInto: (ids: string[], folderId: string | null) => void;
}

/** Folder-only tree on react-arborist: virtualised, keyboard navigable, drag to re-parent. */
export function FolderTree({
  folders,
  currentId,
  rootLabel,
  onNavigate,
  onMoveInto,
}: FolderTreeProps) {
  const [setEl, size] = useElementSize<HTMLDivElement>();

  const data = React.useMemo<TreeItem[]>(() => {
    const byParent = new Map<string | null, FileNode[]>();
    for (const f of folders) {
      const arr = byParent.get(f.parentId);
      if (arr) arr.push(f);
      else byParent.set(f.parentId, [f]);
    }
    const build = (parent: string | null): TreeItem[] =>
      (byParent.get(parent) ?? [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ id: f.id, name: f.name, children: build(f.id) }));
    return [{ id: ROOT_ID, name: rootLabel, children: build(null) }];
  }, [folders, rootLabel]);

  const onMoveRef = React.useRef(onMoveInto);
  React.useEffect(() => {
    onMoveRef.current = onMoveInto;
  }, [onMoveInto]);

  const Node = React.useCallback(function FolderRow({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<TreeItem>) {
    const [over, setOver] = React.useState(false);
    const isRoot = node.id === ROOT_ID;
    const target = isRoot ? null : node.id;
    return (
      <div
        ref={dragHandle}
        style={style}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(FILE_DRAG_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          const raw = e.dataTransfer.getData(FILE_DRAG_MIME);
          setOver(false);
          if (!raw) return;
          e.preventDefault();
          onMoveRef.current(JSON.parse(raw) as string[], target);
        }}
        className={cn(
          "flex h-full cursor-pointer items-center gap-1.5 rounded-md pr-2 text-sm",
          node.isSelected ? "bg-crm-primary/20 text-crm-fg" : "text-crm-soft hover:bg-crm-muted",
          node.isFocused && "ring-1 ring-crm-primary ring-inset",
          (over || node.willReceiveDrop) && "bg-crm-primary/30 text-crm-fg",
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
          className={cn(
            "grid size-4 place-items-center text-crm-icon",
            node.children?.length ? "" : "invisible",
          )}
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", node.isOpen && "rotate-90")}
          />
        </button>
        {isRoot ? (
          <HardDrive className="size-4 shrink-0 text-crm-icon" aria-hidden />
        ) : node.isOpen ? (
          <FolderOpen className="size-4 shrink-0 text-[#e0b252]" aria-hidden />
        ) : (
          <Folder className="size-4 shrink-0 text-[#e0b252]" aria-hidden />
        )}
        <span className="truncate">{node.data.name}</span>
      </div>
    );
  }, []);

  return (
    <div ref={setEl} className="h-full min-h-0 py-2">
      {size.height > 0 ? (
        <Tree<TreeItem>
          data={data}
          aria-label="Folders"
          width="100%"
          height={size.height}
          rowHeight={30}
          indent={14}
          padding={4}
          initialOpenState={{ [ROOT_ID]: true }}
          selection={currentId ?? ROOT_ID}
          disableMultiSelection
          disableEdit
          disableDrag={(d) => d.id === ROOT_ID}
          disableDrop={({ dragNodes, parentNode }) =>
            dragNodes.some((n) => n.id === parentNode.id || n.isAncestorOf(parentNode))
          }
          onActivate={(n) => onNavigate(n.id === ROOT_ID ? null : n.id)}
          onMove={({ dragIds, parentId }) =>
            onMoveInto(dragIds, !parentId || parentId === ROOT_ID ? null : parentId)
          }
          rowClassName="outline-none px-2"
        >
          {Node}
        </Tree>
      ) : null}
    </div>
  );
}
