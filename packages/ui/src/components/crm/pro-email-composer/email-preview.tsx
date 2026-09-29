import * as React from "react";
import type { JSONContent } from "@tiptap/react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MERGE_NODE,
  mergeFieldsIn,
  renderTokens,
  resolveField,
  tokensIn,
} from "@/components/crm/pro-email-composer/merge";
import type {
  MergeFieldDef,
  MergeRecord,
  SampleRecord,
} from "@/components/crm/pro-email-composer/types";

type Ctx = { record: MergeRecord | undefined; highlight: boolean };

function safeHref(href: unknown): string | undefined {
  if (typeof href !== "string") return undefined;
  return /^(https?:|mailto:|tel:)/i.test(href) ? href : undefined;
}

function renderText(node: JSONContent, key: React.Key): React.ReactNode {
  let el: React.ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        el = <strong>{el}</strong>;
        break;
      case "italic":
        el = <em>{el}</em>;
        break;
      case "underline":
        el = <u>{el}</u>;
        break;
      case "strike":
        el = <s>{el}</s>;
        break;
      case "code":
        el = <code className="rounded bg-crm-muted px-1 text-[0.9em]">{el}</code>;
        break;
      case "link":
        el = (
          <a
            href={safeHref(mark.attrs?.href)}
            className="text-crm-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            {el}
          </a>
        );
        break;
    }
  }
  return <React.Fragment key={key}>{el}</React.Fragment>;
}

function renderNode(node: JSONContent, key: React.Key, ctx: Ctx): React.ReactNode {
  const kids = () => node.content?.map((c, i) => renderNode(c, i, ctx));
  switch (node.type) {
    case "doc":
      return <React.Fragment key={key}>{kids()}</React.Fragment>;
    case "text":
      return renderText(node, key);
    case MERGE_NODE: {
      const r = resolveField(ctx.record, String(node.attrs?.id), node.attrs?.fallback as string);
      if (!ctx.highlight) return <React.Fragment key={key}>{r.text}</React.Fragment>;
      return (
        <mark
          key={key}
          className={cn(
            "rounded-[3px] px-0.5 text-inherit",
            r.source === "value" && "bg-tag-purple-bg",
            r.source === "fallback" && "bg-tag-amber-bg",
            r.source === "missing" && "bg-tag-red-bg",
          )}
        >
          {r.text || `{{${String(node.attrs?.id)}}}`}
        </mark>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="my-2 min-h-[1em]">
          {kids()}
        </p>
      );
    case "heading": {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)));
      const H = `h${level}` as "h1" | "h2" | "h3";
      return (
        <H key={key} className="my-3 font-semibold">
          {kids()}
        </H>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="my-2 list-disc pl-6">
          {kids()}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="my-2 list-decimal pl-6">
          {kids()}
        </ol>
      );
    case "listItem":
      return <li key={key}>{kids()}</li>;
    case "blockquote":
      return (
        <blockquote key={key} className="my-2 border-l-2 border-crm-input pl-3 text-crm-soft">
          {kids()}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre key={key} className="my-2 overflow-x-auto rounded bg-crm-muted p-2 text-xs">
          {kids()}
        </pre>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} className="my-3 border-crm-border" />;
    default:
      return <React.Fragment key={key}>{kids()}</React.Fragment>;
  }
}

export interface EmailPreviewProps {
  doc: JSONContent;
  subject: string;
  from?: string;
  to: string[];
  records: SampleRecord[];
  recordId: string | undefined;
  onRecordChange: (id: string) => void;
  fields: Map<string, MergeFieldDef>;
}

/** Renders the template against a sample record and reports unresolved merge fields. */
export function EmailPreview({
  doc,
  subject,
  from,
  to,
  records,
  recordId,
  onRecordChange,
  fields,
}: EmailPreviewProps) {
  const [highlight, setHighlight] = React.useState(true);
  const record = records.find((r) => r.id === recordId) ?? records[0];
  const data = record?.data;

  const issues = React.useMemo(() => {
    const used = [...tokensIn(subject), ...mergeFieldsIn(doc)];
    const seen = new Set<string>();
    const out: { key: string; label: string; kind: "unknown" | "missing" | "fallback" }[] = [];
    for (const u of used) {
      const id = `${u.key}|${u.fallback ?? ""}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const def = fields.get(u.key);
      const r = resolveField(data, u.key, u.fallback);
      const label = def?.label ?? u.key;
      if (!def) out.push({ key: u.key, label, kind: "unknown" });
      else if (r.source === "missing") out.push({ key: u.key, label, kind: "missing" });
      else if (r.source === "fallback") out.push({ key: u.key, label, kind: "fallback" });
    }
    return out;
  }, [doc, subject, data, fields]);

  const blocking = issues.filter((i) => i.kind !== "fallback");
  const body = React.useMemo(
    () => renderNode(doc, "root", { record: data, highlight }),
    [doc, data, highlight],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-crm-muted-fg">
          Preview as
          <select
            value={record?.id ?? ""}
            onChange={(e) => onRecordChange(e.target.value)}
            disabled={!records.length}
            className="h-8 max-w-[16rem] rounded-[6px] border border-crm-input bg-crm-bg px-1.5 text-sm text-crm-fg outline-none focus:border-crm-ring"
          >
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-crm-muted-fg">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(e) => setHighlight(e.target.checked)}
            className="accent-crm-primary"
          />
          Highlight merged values
        </label>
      </div>
      <div
        role="status"
        className={cn(
          "flex items-start gap-2 rounded-crm border px-3 py-2 text-xs",
          blocking.length
            ? "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text"
            : "border-tag-green-border bg-tag-green-bg text-tag-green-text",
        )}
      >
        {blocking.length ? (
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        ) : (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        )}
        <div>
          {blocking.length
            ? `${blocking.length} field${blocking.length > 1 ? "s" : ""} will render empty for ${record?.label ?? "this record"}: ${blocking.map((b) => (b.kind === "unknown" ? `${b.key} (unknown)` : b.label)).join(", ")}. Add a fallback.`
            : `All merge fields resolve for ${record?.label ?? "this record"}.`}
          {issues.some((i) => i.kind === "fallback") && (
            <span className="block opacity-80">
              Using fallback for{" "}
              {issues
                .filter((i) => i.kind === "fallback")
                .map((i) => i.label)
                .join(", ")}
              .
            </span>
          )}
        </div>
      </div>
      <article
        aria-label="Rendered email preview"
        className="rounded-crm border border-crm-border bg-crm-card text-sm text-crm-fg"
      >
        <dl className="grid grid-cols-[4rem_1fr] gap-x-2 gap-y-1 border-b border-crm-border px-4 py-3 text-xs">
          {from && (
            <>
              <dt className="text-crm-muted-fg">From</dt>
              <dd className="truncate">{from}</dd>
            </>
          )}
          <dt className="text-crm-muted-fg">To</dt>
          <dd className="truncate">{to.length ? to.join(", ") : "—"}</dd>
          <dt className="text-crm-muted-fg">Subject</dt>
          <dd className="font-medium">{renderTokens(subject, data) || "(no subject)"}</dd>
        </dl>
        <div className="px-4 py-2 leading-relaxed">{body}</div>
      </article>
    </div>
  );
}
