import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronsUpDown, Lock, SearchX, TriangleAlert } from "lucide-react";
import {
  api,
  ApiError,
  CodeBlock,
  CopyButton,
  PreviewFrame,
  type PreviewPayload,
} from "@ti/client";
import { Layout } from "../components/Layout";
import { useSession } from "../context/session";
import { AccessBadge, Breadcrumbs, btn, EmptyState, Skeleton, Tabs } from "../components/ui";

interface Detail {
  slug: string;
  name: string;
  description: string;
  category: string;
  access: "free" | "premium";
  version: string;
  locked: null | "sign_in_required" | "premium_required";
  props?: {
    name: string;
    type: string;
    default?: string;
    required: boolean;
    description: string;
  }[];
  usage?: string;
  dependencies?: string[];
  examples?: { title: string; code: string }[];
  files?: { path: string; content: string }[];
  installCommand?: string;
}

const toc = [
  { id: "preview", label: "Preview" },
  { id: "installation", label: "Installation" },
  { id: "usage", label: "Usage" },
  { id: "props", label: "Props" },
];

/**
 * Preview frame size by component (or category): small primitives get a short, zoomed
 * frame so they read clearly; overlays and big layouts get room.
 */
const FRAME: Record<string, { height: number; scale: number }> = {
  Primitives: { height: 280, scale: 1.25 },
  Forms: { height: 320, scale: 1.15 },
  Feedback: { height: 340, scale: 1 },
  Navigation: { height: 420, scale: 1 },
  Overlays: { height: 480, scale: 1 },
  "data-table": { height: 420, scale: 1 },
  "app-sidebar": { height: 480, scale: 1 },
};

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 className="group mb-4 scroll-mt-20 text-xl font-semibold tracking-tight text-foreground">
      <a href={`#${id}`} className="inline-flex items-center gap-2">
        {children}
        <span
          aria-hidden
          className="text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100"
        >
          #
        </span>
      </a>
    </h2>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="group/step relative pb-8 pl-10 last:pb-0">
      <span className="absolute top-0 left-0 grid size-7 place-items-center rounded-full border border-border bg-background font-mono text-xs font-medium text-foreground/80">
        {n}
      </span>
      <span
        aria-hidden
        className="absolute top-8 bottom-1 left-3.5 w-px bg-border group-last/step:hidden"
      />
      <p className="pt-0.5 text-sm font-medium text-foreground">{title}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </li>
  );
}

function PageSkeleton() {
  return (
    <div aria-label="Loading component" role="status">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-5 h-9 w-64" />
      <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      <Skeleton className="mt-2 h-4 w-2/3 max-w-md" />
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="mt-10 h-9 w-44" />
      <Skeleton className="mt-4 h-[420px] w-full rounded-lg" />
    </div>
  );
}

export function ComponentPage() {
  const { slug = "" } = useParams();
  const { me } = useSession();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [example, setExample] = useState(0);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [install, setInstall] = useState<"cli" | "manual">("cli");
  const [previewFailed, setPreviewFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError(null);
    setPayload(null);
    setPreviewFailed(null);
    setExample(0);
    api<Detail>(`/api/components/${slug}`)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        if (!d.locked) {
          api<PreviewPayload>(`/api/components/${slug}/preview`)
            .then((p) => alive && setPayload(p))
            .catch((e: Error) => alive && setPreviewFailed(e.message));
        }
      })
      .catch((e: ApiError) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [slug, me?.plan]);

  if (error) {
    const notFound = error.status === 404;
    return (
      <Layout>
        <EmptyState
          icon={notFound ? <SearchX className="size-5" /> : <TriangleAlert className="size-5" />}
          title={notFound ? "Component not found" : "Something went wrong"}
          action={
            <Link to="/components" className={btn.secondary}>
              <ArrowLeft className="size-4" aria-hidden />
              Back to components
            </Link>
          }
        >
          {error.message}
        </EmptyState>
      </Layout>
    );
  }
  if (!detail) {
    return (
      <Layout>
        <PageSkeleton />
      </Layout>
    );
  }

  const header = (
    <header className="mb-8">
      <Breadcrumbs
        items={[
          { label: "Components", to: "/components" },
          { label: detail.category },
          { label: detail.name },
        ]}
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {detail.name}
        </h1>
        <AccessBadge access={detail.access} locked={!!detail.locked} />
        <span className="font-mono text-xs text-muted-foreground/70">v{detail.version}</span>
      </div>
      <p className="mt-3 max-w-2xl text-base leading-7 text-pretty text-muted-foreground sm:text-lg">
        {detail.description}
      </p>
    </header>
  );

  if (detail.locked) {
    const needsSignIn = detail.locked === "sign_in_required";
    return (
      <Layout>
        {header}
        <div className="relative overflow-hidden rounded-xl border border-border bg-[#161616]">
          <img
            src={`/api/components/${slug}/thumbnail`}
            alt={`${detail.name} preview image`}
            className="h-[420px] w-full scale-105 object-cover opacity-50 blur-[2px]"
          />
          <div className="absolute inset-0 hidden bg-gradient-to-t from-black/60 via-black/20 to-transparent sm:block" />
          <div className="flex items-center justify-center bg-background sm:absolute sm:inset-0 sm:bg-transparent sm:p-4">
            <div className="w-full p-5 sm:max-w-sm sm:rounded-xl sm:border sm:border-border sm:bg-background sm:p-6 sm:shadow-2xl">
              <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                <Lock className="size-4" aria-hidden />
              </span>
              <p className="mt-4 text-base font-semibold text-foreground">
                {needsSignIn ? "Premium component" : "Premium required"}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                {needsSignIn
                  ? "Sign in with a premium account to see the live preview, code, install command and agent prompt."
                  : "Your account is on the Free plan. Ask the library admin to upgrade your account to Premium; access works immediately after the upgrade."}
              </p>
              {needsSignIn ? (
                <>
                  <ul className="mt-4 hidden space-y-1.5 text-sm text-foreground/80 sm:block">
                    {["Live preview and variants", "Full source code", "CLI and agent prompt"].map(
                      (f) => (
                        <li key={f} className="flex items-center gap-2">
                          <Check className="size-3.5 text-foreground" aria-hidden />
                          {f}
                        </li>
                      ),
                    )}
                  </ul>
                  <Link
                    to="/sign-in"
                    state={{ from: `/components/${slug}` }}
                    className={`${btn.primary} mt-5 w-full`}
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                <Link to="/account" className={`${btn.secondary} mt-5 w-full`}>
                  View account
                </Link>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const examples = detail.examples ?? [];
  const current = examples[example];
  const deps = detail.dependencies ?? [];
  const frame = FRAME[detail.slug] ?? FRAME[detail.category] ?? { height: 360, scale: 1 };

  return (
    <Layout toc={toc}>
      {header}
      <div className="-mt-2 mb-10 flex flex-wrap gap-2">
        <CopyButton variant="solid" getText={() => api<string>(`/api/components/${slug}/prompt`)}>
          <span className="sm:hidden">Prompt</span>
          <span className="hidden sm:inline">Copy prompt</span>
        </CopyButton>
        <CopyButton getText={() => api<string>(`/api/components/${slug}/copy`)}>
          <span className="sm:hidden">Code</span>
          <span className="hidden sm:inline">Copy code</span>
        </CopyButton>
        <CopyButton getText={() => detail.installCommand ?? ""}>
          <span className="sm:hidden">Install</span>
          <span className="hidden sm:inline">Copy install</span>
        </CopyButton>
      </div>

      <section
        id="preview"
        className="scroll-mt-20 overflow-hidden rounded-xl border border-border"
        aria-label="Preview"
      >
        <div className="flex flex-col gap-2 border-b border-border bg-subtle p-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Tabs
              value={tab}
              onChange={setTab}
              label="Preview or code"
              idPrefix="demo"
              items={[
                { value: "preview", label: "Preview" },
                { value: "code", label: "Code" },
              ]}
            />
          </div>
          {examples.length > 1 ? (
            <label className="relative block">
              <span className="sr-only">Variant</span>
              <select
                value={example}
                onChange={(e) => setExample(Number(e.target.value))}
                className="h-9 w-full appearance-none rounded-md border border-input bg-background pr-9 pl-3 text-sm font-medium shadow-xs transition-colors hover:border-foreground/20 sm:w-auto sm:min-w-44"
              >
                {examples.map((ex, i) => (
                  <option key={ex.title} value={i}>
                    {ex.title}
                  </option>
                ))}
              </select>
              <ChevronsUpDown
                className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </label>
          ) : null}
        </div>
        <div
          id="demo-panel-preview"
          role="tabpanel"
          aria-labelledby="demo-tab-preview"
          hidden={tab !== "preview"}
        >
          {previewFailed ? (
            <div
              className="flex flex-col items-center justify-center gap-2 bg-[#161616] p-6 text-center text-sm text-neutral-400"
              style={{ height: frame.height }}
            >
              <TriangleAlert className="size-5" aria-hidden />
              Could not load the live preview. {previewFailed}
            </div>
          ) : (
            <PreviewFrame
              payload={payload}
              example={example}
              title={`${detail.name} preview`}
              height={frame.height}
              scale={frame.scale}
              frameClassName=""
            />
          )}
        </div>
        <div
          id="demo-panel-code"
          role="tabpanel"
          aria-labelledby="demo-tab-code"
          hidden={tab !== "code"}
          className="bg-subtle p-3"
        >
          {current ? (
            <CodeBlock code={current.code} label={`${current.title} example`} maxHeight={420} />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">No example code for this component.</p>
          )}
        </div>
      </section>

      <section id="installation" className="mt-14 scroll-mt-20">
        <SectionTitle id="installation">Installation</SectionTitle>
        <div className="doc-prose mb-4">
          <p className="text-sm! leading-6! text-muted-foreground!">
            Needs the project setup from <Link to="/docs/get-started">Get started</Link>.
            {detail.access === "premium" ? (
              <>
                {" "}
                Set <code>KITBASE_TOKEN</code> first (see <Link to="/account">Account</Link>).
              </>
            ) : null}
          </p>
        </div>
        <Tabs
          value={install}
          onChange={setInstall}
          label="Installation method"
          idPrefix="install"
          items={[
            { value: "cli", label: "CLI" },
            { value: "manual", label: "Manual" },
          ]}
        />
        <div
          id="install-panel-cli"
          role="tabpanel"
          aria-labelledby="install-tab-cli"
          hidden={install !== "cli"}
          className="mt-4"
        >
          <CodeBlock label="terminal" code={detail.installCommand ?? ""} />
        </div>
        <div
          id="install-panel-manual"
          role="tabpanel"
          aria-labelledby="install-tab-manual"
          hidden={install !== "manual"}
          className="mt-6"
        >
          <ol>
            <Step n={1} title="Install the dependencies">
              <CodeBlock label="terminal" code={`npm install ${deps.join(" ")}`} />
            </Step>
            <Step n={2} title="Copy the files into your project">
              {(detail.files ?? []).map((f) => (
                <CodeBlock key={f.path} label={`src/${f.path}`} code={f.content} maxHeight={320} />
              ))}
            </Step>
          </ol>
        </div>
      </section>

      <section id="usage" className="mt-14 scroll-mt-20">
        <SectionTitle id="usage">Usage</SectionTitle>
        {detail.usage ? (
          <p className="mb-4 leading-7 whitespace-pre-line text-foreground/80">{detail.usage}</p>
        ) : null}
        {examples[0] ? <CodeBlock label="example.tsx" code={examples[0].code} /> : null}
      </section>

      <section id="props" className="mt-14 scroll-mt-20">
        <SectionTitle id="props">Props</SectionTitle>
        {detail.props?.length ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-subtle text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="h-10 px-4 font-medium">
                    Prop
                  </th>
                  <th scope="col" className="h-10 px-4 font-medium">
                    Type
                  </th>
                  <th scope="col" className="h-10 px-4 font-medium">
                    Default
                  </th>
                  <th scope="col" className="h-10 px-4 font-medium">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.props.map((p) => (
                  <tr key={p.name} className="align-top transition-colors hover:bg-subtle">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code className="font-mono text-[13px] font-medium text-foreground">
                        {p.name}
                      </code>
                      {p.required ? (
                        <span className="ml-2 rounded border border-border px-1 py-px text-[10px] font-medium text-muted-foreground uppercase">
                          Required
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs break-words text-foreground/80">
                        {p.type}
                      </code>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.default ?? "—"}
                    </td>
                    <td className="px-4 py-3 leading-6 text-muted-foreground">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No props documented.
          </p>
        )}
      </section>
    </Layout>
  );
}
