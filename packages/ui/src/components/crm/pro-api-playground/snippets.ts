/**
 * Code snippet generation for the playground (curl, JavaScript fetch, Python requests).
 * Built in-house: small, deterministic string builders with correct shell/JS/Python escaping.
 */

export interface BuiltRequest {
  method: string;
  url: string;
  headers: [string, string][];
  body?: string;
}

export type SnippetLanguage = "curl" | "javascript" | "python";

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function parseJson(body: string | undefined): { ok: true; value: unknown } | { ok: false } {
  if (body === undefined || body.trim() === "") return { ok: false };
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false };
  }
}

export function toCurl(r: BuiltRequest): string {
  const parts = [`curl --request ${r.method.toUpperCase()}`, `  --url ${shellQuote(r.url)}`];
  for (const [k, v] of r.headers) parts.push(`  --header ${shellQuote(`${k}: ${v}`)}`);
  if (r.body) {
    const parsed = parseJson(r.body);
    parts.push(
      `  --data ${shellQuote(parsed.ok ? JSON.stringify(parsed.value, null, 2) : r.body)}`,
    );
  }
  return parts.join(" \\\n");
}

export function toJavaScript(r: BuiltRequest): string {
  const headers = Object.fromEntries(r.headers);
  const parsed = parseJson(r.body);
  const opts: string[] = [`  method: ${JSON.stringify(r.method.toUpperCase())}`];
  if (r.headers.length)
    opts.push(`  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, "\n  ")}`);
  if (r.body)
    opts.push(
      parsed.ok
        ? `  body: JSON.stringify(${JSON.stringify(parsed.value, null, 2).replace(/\n/g, "\n  ")})`
        : `  body: ${JSON.stringify(r.body)}`,
    );
  return [
    `const response = await fetch(${JSON.stringify(r.url)}, {`,
    opts.join(",\n"),
    `});`,
    ``,
    `if (!response.ok) throw new Error(\`HTTP \${response.status}\`);`,
    `const data = await response.json();`,
    `console.log(data);`,
  ].join("\n");
}

function py(v: unknown, indent = 0): string {
  const pad = "    ".repeat(indent + 1);
  const end = "    ".repeat(indent);
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "None";
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v))
    return v.length ? `[\n${v.map((x) => pad + py(x, indent + 1)).join(",\n")}\n${end}]` : "[]";
  const entries = Object.entries(v as Record<string, unknown>);
  return entries.length
    ? `{\n${entries.map(([k, x]) => `${pad}${JSON.stringify(k)}: ${py(x, indent + 1)}`).join(",\n")}\n${end}}`
    : "{}";
}

export function toPython(r: BuiltRequest): string {
  const parsed = parseJson(r.body);
  const out = ["import requests", "", `url = ${JSON.stringify(r.url)}`];
  const args = ["url"];
  if (r.headers.length) {
    out.push(`headers = ${py(Object.fromEntries(r.headers))}`);
    args.push("headers=headers");
  }
  if (r.body) {
    if (parsed.ok) {
      out.push(`payload = ${py(parsed.value)}`);
      args.push("json=payload");
    } else {
      out.push(`payload = ${JSON.stringify(r.body)}`);
      args.push("data=payload");
    }
  }
  out.push(
    "",
    `response = requests.request(${JSON.stringify(r.method.toUpperCase())}, ${args.join(", ")}, timeout=30)`,
    "response.raise_for_status()",
    "print(response.json())",
  );
  return out.join("\n");
}

export function buildSnippet(lang: SnippetLanguage, r: BuiltRequest): string {
  return lang === "curl" ? toCurl(r) : lang === "javascript" ? toJavaScript(r) : toPython(r);
}
