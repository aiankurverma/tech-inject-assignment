import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2,
  CircleAlert,
  EyeOff,
  FileJson,
  ImageOff,
  Rocket,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { api, ApiError, PreviewFrame, type PreviewPayload } from "@ti/client";
import type { Detail, Summary } from "./types";
import { absoluteTime, errorMessage, relativeTime } from "./types";
import {
  AccessBadge,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  cn,
  focusRing,
  selectClass,
  useToast,
} from "./ui";

const TEMPLATE = JSON.stringify(
  {
    name: "My Component",
    slug: "my-component",
    description: "What it is and when to use it.",
    category: "Primitives",
    version: "1.0.0",
    access: "free",
    dependencies: [],
    files: [
      {
        path: "components/crm/my-component.tsx",
        content:
          'export function MyComponent() {\n  return <div className="text-crm-fg">Hello</div>;\n}\n',
      },
    ],
    examples: [
      {
        title: "Default",
        code: 'import { MyComponent } from "@/components/crm/my-component";\n\nexport default function Example() {\n  return <MyComponent />;\n}\n',
      },
    ],
    props: [],
    usage: "",
  },
  null,
  2,
);

const MAX_BYTES = 1_000_000;

/** Big bundles are saved by a background job (202). */
type Queued = { status: "queued"; jobId: string };
const isQueued = (r: unknown): r is Queued => (r as Queued | null)?.status === "queued";

/** Polls the save job; resolves with the component summary once it is saved. */
async function waitForJob(jobId: string, slug: string): Promise<Summary> {
  for (;;) {
    const job = await api<{ state: string; error?: string }>(`/api/admin/jobs/${jobId}`);
    if (job.state === "completed") return api<Summary>(`/api/admin/components/${slug}`);
    if (job.state === "failed") {
      const [message = "Save failed", ...details] = (job.error ?? "").split("\n");
      throw new ApiError(422, "invalid_bundle", message, details);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

type Busy = null | "validate" | "save" | "publish" | "unpublish" | "load";

export function Editor() {
  const { slug } = useParams();
  const isNew = !slug;
  const navigate = useNavigate();
  const toast = useToast();
  const [text, setText] = useState(isNew ? TEMPLATE : "");
  const [savedText, setSavedText] = useState(isNew ? TEMPLATE : "");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState<Busy>(isNew ? null : "load");
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [example, setExample] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    const d = await api<Detail>(`/api/admin/components/${slug}`);
    const t = JSON.stringify(d.draft, null, 2);
    setDetail(d);
    setText(t);
    setSavedText(t);
    setPayload(await api<PreviewPayload>(`/api/admin/components/${slug}/preview`));
  }, [slug]);

  const initialLoad = useCallback(async () => {
    setLoadError(null);
    setBusy("load");
    try {
      await load();
    } catch (e) {
      setLoadError(errorMessage(e, "Could not load component"));
    } finally {
      setBusy(null);
    }
  }, [load]);

  useEffect(() => {
    if (!slug) return;
    setExample(0);
    void initialLoad();
  }, [slug, initialLoad]);

  const parse = (): unknown => {
    try {
      return JSON.parse(text);
    } catch (e) {
      setErrors([`JSON syntax error: ${e instanceof Error ? e.message : ""}`]);
      return undefined;
    }
  };

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setErrors([]);
    setValid(false);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError) setErrors([e.message, ...e.details]);
      else setErrors([errorMessage(e, "Failed")]);
      toast.error("Action failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setErrors(["File is larger than 1 MB."]);
      toast.error("File too large", "Bundles must be 1 MB or smaller.");
      return;
    }
    setText(await file.text());
    setFileName(file.name);
    setErrors([]);
    setValid(false);
    toast.info(`Loaded ${file.name}`, "Validate, then save.");
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    await readFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = async (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    await readFile(e.dataTransfer.files[0]);
  };

  const validate = () =>
    run("validate", async () => {
      const body = parse();
      if (body === undefined) return;
      const res = await api<{ ok: boolean; errors: string[] }>("/api/admin/validate", {
        method: "POST",
        json: body,
      });
      if (res.ok) {
        setValid(true);
        toast.success("Bundle is valid");
      } else {
        setErrors(res.errors);
      }
    });

  const save = () =>
    run("save", async () => {
      const body = parse();
      if (body === undefined) return;
      if (isNew) {
        const res = await api<Summary | Queued>("/api/admin/components", {
          method: "POST",
          json: body,
        });
        const s = isQueued(res)
          ? await waitForJob(res.jobId, String((body as { slug?: unknown }).slug))
          : res;
        toast.success("Draft created", s.name);
        navigate(`/components/${s.slug}`);
      } else {
        const res = await api(`/api/admin/components/${slug}`, { method: "PUT", json: body });
        if (isQueued(res)) await waitForJob(res.jobId, slug!);
        await load();
        toast.success("Draft saved", "Preview updated.");
      }
    });

  const setLive = (action: "publish" | "unpublish") =>
    run(action, async () => {
      await api(`/api/admin/components/${slug}/${action}`, { method: "POST" });
      await load();
      setConfirmUnpublish(false);
      if (action === "publish") toast.success("Published", "It is live in the catalogue now.");
      else toast.success("Unpublished", "Hidden from the catalogue and installer.");
    });

  const onEditorKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (!busy) void save();
    }
  };

  const dirty = text !== savedText;
  const lines = text ? text.split("\n").length : 0;
  const bytes = new Blob([text]).size;
  const examples = payload?.examples ?? [];
  const title = isNew ? "New component" : (detail?.name ?? slug ?? "");
  const upToDate = detail?.status === "published" && !detail.hasUnpublishedChanges;

  if (!isNew && loadError && !detail) {
    return (
      <Card>
        <ErrorState message={loadError} onRetry={() => void initialLoad()} />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        meta={
          <>
            {detail ? <StatusBadge status={detail.status} /> : null}
            {isNew ? <Badge variant="outline">Not saved</Badge> : null}
            {dirty && !isNew ? <Badge variant="warning">Unsaved edits</Badge> : null}
          </>
        }
        description={
          isNew
            ? "Paste or upload a bundle, validate it, then create the draft."
            : detail
              ? `${detail.slug} · updated ${relativeTime(detail.updatedAt)}`
              : undefined
        }
        actions={
          <>
            <Button
              icon={ShieldCheck}
              onClick={() => void validate()}
              loading={busy === "validate"}
              disabled={!!busy}
            >
              Validate
            </Button>
            <Button
              variant={isNew ? "primary" : "secondary"}
              icon={Save}
              onClick={() => void save()}
              loading={busy === "save"}
              disabled={!!busy}
              title="Ctrl+S"
            >
              {isNew ? "Create draft" : "Save draft"}
            </Button>
            {detail?.status === "published" ? (
              <Button icon={EyeOff} onClick={() => setConfirmUnpublish(true)} disabled={!!busy}>
                Unpublish
              </Button>
            ) : null}
            {isNew || !detail ? null : upToDate ? (
              <span
                className="inline-flex h-9 items-center gap-1.5 px-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"
                title="The live version matches the saved draft"
              >
                <CheckCircle2 className="size-4" aria-hidden />
                Up to date
              </span>
            ) : (
              <Button
                variant="primary"
                icon={Rocket}
                onClick={() => void setLive("publish")}
                loading={busy === "publish"}
                disabled={!!busy}
                title={dirty ? "Publishing uses the last saved draft" : undefined}
              >
                Publish draft
              </Button>
            )}
          </>
        }
      />

      {errors.length ? (
        <Card
          className="mb-6 border-red-200 dark:border-red-500/30"
          role="alert"
          aria-labelledby="val-errors"
        >
          <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
            <CircleAlert
              className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h2 id="val-errors" className="text-sm font-semibold text-red-900 dark:text-red-200">
                {errors.length === 1 ? "1 problem found" : `${errors.length} problems found`}
              </h2>
              <ol className="mt-2 space-y-1.5 text-sm text-red-800 dark:text-red-200">
                {errors.map((e, i) => (
                  <li key={`${i}-${e}`} className="flex gap-2">
                    <span className="w-5 shrink-0 text-right font-mono text-xs leading-5 text-red-400">
                      {i + 1}.
                    </span>
                    <span className="min-w-0 font-mono text-xs leading-5 break-words">{e}</span>
                  </li>
                ))}
              </ol>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setErrors([])}>
              Dismiss
            </Button>
          </div>
        </Card>
      ) : valid ? (
        <div
          role="status"
          className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-200"
        >
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Bundle is valid.{" "}
          {isNew ? "Create the draft to preview it." : "Save the draft to update the preview."}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: bundle */}
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader
              title="Bundle JSON"
              description={
                <>
                  Format documented in <span className="font-mono">docs/bundle-format.md</span>.
                  Save first to preview; publish copies the saved draft.
                </>
              }
            />
            <div className="p-4 sm:p-5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => void onDrop(e)}
                className={cn(
                  "mb-4 flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-center transition-colors sm:flex-row sm:text-left",
                  dragging ? "border-foreground bg-muted" : "border-foreground/20 bg-subtle",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background shadow-xs">
                  <FileJson className="size-4 text-foreground/70" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-foreground">
                    {fileName ? `Loaded ${fileName}` : "Drop a .json bundle here"}
                  </p>
                  <p className="text-xs text-muted-foreground">or choose a file. Max 1 MB.</p>
                </div>
                <input
                  ref={fileInput}
                  id="bundle-file"
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => void onFile(e)}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                />
                <Button size="sm" icon={Upload} onClick={() => fileInput.current?.click()}>
                  Upload JSON
                </Button>
              </div>

              <label htmlFor="bundle-json" className="sr-only">
                Bundle JSON
              </label>
              {busy === "load" && !detail ? (
                <Skeleton className="h-[520px] w-full rounded-lg" />
              ) : (
                <div className="overflow-hidden rounded-lg border border-border focus-within:ring-2 focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-background">
                  <textarea
                    id="bundle-json"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setValid(false);
                    }}
                    onKeyDown={onEditorKey}
                    spellCheck={false}
                    wrap="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-describedby="bundle-meta"
                    className="block h-[520px] w-full resize-y bg-neutral-950 p-4 font-mono text-xs leading-5 font-normal whitespace-pre text-neutral-200 caret-white outline-none selection:bg-neutral-700 focus-visible:outline-none"
                  />
                  <div
                    id="bundle-meta"
                    className="flex items-center justify-between border-t border-neutral-800 bg-neutral-900 px-4 py-1.5 font-mono text-[11px] text-neutral-400"
                  >
                    <span>
                      {lines} lines · {(bytes / 1024).toFixed(1)} KB
                    </span>
                    <span className="flex items-center gap-3">
                      {dirty && !isNew ? <span className="text-amber-400">modified</span> : null}
                      <span className="hidden sm:inline">Ctrl+S to save</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: details, preview, thumbnail */}
        <div className="space-y-6 lg:col-span-5">
          {!isNew ? (
            <Card>
              <CardHeader title="Details" />
              {detail ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-sm sm:px-5">
                  <div>
                    <dt className="text-xs text-muted-foreground">Status</dt>
                    <dd className="mt-1">
                      <StatusBadge status={detail.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Access</dt>
                    <dd className="mt-1">
                      <AccessBadge access={detail.access} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Draft version</dt>
                    <dd className="mt-1 font-mono text-xs">v{detail.draftVersion}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Live version</dt>
                    <dd className="mt-1 font-mono text-xs">
                      {detail.publishedVersion ? `v${detail.publishedVersion}` : "Not live"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Category</dt>
                    <dd className="mt-1">{detail.category}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Updated</dt>
                    <dd className="mt-1" title={absoluteTime(detail.updatedAt)}>
                      {relativeTime(detail.updatedAt)}
                    </dd>
                  </div>
                  {detail.hasUnpublishedChanges ? (
                    <div className="col-span-2 flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-500/25 ring-inset">
                      <CircleAlert className="size-3.5" aria-hidden />
                      The saved draft differs from the live version.
                    </div>
                  ) : null}
                </dl>
              ) : (
                <div className="grid grid-cols-2 gap-4 p-5">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Draft preview"
              description={isNew ? undefined : "Renders the last saved draft in a sandbox"}
              actions={
                examples.length > 1 ? (
                  <>
                    <label htmlFor="example-select" className="sr-only">
                      Example
                    </label>
                    <select
                      id="example-select"
                      value={example}
                      onChange={(e) => setExample(Number(e.target.value))}
                      className={cn(selectClass, "h-8 text-xs")}
                    >
                      {examples.map((ex, i) => (
                        <option key={`${i}-${ex.title}`} value={i}>
                          {ex.title}
                        </option>
                      ))}
                    </select>
                  </>
                ) : examples.length === 1 ? (
                  <Badge variant="outline">{examples[0]?.title}</Badge>
                ) : null
              }
            />
            <div className="p-4 sm:p-5">
              {isNew ? (
                <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed border-foreground/20 bg-subtle text-center">
                  <Rocket className="mb-2 size-5 text-muted-foreground/70" aria-hidden />
                  <p className="text-sm font-medium text-foreground/80">No preview yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Create the draft to see a preview.
                  </p>
                </div>
              ) : (
                <PreviewFrame
                  payload={payload}
                  example={example}
                  title="Draft preview"
                  height={420}
                  frameClassName="rounded-lg border border-border"
                />
              )}
            </div>
          </Card>

          {!isNew && slug ? (
            <Card>
              <CardHeader title="Thumbnail" description="Static image shown for locked previews" />
              <div className="p-4 sm:p-5">
                <ThumbnailImage slug={slug} version={detail?.updatedAt ?? ""} />
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmUnpublish}
        title={`Unpublish ${detail?.name ?? "component"}?`}
        description="It will be hidden from the catalogue and the installer. You can publish it again at any time."
        confirmLabel="Unpublish"
        destructive
        loading={busy === "unpublish"}
        onConfirm={() => void setLive("unpublish")}
        onCancel={() => setConfirmUnpublish(false)}
      />
    </>
  );
}

function ThumbnailImage({ slug, version }: { slug: string; version: string }) {
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const key = `${slug}@${version}`;
  if (failedFor === key)
    return (
      <div className="flex h-32 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/20 bg-subtle text-sm text-muted-foreground">
        <ImageOff className="size-4" aria-hidden />
        No thumbnail available
      </div>
    );
  return (
    <a
      href={`/api/admin/components/${slug}/thumbnail`}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "block w-full max-w-xs overflow-hidden rounded-lg border border-border",
        focusRing,
      )}
    >
      <img
        src={`/api/admin/components/${slug}/thumbnail${version ? `?v=${encodeURIComponent(version)}` : ""}`}
        alt="Static thumbnail used for locked previews"
        loading="lazy"
        onError={() => setFailedFor(key)}
        className="block w-full bg-muted"
      />
    </a>
  );
}
