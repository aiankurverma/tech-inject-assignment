import * as React from "react";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  AlertTriangle,
  History,
  ListTree,
  Loader2,
  RotateCcw,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { EndpointTree, MethodBadge } from "@/components/crm/pro-api-playground/endpoint-tree";
import {
  parseOpenApi,
  type ApiOperation,
  type ApiSpec,
} from "@/components/crm/pro-api-playground/openapi";
import {
  buildRequest,
  executeRequest,
  initialAuth,
  initialDraft,
  missingParams,
  type AuthValues,
  type ExecutedResponse,
  type Fetcher,
  type RequestDraft,
} from "@/components/crm/pro-api-playground/request";
import { RequestPanel } from "@/components/crm/pro-api-playground/request-panel";
import { ResponsePanel } from "@/components/crm/pro-api-playground/response-panel";
import type { SnippetLanguage } from "@/components/crm/pro-api-playground/snippets";
import { useRequestHistory, type RequestHistoryEntry } from "@/hooks/use-request-history";
import { cn } from "@/lib/utils";

export * from "@/components/crm/pro-api-playground/openapi";
export {
  buildSnippet,
  toCurl,
  toJavaScript,
  toPython,
  type BuiltRequest,
  type SnippetLanguage,
} from "@/components/crm/pro-api-playground/snippets";
export type {
  ExecutedResponse,
  Fetcher,
  RequestDraft,
  AuthValues,
} from "@/components/crm/pro-api-playground/request";

export interface ProApiPlaygroundProps {
  /** OpenAPI 3.x document (parsed JSON object or JSON string). */
  spec: unknown;
  /** Replace window.fetch, e.g. to proxy through your backend or mock in tests. */
  fetcher?: Fetcher;
  /** Server URL override; defaults to the first `servers` entry. */
  defaultServer?: string;
  /** Operation ("METHOD /path" or operationId) selected initially. */
  defaultOperation?: string;
  /** Persist history to localStorage under this key (null = memory only). */
  historyStorageKey?: string | null;
  historyLimit?: number;
  defaultSnippetLanguage?: SnippetLanguage;
  onResponse?: (op: ApiOperation, response: ExecutedResponse) => void;
  queryClient?: QueryClient;
  height?: number | string;
  disabled?: boolean;
  className?: string;
}

type Draft = RequestDraft;

function Playground({
  spec: specInput,
  fetcher,
  defaultServer,
  defaultOperation,
  historyStorageKey = null,
  historyLimit = 50,
  defaultSnippetLanguage = "curl",
  onResponse,
  height = 640,
  disabled,
  className,
}: Omit<ProApiPlaygroundProps, "queryClient">) {
  const parsed = React.useMemo<{ spec: ApiSpec | null; error: string | null }>(() => {
    try {
      return {
        spec: parseOpenApi(typeof specInput === "string" ? JSON.parse(specInput) : specInput),
        error: null,
      };
    } catch (e) {
      return { spec: null, error: (e as Error).message };
    }
  }, [specInput]);
  const spec = parsed.spec;

  const [server, setServer] = React.useState(() => defaultServer ?? spec?.servers[0]?.url ?? "");
  const [selectedId, setSelectedId] = React.useState<string | null>(() => {
    const ops = spec?.operations ?? [];
    return (
      (ops.find((o) => o.id === defaultOperation || o.operationId === defaultOperation) ?? ops[0])
        ?.id ?? null
    );
  });
  const [drafts, setDrafts] = React.useState<Map<string, Draft>>(() => new Map());
  const [auth, setAuth] = React.useState<AuthValues>(() =>
    spec ? initialAuth(spec) : initialAuth({ securitySchemes: [] } as unknown as ApiSpec),
  );
  const [snippetLang, setSnippetLang] = React.useState<SnippetLanguage>(defaultSnippetLanguage);
  const [sidebar, setSidebar] = React.useState<"endpoints" | "history">("endpoints");
  const history = useRequestHistory<Draft>(historyStorageKey, historyLimit);
  const abortRef = React.useRef<AbortController | null>(null);

  const op = React.useMemo(
    () => spec?.operations.find((o) => o.id === selectedId) ?? null,
    [spec, selectedId],
  );
  const draft = React.useMemo(
    () => (op ? (drafts.get(op.id) ?? initialDraft(op, server)) : null),
    [op, drafts, server],
  );
  const effectiveDraft = React.useMemo(
    () => (draft ? { ...draft, server } : null),
    [draft, server],
  );
  const setDraft = React.useCallback(
    (d: Draft) => setDrafts((prev) => new Map(prev).set(d.operationId, d)),
    [],
  );

  const snippetRequest = React.useMemo(
    () =>
      op && effectiveDraft && spec
        ? buildRequest(op, effectiveDraft, auth, spec.securitySchemes, { maskSecrets: true })
        : { method: "GET", url: "", headers: [] },
    [op, effectiveDraft, auth, spec],
  );
  const missing = op && effectiveDraft ? missingParams(op, effectiveDraft) : [];

  const mutation = useMutation({
    mutationFn: async ({ o, d }: { o: ApiOperation; d: Draft }) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const req = buildRequest(o, d, auth, spec!.securitySchemes);
      return executeRequest(req, fetcher ?? ((u, i) => fetch(u, i)), ctrl.signal);
    },
    onSuccess: (res, { o, d }) => {
      history.add({
        operationId: o.id,
        method: o.method,
        url: buildRequest(o, d, auth, spec!.securitySchemes, { maskSecrets: true }).url,
        status: res.status,
        durationMs: res.durationMs,
        draft: d,
      });
      onResponse?.(o, res);
    },
    onError: (_e, { o, d }) => {
      history.add({
        operationId: o.id,
        method: o.method,
        url: buildRequest(o, d, auth, spec!.securitySchemes, { maskSecrets: true }).url,
        status: null,
        durationMs: null,
        draft: d,
      });
    },
  });
  const { reset: resetMutation } = mutation;

  const send = React.useCallback(() => {
    if (!op || !effectiveDraft || disabled || missing.length) return;
    mutation.mutate({ o: op, d: effectiveDraft });
  }, [op, effectiveDraft, disabled, missing.length, mutation]);
  const cancel = () => abortRef.current?.abort();

  const select = React.useCallback(
    (o: ApiOperation) => {
      setSelectedId(o.id);
      resetMutation();
    },
    [resetMutation],
  );
  const restore = (e: RequestHistoryEntry<Draft>) => {
    const target = spec?.operations.find((o) => o.id === e.operationId);
    if (!target) return;
    setDraft(e.draft);
    setServer(e.draft.server);
    select(target);
  };

  React.useEffect(() => () => abortRef.current?.abort(), []);

  if (!spec)
    return (
      <div
        role="alert"
        className={cn(
          "flex items-center gap-2 rounded-crm border border-crm-border bg-crm-card p-4 text-sm text-crm-danger",
          className,
        )}
      >
        <AlertTriangle className="size-4" aria-hidden /> Could not load the API definition:{" "}
        {parsed.error}
      </div>
    );

  const isAbort = mutation.error instanceof DOMException && mutation.error.name === "AbortError";
  const errorMsg = mutation.isError
    ? isAbort
      ? "Request cancelled"
      : (mutation.error as Error).message
    : null;
  const sep =
    "w-px bg-crm-border outline-none transition-colors hover:bg-crm-ring focus-visible:bg-crm-ring data-[separator=active]:bg-crm-ring";
  const hsep =
    "h-px bg-crm-border outline-none transition-colors hover:bg-crm-ring focus-visible:bg-crm-ring";

  return (
    <section
      aria-label={`${spec.title} API playground`}
      aria-disabled={disabled || undefined}
      style={{ height }}
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised",
        disabled && "opacity-70",
        className,
      )}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          send();
        }
      }}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{spec.title}</h2>
          <p className="text-[11px] text-crm-muted-fg">
            v{spec.version} · {spec.operations.length} endpoints
            {spec.warnings.length > 0 && (
              <span className="ml-2 text-crm-warning" title={spec.warnings.join("\n")}>
                {spec.warnings.length} warning{spec.warnings.length > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-crm-muted-fg">
          Server
          <input
            list="pro-api-servers"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            disabled={disabled}
            className="h-8 w-64 rounded-crm border border-crm-input bg-crm-bg px-2 font-mono text-xs text-crm-fg outline-none focus:border-crm-ring"
          />
          <datalist id="pro-api-servers">
            {spec.servers.map((s) => (
              <option key={s.url} value={s.url}>
                {s.description}
              </option>
            ))}
          </datalist>
        </label>
      </header>

      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel
          id="sidebar"
          defaultSize="26"
          minSize="16"
          maxSize="45"
          className="flex min-h-0 flex-col"
        >
          <div
            role="tablist"
            aria-label="Sidebar"
            className="flex gap-1 border-b border-crm-border p-1.5"
          >
            {(
              [
                ["endpoints", ListTree, "Endpoints"],
                ["history", History, `History (${history.entries.length})`],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={sidebar === id}
                onClick={() => setSidebar(id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-crm px-2 py-1 text-xs text-crm-muted-fg hover:text-crm-fg focus-visible:outline focus-visible:outline-crm-ring",
                  sidebar === id && "bg-crm-muted text-crm-fg",
                )}
              >
                <Icon className="size-3.5" aria-hidden /> {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="min-h-0 flex-1">
            {sidebar === "endpoints" ? (
              <EndpointTree spec={spec} selectedId={selectedId} onSelect={select} />
            ) : history.entries.length === 0 ? (
              <p className="p-4 text-center text-sm text-crm-muted-fg">
                Requests you send appear here.
              </p>
            ) : (
              <div className="flex h-full flex-col">
                <ul className="min-h-0 flex-1 overflow-auto py-1" aria-label="Request history">
                  {history.entries.map((e) => (
                    <li key={e.id} className="group flex items-center">
                      <button
                        type="button"
                        onClick={() => restore(e)}
                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-crm-muted focus-visible:bg-crm-muted focus-visible:outline-none"
                      >
                        <MethodBadge method={e.method as ApiOperation["method"]} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono">
                            {e.url.replace(/^https?:\/\/[^/]+/, "")}
                          </span>
                          <span className="text-[10px] text-crm-muted-fg">
                            {new Date(e.at).toLocaleTimeString()} · {e.status ?? "failed"}
                            {e.durationMs !== null ? ` · ${e.durationMs.toFixed(0)} ms` : ""}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => history.remove(e.id)}
                        aria-label="Remove history entry"
                        className="mr-1 rounded-crm p-1 text-crm-muted-fg opacity-0 hover:text-crm-danger focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="size-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={history.clear}
                  className="border-t border-crm-border py-1.5 text-xs text-crm-muted-fg hover:text-crm-danger"
                >
                  Clear history
                </button>
              </div>
            )}
          </div>
        </Panel>
        <Separator className={sep} />
        <Panel id="main" minSize="40" className="flex min-h-0 flex-col">
          {!op || !effectiveDraft ? (
            <p className="m-auto text-sm text-crm-muted-fg">This API defines no endpoints.</p>
          ) : (
            <>
              <div className="border-b border-crm-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <MethodBadge method={op.method} className="w-auto text-xs" />
                  <code
                    className="min-w-0 flex-1 truncate font-mono text-xs text-crm-soft"
                    title={snippetRequest.url}
                  >
                    {snippetRequest.url}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(initialDraft(op, server));
                      resetMutation();
                    }}
                    aria-label="Reset request"
                    disabled={disabled}
                    className="rounded-crm p-1.5 text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                  </button>
                  {mutation.isPending ? (
                    <button
                      type="button"
                      onClick={cancel}
                      className="flex h-8 items-center gap-1.5 rounded-crm border border-crm-border px-3 text-xs hover:bg-crm-muted"
                    >
                      <Square className="size-3" aria-hidden /> Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={send}
                      disabled={disabled || missing.length > 0}
                      title={
                        missing.length
                          ? `Missing required: ${missing.join(", ")}`
                          : "Send (Ctrl/⌘ + Enter)"
                      }
                      className="flex h-8 items-center gap-1.5 rounded-crm bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {mutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Send className="size-3.5" aria-hidden />
                      )}{" "}
                      Send
                    </button>
                  )}
                </div>
                {(op.summary || op.deprecated) && (
                  <p className="mt-1 text-xs text-crm-muted-fg">
                    {op.deprecated && (
                      <span className="mr-2 rounded bg-crm-warning/15 px-1 text-crm-warning">
                        deprecated
                      </span>
                    )}
                    {op.summary}
                  </p>
                )}
                {missing.length > 0 && (
                  <p className="mt-1 text-xs text-crm-warning">Required: {missing.join(", ")}</p>
                )}
              </div>
              <Group orientation="vertical" className="min-h-0 flex-1">
                <Panel id="request" defaultSize="50" minSize="20" className="min-h-0">
                  <RequestPanel
                    op={op}
                    draft={effectiveDraft}
                    onDraftChange={setDraft}
                    auth={auth}
                    onAuthChange={setAuth}
                    schemes={spec.securitySchemes}
                    disabled={disabled}
                  />
                </Panel>
                <Separator className={hsep} />
                <Panel id="response" minSize="20" className="min-h-0">
                  <ResponsePanel
                    response={mutation.data ?? null}
                    error={errorMsg}
                    pending={mutation.isPending}
                    snippetRequest={snippetRequest}
                    snippetLanguage={snippetLang}
                    onSnippetLanguageChange={setSnippetLang}
                  />
                </Panel>
              </Group>
            </>
          )}
        </Panel>
      </Group>
    </section>
  );
}

/**
 * Postman-style "try it" console for an OpenAPI 3.x definition: virtualised endpoint tree, auth,
 * params, headers, schema-validated JSON body, timed execution, pretty/raw/headers response views,
 * cURL / JavaScript / Python snippets and request history.
 */
export function ProApiPlayground({ queryClient, ...props }: ProApiPlaygroundProps) {
  const [fallback] = React.useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient ?? fallback}>
      <Playground {...props} />
    </QueryClientProvider>
  );
}

export default ProApiPlayground;
