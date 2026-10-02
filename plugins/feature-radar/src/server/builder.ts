/**
 * AI draft builder: asks an LLM (Anthropic, Gemini, Inception, OpenRouter or Ollama, plain fetch)
 * to write a component bundle for a requested feature term. The caller validates and
 * stores the result as a DRAFT; nothing here publishes anything.
 */
import { createHash } from "node:crypto";

export type AiProvider = "anthropic" | "gemini" | "inception" | "openrouter" | "ollama";

export interface ProviderConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

/** Token counts reported by the provider for one call (0 when it reports nothing). */
export interface AiUsage {
  provider: AiProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

/** Which LLM to ask, and what to try next when it fails. Shared by every AI feature. */
export interface ProviderChain {
  /** Defaults to "anthropic". */
  provider?: AiProvider;
  /** Tried in order when the primary provider fails (bad key, HTTP error, unreachable). */
  fallbacks?: ProviderConfig[];
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  /** Output token cap per call (default 8000). Keep it near the largest valid reply. */
  maxTokens?: number;
  /** Reuse a successful reply to an identical request for this long; 0 or unset disables. */
  cacheTtlMs?: number;
  /** Called after every provider reply that reports token usage. */
  onUsage?: (usage: AiUsage) => void;
}

export interface BuildOptions extends ProviderChain {
  styleExample: string;
  themeClasses: string;
  allowedDependencies?: readonly string[];
  fixErrors?: string[];
}

export type BuildResult = { ok: true; bundle: unknown } | { ok: false; error: string };
export type JsonResult = { ok: true; json: unknown } | { ok: false; error: string };

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

const DEFAULT_MAX_TOKENS = 8000;
const maxTokens = (opts: ProviderChain) => opts.maxTokens ?? DEFAULT_MAX_TOKENS;

type Tokens = Omit<AiUsage, "provider" | "model">;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** OpenAI-style chat completions (OpenRouter, Inception). */
const chatRequest = (
  url: string,
  system: string,
  user: string,
  opts: ProviderChain,
  extra: Record<string, unknown> = {},
): [string, RequestInit] => [
  url,
  {
    method: "POST",
    headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: maxTokens(opts),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...extra,
    }),
  },
];
const chatText = (body: unknown) =>
  (body as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
const chatUsage = (body: unknown): Tokens => {
  const u = (body as { usage?: Record<string, unknown> }).usage ?? {};
  const details = (u.prompt_tokens_details ?? {}) as Record<string, unknown>;
  return {
    inputTokens: num(u.prompt_tokens),
    outputTokens: num(u.completion_tokens),
    cachedInputTokens: num(details.cached_tokens),
  };
};

/** Provider-specific request, reply text and usage extraction; everything else is shared. */
const PROVIDERS: Record<
  AiProvider,
  {
    keyName: string;
    request: (system: string, user: string, opts: ProviderChain) => [string, RequestInit];
    text: (body: unknown) => string;
    usage: (body: unknown) => Tokens;
  }
> = {
  anthropic: {
    keyName: "ANTHROPIC_API_KEY",
    request: (system, user, opts) => [
      ANTHROPIC_URL,
      {
        method: "POST",
        headers: {
          "x-api-key": opts.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: maxTokens(opts),
          system,
          messages: [{ role: "user", content: user }],
        }),
      },
    ],
    text: (body) =>
      ((body as { content?: { type: string; text?: string }[] }).content ?? [])
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text)
        .join(""),
    usage: (body) => {
      const u = (body as { usage?: Record<string, unknown> }).usage ?? {};
      return {
        inputTokens: num(u.input_tokens),
        outputTokens: num(u.output_tokens),
        cachedInputTokens: num(u.cache_read_input_tokens),
      };
    },
  },
  gemini: {
    keyName: "GEMINI_API_KEY",
    request: (system, user, opts) => [
      geminiUrl(opts.model),
      {
        method: "POST",
        headers: { "x-goog-api-key": opts.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: opts.maxTokens ?? 8192,
          },
        }),
      },
    ],
    text: (body) =>
      (
        (body as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]
          ?.content?.parts ?? []
      )
        .map((p) => p.text ?? "")
        .join(""),
    usage: (body) => {
      const u = (body as { usageMetadata?: Record<string, unknown> }).usageMetadata ?? {};
      return {
        inputTokens: num(u.promptTokenCount),
        outputTokens: num(u.candidatesTokenCount),
        cachedInputTokens: num(u.cachedContentTokenCount),
      };
    },
  },
  // Inception (Mercury diffusion models): OpenAI-compatible; JSON mode avoids prose and fences.
  inception: {
    keyName: "INCEPTION_API_KEY",
    request: (system, user, opts) =>
      chatRequest("https://api.inceptionlabs.ai/v1/chat/completions", system, user, opts, {
        response_format: { type: "json_object" },
      }),
    text: chatText,
    usage: chatUsage,
  },
  openrouter: {
    keyName: "OPENROUTER_API_KEYS",
    request: (system, user, opts) =>
      chatRequest("https://openrouter.ai/api/v1/chat/completions", system, user, opts),
    text: chatText,
    usage: chatUsage,
  },
  ollama: {
    keyName: "OLLAMA_CLOUD_KEY",
    request: (system, user, opts) => [
      "https://ollama.com/api/chat",
      {
        method: "POST",
        headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      },
    ],
    text: (body) => (body as { message?: { content?: string } }).message?.content ?? "",
    usage: (body) => {
      const b = body as Record<string, unknown>;
      return {
        inputTokens: num(b.prompt_eval_count),
        outputTokens: num(b.eval_count),
        cachedInputTokens: 0,
      };
    },
  },
};

/** Successful replies by request hash, so an identical request is not paid for twice. */
const replyCache = new Map<string, { at: number; json: unknown }>();
const REPLY_CACHE_MAX = 200;

const cacheKey = (system: string, user: string, opts: ProviderChain) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        opts.provider ?? "anthropic",
        opts.model,
        maxTokens(opts),
        (opts.fallbacks ?? []).map((f) => `${f.provider}:${f.model}`),
        system,
        user,
      ]),
    )
    .digest("hex");

/** Test hook: forget cached replies. */
export function clearReplyCache(): void {
  replyCache.clear();
}

/** "kanban board" → "kanban-board" (matches the bundle slug rules). */
export function termToSlug(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

function systemPrompt(slug: string, opts: BuildOptions): string {
  const deps = (
    opts.allowedDependencies ?? ["react", "lucide-react", "clsx", "tailwind-merge"]
  ).join(", ");
  return [
    "You write React + TypeScript UI components for a dark CRM component library.",
    "Output ONLY one JSON object (no prose, no markdown fences) with exactly these keys:",
    `- name: short human name (2-60 chars)`,
    `- slug: "${slug}"`,
    `- description: 10-400 chars`,
    `- category: e.g. "Data display", "Forms", "Navigation", "Feedback", "Layout"`,
    `- version: "1.0.0"`,
    `- access: "free"`,
    `- dependencies: array, subset of [${deps}] (only packages you import)`,
    `- files: [{ "path": "components/crm/${slug}.tsx", "content": "<full TSX source>" }]`,
    `- examples: 1-3 items [{ "title": "...", "code": "<TSX module with a default export that imports from \\"@/components/crm/${slug}\\">" }]`,
    `- props: [{ "name", "type", "default"?, "required", "description" }]`,
    `- usage: short markdown usage notes`,
    "Rules:",
    `- Only these imports are allowed: react, the allowed packages above, "@/lib/utils" (exports cn), and "@/components/crm/${slug}" in examples.`,
    "- Style with Tailwind using these theme token classes (never raw hex colours):",
    opts.themeClasses,
    "- Match the dark CRM look of the style example below. Export typed props (interface) and a named component.",
    "- Accessible: semantic elements, labels/aria where needed, keyboard operable, visible focus.",
    "Style example:",
    opts.styleExample,
  ].join("\n");
}

function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  if (fence?.[1] != null) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(t.slice(start, end + 1)) as unknown;
}

/** Tries the primary provider, then each fallback, returning the first usable reply. */
export async function buildBundle(term: string, opts: BuildOptions): Promise<BuildResult> {
  const slug = termToSlug(term);
  let user = `Build a component for the feature request: "${term}".`;
  if (opts.fixErrors && opts.fixErrors.length > 0) {
    user += `
Your previous bundle failed validation: ${opts.fixErrors.slice(0, 20).join("; ")}
Return a corrected full JSON bundle.`;
  }
  const r = await completeJson(systemPrompt(slug, opts), user, opts);
  return r.ok ? { ok: true, bundle: r.json } : r;
}

/**
 * Asks for one JSON object, trying the primary provider and then each fallback.
 * Transport and key errors move on to the next provider; an unparsable reply does not.
 */
export async function completeJson(
  system: string,
  user: string,
  opts: ProviderChain,
): Promise<JsonResult> {
  const ttl = opts.cacheTtlMs ?? 0;
  const key = ttl > 0 ? cacheKey(system, user, opts) : "";
  if (key) {
    const hit = replyCache.get(key);
    if (hit && Date.now() - hit.at < ttl) return { ok: true, json: hit.json };
    if (hit) replyCache.delete(key);
  }
  const chain: ProviderChain[] = [
    opts,
    ...(opts.fallbacks ?? []).map((f) => ({ ...opts, ...f, fallbacks: undefined })),
  ];
  const errors: string[] = [];
  for (const attempt of chain) {
    const result = await completeOnce(system, user, attempt);
    if (result.ok && key) {
      if (replyCache.size >= REPLY_CACHE_MAX) {
        const oldest = replyCache.keys().next().value;
        if (oldest !== undefined) replyCache.delete(oldest);
      }
      replyCache.set(key, { at: Date.now(), json: result.json });
    }
    if (result.ok || !/rejected|HTTP|reach|unreadable/i.test(result.error)) return result;
    errors.push(`${attempt.provider ?? "anthropic"}: ${result.error}`);
  }
  return { ok: false, error: errors.join(" | ") };
}

async function completeOnce(
  system: string,
  user: string,
  opts: ProviderChain,
): Promise<JsonResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const provider = PROVIDERS[opts.provider ?? "anthropic"];
  let res: Response;
  try {
    res = await doFetch(...provider.request(system, user, opts));
  } catch {
    return { ok: false, error: "Could not reach the AI API." };
  }
  // Gemini answers a bad key with 400 API_KEY_INVALID, Anthropic with 401.
  const badKey =
    res.status === 401 ||
    res.status === 403 ||
    (res.status === 400 && /API_KEY_INVALID|API key not valid/i.test(await res.clone().text()));
  if (badKey) {
    return {
      ok: false,
      error: `AI API key was rejected (HTTP ${res.status}). Set a valid ${provider.keyName} and restart the API.`,
    };
  }
  if (!res.ok) return { ok: false, error: `AI API returned HTTP ${res.status}.` };

  let body: unknown;
  let text: string;
  try {
    body = await res.json();
    text = provider.text(body);
  } catch {
    return { ok: false, error: "AI API returned an unreadable response." };
  }
  const tokens =
    body && typeof body === "object"
      ? provider.usage(body)
      : { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  if (opts.onUsage && tokens.inputTokens + tokens.outputTokens > 0)
    opts.onUsage({ provider: opts.provider ?? "anthropic", model: opts.model, ...tokens });
  try {
    return { ok: true, json: extractJson(text) };
  } catch {
    return { ok: false, error: "AI reply was not valid JSON." };
  }
}
