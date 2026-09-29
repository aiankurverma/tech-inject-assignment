import * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useDropzone } from "react-dropzone";
import {
  ChevronRight,
  FolderPlus,
  LayoutGrid,
  List,
  Loader2,
  PanelRight,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FolderTree } from "@/components/crm/pro-file-manager/folder-tree";
import { GridView, ListView } from "@/components/crm/pro-file-manager/file-views";
import { useFileTable } from "@/components/crm/pro-file-manager/file-table";
import { PreviewPane } from "@/components/crm/pro-file-manager/preview-pane";
import {
  FILE_DRAG_MIME,
  type FileKindFilter,
  type FileNode,
  type FileSort,
  type FileSortKey,
} from "@/components/crm/pro-file-manager/types";
import { useElementSize, useFileSelection } from "@/hooks/use-file-selection";

export type { FileNode, FileSort, FileKindFilter } from "@/components/crm/pro-file-manager/types";

export interface ProFileManagerProps {
  /** Controlled flat node list (folders + files linked by parentId). */
  nodes?: FileNode[];
  defaultNodes?: FileNode[];
  onNodesChange?: (nodes: FileNode[]) => void;
  /** Controlled current folder (null = root). */
  folderId?: string | null;
  defaultFolderId?: string | null;
  onFolderChange?: (id: string | null) => void;
  defaultView?: "list" | "grid";
  defaultSort?: FileSort;
  rootLabel?: string;
  loading?: boolean;
  error?: string | null;
  readOnly?: boolean;
  /** Called for files on double-click / Enter / Open. Folders navigate. */
  onOpenFile?: (node: FileNode) => void;
  onMove?: (ids: string[], folderId: string | null) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (ids: string[]) => void;
  onCreateFolder?: (parentId: string | null, name: string) => void;
  /** Upload hook. Without it, dropped files are added locally as nodes. */
  onUpload?: (files: File[], folderId: string | null) => void;
  renderPreview?: (node: FileNode) => React.ReactNode;
  className?: string;
}

function useControllable<T>(value: T | undefined, initial: T, onChange?: (v: T) => void) {
  const [inner, setInner] = React.useState(initial);
  const current = value !== undefined ? value : inner;
  const ref = React.useRef(current);
  React.useEffect(() => {
    ref.current = current;
  }, [current]);
  const set = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(ref.current) : next;
      ref.current = v;
      setInner(v);
      onChange?.(v);
    },
    [onChange],
  );
  return [current, set] as const;
}

const FILTERS: { id: FileKindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "folders", label: "Folders" },
  { id: "documents", label: "Docs" },
  { id: "spreadsheets", label: "Sheets" },
  { id: "images", label: "Images" },
  { id: "other", label: "Other" },
];

let seq = 0;

/**
 * Drive-style file manager for record attachments: resizable folder tree / content / preview
 * panes, virtualised list and grid views over 10k+ items, Explorer-style multi-select, drag to
 * move into folders (tree, tiles, breadcrumbs), inline rename, sort, search, type filters and
 * drag-and-drop upload.
 */
export function ProFileManager({
  nodes: nodesProp,
  defaultNodes = [],
  onNodesChange,
  folderId: folderProp,
  defaultFolderId = null,
  onFolderChange,
  defaultView = "list",
  defaultSort = { key: "name", desc: false },
  rootLabel = "All files",
  loading,
  error,
  readOnly,
  onOpenFile,
  onMove,
  onRename,
  onDelete,
  onCreateFolder,
  onUpload,
  renderPreview,
  className,
}: ProFileManagerProps) {
  const [nodes, setNodes] = useControllable(nodesProp, defaultNodes, onNodesChange);
  const [folder, setFolder] = useControllable<string | null>(
    folderProp,
    defaultFolderId,
    onFolderChange,
  );
  const [view, setView] = React.useState(defaultView);
  const [sort, setSort] = React.useState(defaultSort);
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<FileKindFilter>("all");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameError, setRenameError] = React.useState<string | null>(null);
  const [showPreview, setShowPreview] = React.useState(true);
  const [scrollTo, setScrollTo] = React.useState<number | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const [setContentEl, contentSize] = useElementSize<HTMLDivElement>();

  const index = React.useMemo(() => {
    const byId = new Map<string, FileNode>();
    const children = new Map<string | null, FileNode[]>();
    const folders: FileNode[] = [];
    for (const n of nodes) {
      byId.set(n.id, n);
      const arr = children.get(n.parentId);
      if (arr) arr.push(n);
      else children.set(n.parentId, [n]);
      if (n.kind === "folder") folders.push(n);
    }
    return { byId, children, folders };
  }, [nodes]);

  const pathTo = React.useCallback(
    (id: string | null) => {
      const out: FileNode[] = [];
      let cur = id ? index.byId.get(id) : undefined;
      while (cur) {
        out.unshift(cur);
        cur = cur.parentId ? index.byId.get(cur.parentId) : undefined;
      }
      return out;
    },
    [index],
  );
  const crumbs = React.useMemo(() => pathTo(folder), [pathTo, folder]);

  // Searching looks through the whole drive; otherwise show the current folder.
  const scope = React.useMemo(
    () => (query.trim() ? nodes : (index.children.get(folder) ?? [])),
    [query, nodes, index, folder],
  );
  const { rows } = useFileTable(scope, sort, query.trim(), kind);
  const order = React.useMemo(() => rows.map((r) => r.id), [rows]);
  const sel = useFileSelection(order);
  const selectedNodes = React.useMemo(
    () => [...sel.selected].map((id) => index.byId.get(id)).filter((n): n is FileNode => !!n),
    [sel.selected, index],
  );

  const navigate = React.useCallback(
    (id: string | null) => {
      setFolder(id);
      setQuery("");
      setRenamingId(null);
      sel.clear();
    },
    [setFolder, sel],
  );

  const open = React.useCallback(
    (n: FileNode) => {
      if (n.kind === "folder") navigate(n.id);
      else onOpenFile?.(n);
    },
    [navigate, onOpenFile],
  );

  const moveInto = React.useCallback(
    (ids: string[], target: string | null) => {
      if (readOnly) return;
      // Never move a folder into itself or its own descendant.
      const blocked = new Set<string>();
      for (const id of ids) {
        let cur: string | null = target;
        while (cur) {
          if (cur === id) blocked.add(id);
          cur = index.byId.get(cur)?.parentId ?? null;
        }
      }
      const ok = ids.filter((id) => !blocked.has(id) && index.byId.get(id)?.parentId !== target);
      if (!ok.length) return;
      const set = new Set(ok);
      setNodes((prev) => prev.map((n) => (set.has(n.id) ? { ...n, parentId: target } : n)));
      onMove?.(ok, target);
      const dest = target ? index.byId.get(target)?.name : rootLabel;
      setAnnounce(`Moved ${ok.length} item${ok.length > 1 ? "s" : ""} to ${dest}`);
    },
    [readOnly, index, setNodes, onMove, rootLabel],
  );

  const commitRename = React.useCallback(
    (id: string, name: string | null) => {
      setRenamingId(null);
      setRenameError(null);
      const node = index.byId.get(id);
      const next = name?.trim();
      if (!node || !next || next === node.name) return;
      if (/[\\/]/.test(next)) {
        setRenameError("Names cannot contain / or \\");
        return;
      }
      const clash = (index.children.get(node.parentId) ?? []).some(
        (s) => s.id !== id && s.name.toLowerCase() === next.toLowerCase(),
      );
      if (clash) {
        setRenameError(`"${next}" already exists in this folder`);
        return;
      }
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, name: next, modifiedAt: Date.now() } : n)),
      );
      onRename?.(id, next);
    },
    [index, setNodes, onRename],
  );

  const remove = React.useCallback(() => {
    if (readOnly || !sel.selected.size) return;
    const doomed = new Set(sel.selected);
    // Include descendants of removed folders.
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nodes)
        if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
          doomed.add(n.id);
          grew = true;
        }
    }
    setNodes((prev) => prev.filter((n) => !doomed.has(n.id)));
    onDelete?.([...sel.selected]);
    setAnnounce(`Deleted ${sel.selected.size} item${sel.selected.size > 1 ? "s" : ""}`);
    sel.clear();
  }, [readOnly, sel, nodes, setNodes, onDelete]);

  const createFolder = React.useCallback(() => {
    if (readOnly) return;
    const siblings = new Set((index.children.get(folder) ?? []).map((n) => n.name));
    let name = "New folder";
    for (let i = 2; siblings.has(name); i++) name = `New folder (${i})`;
    const node: FileNode = {
      id: `new-${Date.now()}-${++seq}`,
      name,
      parentId: folder,
      kind: "folder",
      modifiedAt: Date.now(),
    };
    setNodes((prev) => [...prev, node]);
    onCreateFolder?.(folder, name);
    setQuery("");
    setKind("all");
    sel.select(node.id);
    setRenamingId(node.id);
  }, [readOnly, index, folder, setNodes, onCreateFolder, sel]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openUpload,
  } = useDropzone({
    noClick: true,
    noKeyboard: true,
    disabled: readOnly,
    onDrop: (files) => {
      if (!files.length) return;
      if (onUpload) onUpload(files, folder);
      else
        setNodes((prev) => [
          ...prev,
          ...files.map<FileNode>((f) => ({
            id: `up-${Date.now()}-${++seq}`,
            name: f.name,
            parentId: folder,
            kind: "file",
            size: f.size,
            mimeType: f.type,
            modifiedAt: Date.now(),
            owner: "You",
          })),
        ]);
      setAnnounce(`Uploaded ${files.length} file${files.length > 1 ? "s" : ""}`);
    },
  });

  const rootProps = getRootProps();
  const columns = Math.max(1, Math.floor((contentSize.width - 24 + 12) / (160 + 12)));

  const onItemClick = React.useCallback(
    (id: string, e: React.MouseEvent) => {
      sel.select(id, { shift: e.shiftKey, toggle: e.ctrlKey || e.metaKey });
    },
    [sel],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (renamingId) return;
    const step = view === "grid" ? columns : 1;
    const mod = e.ctrlKey || e.metaKey;
    let handled = true;
    switch (e.key) {
      case "ArrowDown":
        setScrollTo(sel.moveFocus(step, e.shiftKey));
        break;
      case "ArrowUp":
        setScrollTo(sel.moveFocus(-step, e.shiftKey));
        break;
      case "ArrowRight":
        if (view === "grid") setScrollTo(sel.moveFocus(1, e.shiftKey));
        else handled = false;
        break;
      case "ArrowLeft":
        if (view === "grid") setScrollTo(sel.moveFocus(-1, e.shiftKey));
        else handled = false;
        break;
      case "Home":
        setScrollTo(sel.moveFocus(-order.length, e.shiftKey));
        break;
      case "End":
        setScrollTo(sel.moveFocus(order.length, e.shiftKey));
        break;
      case "Enter": {
        const n = sel.focused ? index.byId.get(sel.focused) : undefined;
        if (n) open(n);
        break;
      }
      case "Backspace":
        if (folder) navigate(index.byId.get(folder)?.parentId ?? null);
        else handled = false;
        break;
      case "F2":
        if (!readOnly && sel.focused) setRenamingId(sel.focused);
        break;
      case "Delete":
        remove();
        break;
      case "Escape":
        sel.clear();
        break;
      case "a":
        if (mod) sel.selectAll();
        else handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };

  const toggleSort = React.useCallback(
    (key: FileSortKey) =>
      setSort((s) =>
        s.key === key ? { key, desc: !s.desc } : { key, desc: key === "modifiedAt" },
      ),
    [],
  );

  const viewProps = {
    rows,
    selected: sel.selected,
    focused: sel.focused,
    renamingId,
    onItemClick,
    onOpen: open,
    onRenameCommit: commitRename,
    onMoveInto: moveInto,
    onKeyDown,
    scrollToIndex: scrollTo,
    label: query
      ? `Search results for ${query}`
      : `Contents of ${crumbs.at(-1)?.name ?? rootLabel}`,
  };

  const iconBtn =
    "grid size-8 place-items-center rounded-crm text-crm-icon hover:bg-crm-muted hover:text-crm-fg disabled:opacity-40";

  return (
    <div
      className={cn(
        "flex h-[640px] min-h-0 flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2">
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-0.5 text-sm">
          {[{ id: null as string | null, name: rootLabel }, ...crumbs].map((c, i, arr) => (
            <React.Fragment key={c.id ?? "root"}>
              {i > 0 ? (
                <ChevronRight className="size-3.5 shrink-0 text-crm-muted-fg" aria-hidden />
              ) : null}
              <button
                type="button"
                aria-current={i === arr.length - 1 ? "page" : undefined}
                onClick={() => navigate(c.id)}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(FILE_DRAG_MIME)) e.preventDefault();
                }}
                onDrop={(e) => {
                  const raw = e.dataTransfer.getData(FILE_DRAG_MIME);
                  if (raw) moveInto(JSON.parse(raw) as string[], c.id);
                }}
                className={cn(
                  "truncate rounded-md px-1.5 py-0.5 hover:bg-crm-muted",
                  i === arr.length - 1 ? "font-semibold text-crm-fg" : "text-crm-soft",
                )}
              >
                {c.name}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <label className="flex h-8 w-48 items-center gap-2 rounded-crm border border-crm-border bg-crm-card px-2 text-crm-muted-fg focus-within:border-crm-primary">
          <Search className="size-3.5" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all files"
            aria-label="Search all files"
            className="min-w-0 flex-1 bg-transparent text-xs text-crm-fg outline-none placeholder:text-crm-muted-fg"
          />
        </label>
        <div className="flex items-center">
          <button
            type="button"
            className={iconBtn}
            aria-label="New folder"
            title="New folder"
            disabled={readOnly}
            onClick={createFolder}
          >
            <FolderPlus className="size-4" />
          </button>
          <button
            type="button"
            className={iconBtn}
            aria-label="Upload files"
            title="Upload"
            disabled={readOnly}
            onClick={openUpload}
          >
            <Upload className="size-4" />
          </button>
          <button
            type="button"
            className={iconBtn}
            aria-label="Rename"
            title="Rename (F2)"
            disabled={readOnly || sel.selected.size !== 1}
            onClick={() => setRenamingId([...sel.selected][0] ?? null)}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            className={iconBtn}
            aria-label="Delete"
            title="Delete"
            disabled={readOnly || !sel.selected.size}
            onClick={remove}
          >
            <Trash2 className="size-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-crm-border" />
          <div
            role="radiogroup"
            aria-label="View"
            className="flex rounded-crm border border-crm-border p-0.5"
          >
            {(["list", "grid"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                aria-label={`${v} view`}
                onClick={() => setView(v)}
                className={cn(
                  "grid size-7 place-items-center rounded-md",
                  view === v ? "bg-crm-muted text-crm-fg" : "text-crm-icon",
                )}
              >
                {v === "list" ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={cn(iconBtn, showPreview && "text-crm-fg")}
            aria-label="Toggle details pane"
            aria-pressed={showPreview}
            onClick={() => setShowPreview((s) => !s)}
          >
            <PanelRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-crm-border px-3 py-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={kind === f.id}
            onClick={() => setKind(f.id)}
            className={cn(
              "h-6 rounded-full px-2.5 text-xs",
              kind === f.id ? "bg-crm-primary text-white" : "text-crm-soft hover:bg-crm-muted",
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-crm-muted-fg tabular-nums">
          {sel.selected.size ? `${sel.selected.size} selected · ` : ""}
          {rows.length.toLocaleString()} items
        </span>
      </div>

      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel
          id="tree"
          defaultSize="22"
          minSize="14"
          maxSize="40"
          className="border-r border-crm-border bg-crm-sidebar"
        >
          <FolderTree
            folders={index.folders}
            currentId={folder}
            rootLabel={rootLabel}
            onNavigate={navigate}
            onMoveInto={moveInto}
          />
        </Panel>
        <Separator className="w-1 bg-transparent transition-colors hover:bg-crm-primary/40 data-[separator=active]:bg-crm-primary" />
        <Panel id="content" minSize="30">
          <div
            {...rootProps}
            ref={(el) => {
              (rootProps.ref as React.RefObject<HTMLElement | null>).current = el;
              setContentEl(el);
            }}
            className={cn("relative h-full min-h-0", isDragActive && "bg-crm-primary/10")}
          >
            <input {...getInputProps()} aria-label="Upload files" />
            {isDragActive ? (
              <div className="pointer-events-none absolute inset-3 z-10 grid place-items-center rounded-crm border-2 border-dashed border-crm-primary text-sm font-medium">
                Drop to upload into {crumbs.at(-1)?.name ?? rootLabel}
              </div>
            ) : null}
            {loading ? (
              <div role="status" className="grid h-full place-items-center text-crm-muted-fg">
                <Loader2 className="size-5 animate-spin" aria-label="Loading files" />
              </div>
            ) : error ? (
              <div role="alert" className="grid h-full place-items-center text-sm text-crm-danger">
                {error}
              </div>
            ) : rows.length === 0 ? (
              <div className="grid h-full place-items-center px-6 text-center text-sm text-crm-muted-fg">
                {query || kind !== "all"
                  ? "No files match your search or filter."
                  : readOnly
                    ? "This folder is empty."
                    : "This folder is empty. Drop files here or use Upload."}
              </div>
            ) : view === "list" ? (
              <ListView {...viewProps} sort={sort} onSort={toggleSort} />
            ) : (
              <GridView {...viewProps} columns={columns} />
            )}
          </div>
        </Panel>
        {showPreview ? (
          <>
            <Separator className="w-1 bg-transparent transition-colors hover:bg-crm-primary/40 data-[separator=active]:bg-crm-primary" />
            <Panel
              id="preview"
              defaultSize="26"
              minSize="18"
              maxSize="45"
              className="border-l border-crm-border bg-crm-card"
            >
              <PreviewPane
                items={selectedNodes}
                childCount={(id) => index.children.get(id)?.length ?? 0}
                pathOf={(n) => [rootLabel, ...pathTo(n.parentId).map((p) => p.name)].join(" / ")}
                onOpen={open}
                renderPreview={renderPreview}
              />
            </Panel>
          </>
        ) : null}
      </Group>
      {renameError ? (
        <div
          role="alert"
          className="border-t border-crm-border px-3 py-1.5 text-xs text-crm-danger"
        >
          {renameError}
        </div>
      ) : null}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
