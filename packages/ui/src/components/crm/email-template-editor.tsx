import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Heading,
  Minus,
  MousePointerClick,
  Pilcrow,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/crm/button";
import { Input, FormField } from "@/components/crm/input";
import { Textarea } from "@/components/crm/textarea";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export type TemplateBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "button"; label: string; url: string }
  | { id: string; type: "divider" };

export interface EmailTemplate {
  name: string;
  subject: string;
  preheader: string;
  blocks: TemplateBlock[];
}

export interface MergeField {
  /** Token used inside {{ }}, e.g. "first_name". */
  key: string;
  label: string;
  /** Value used in the live preview. */
  sample: string;
  /** Used when the contact has no value. */
  fallback?: string;
}

export interface EmailTemplateEditorProps {
  value?: EmailTemplate;
  defaultValue?: EmailTemplate;
  onChange?: (template: EmailTemplate) => void;
  mergeFields: MergeField[];
  /** Return a promise to show a saving state. */
  onSave?: (template: EmailTemplate) => void | Promise<void>;
  /** Subject length above which a warning is shown (inbox truncation). */
  subjectLimit?: number;
  className?: string;
}

const TOKEN_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
const URL_RE = /^(https?:\/\/|mailto:|\{\{)/i;

/** Finds tokens used in the template that are not defined merge fields. */
export function findUnknownTokens(t: EmailTemplate, fields: MergeField[]) {
  const known = new Set(fields.map((f) => f.key));
  const texts = [t.subject, t.preheader];
  t.blocks.forEach((b) => {
    if (b.type === "heading" || b.type === "text") texts.push(b.text);
    if (b.type === "button") texts.push(b.label, b.url);
  });
  const bad = new Set<string>();
  texts.forEach((s) => {
    for (const m of s.matchAll(TOKEN_RE)) if (m[1] && !known.has(m[1])) bad.add(m[1]);
  });
  return [...bad];
}

/** Replaces {{tokens}} with sample (or fallback) values. */
export function renderMerge(s: string, fields: MergeField[]) {
  return s.replace(TOKEN_RE, (all, key: string) => {
    const f = fields.find((x) => x.key === key);
    return f ? f.sample || f.fallback || "" : all;
  });
}

type Target =
  | { field: "subject" | "preheader" }
  | { field: "block"; blockId: string; prop: "text" | "label" | "url" };

let seq = 0;
const uid = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

const blockMeta = {
  heading: { label: "Heading", icon: Heading },
  text: { label: "Text", icon: Pilcrow },
  button: { label: "Button", icon: MousePointerClick },
  divider: { label: "Divider", icon: Minus },
} as const;

/** Block-based email template editor with merge fields, validation, reordering and a live desktop/mobile preview. */
export function EmailTemplateEditor({
  value,
  defaultValue,
  onChange,
  mergeFields,
  onSave,
  subjectLimit = 60,
  className,
}: EmailTemplateEditorProps) {
  const [inner, setInner] = React.useState<EmailTemplate>(
    defaultValue ?? { name: "Untitled template", subject: "", preheader: "", blocks: [] },
  );
  const t = value ?? inner;
  const [focusId, setFocusId] = React.useState<string | null>(t.blocks[0]?.id ?? null);
  const [device, setDevice] = React.useState("desktop");
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const lastField = React.useRef<{
    el: HTMLInputElement | HTMLTextAreaElement;
    target: Target;
  } | null>(null);
  const latest = React.useRef(t);
  latest.current = t;

  const update = (next: EmailTemplate) => {
    if (value === undefined) setInner(next);
    setDirty(true);
    onChange?.(next);
  };
  const patchBlock = (id: string, patch: Partial<TemplateBlock>) =>
    update({
      ...t,
      blocks: t.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as TemplateBlock) : b)),
    });
  const addBlock = (type: TemplateBlock["type"]) => {
    const id = uid();
    const b: TemplateBlock =
      type === "button"
        ? { id, type, label: "Book a call", url: "https://" }
        : type === "divider"
          ? { id, type }
          : { id, type, text: "" };
    const at = focusId ? t.blocks.findIndex((x) => x.id === focusId) + 1 : t.blocks.length;
    const blocks = [...t.blocks];
    blocks.splice(at <= 0 ? blocks.length : at, 0, b);
    update({ ...t, blocks });
    setFocusId(id);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= t.blocks.length) return;
    const blocks = [...t.blocks];
    const a = blocks[i];
    const b = blocks[j];
    if (!a || !b) return;
    blocks[i] = b;
    blocks[j] = a;
    update({ ...t, blocks });
  };

  const applyTarget = (target: Target, v: string) => {
    const cur = latest.current;
    if (target.field === "block") {
      const { blockId, prop } = target;
      update({
        ...cur,
        blocks: cur.blocks.map((b) =>
          b.id === blockId ? ({ ...b, [prop]: v } as TemplateBlock) : b,
        ),
      });
    } else update({ ...cur, [target.field]: v });
  };
  const track =
    (target: Target) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      lastField.current = { el: e.currentTarget, target };
    };
  const insertToken = (key: string) => {
    const f = lastField.current;
    if (!f) return;
    const { el } = f;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const token = `{{${key}}}`;
    applyTarget(f.target, el.value.slice(0, start) + token + el.value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const unknown = findUnknownTokens(t, mergeFields);
  const badUrls = t.blocks.filter(
    (b) => b.type === "button" && (!URL_RE.test(b.url) || b.url === "https://"),
  );
  const issues = [
    !t.subject.trim() && "Subject is empty",
    !t.blocks.length && "Template has no content",
    ...unknown.map((k) => `Unknown merge field {{${k}}}`),
    ...badUrls.map((b) => `Button "${b.type === "button" ? b.label : ""}" needs a valid link`),
  ].filter(Boolean) as string[];

  const save = async () => {
    if (!onSave || issues.length) return;
    setSaving(true);
    try {
      await onSave(t);
      setSavedAt(new Date());
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const subjectLen = renderMerge(t.subject, mergeFields).length;

  return (
    <section
      aria-label={`Email template ${t.name}`}
      className={cn(
        "grid overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 border-b border-crm-border p-4 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-2">
          <input
            aria-label="Template name"
            value={t.name}
            onChange={(e) => update({ ...t, name: e.target.value })}
            className="min-w-0 flex-1 rounded bg-transparent text-base font-semibold text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          />
          <span className="text-xs text-crm-subtle" aria-live="polite">
            {saving
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : savedAt
                  ? `Saved ${savedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                  : ""}
          </span>
        </div>
        <FormField
          label="Subject"
          htmlFor="ete-subject"
          required
          hint={`${subjectLen} / ${subjectLimit} characters in preview${subjectLen > subjectLimit ? " — may be truncated in inboxes" : ""}`}
        >
          <Input
            id="ete-subject"
            value={t.subject}
            aria-describedby="ete-subject-msg"
            invalid={subjectLen > subjectLimit}
            onFocus={track({ field: "subject" })}
            onChange={(e) => update({ ...t, subject: e.target.value })}
          />
        </FormField>
        <FormField
          label="Preheader"
          htmlFor="ete-pre"
          hint="Shown after the subject in most inboxes"
        >
          <Input
            id="ete-pre"
            value={t.preheader}
            aria-describedby="ete-pre-msg"
            onFocus={track({ field: "preheader" })}
            onChange={(e) => update({ ...t, preheader: e.target.value })}
          />
        </FormField>

        <div>
          <p className="crm-eyebrow mb-1.5 text-crm-subtle">Insert merge field</p>
          <div className="flex flex-wrap gap-1">
            {mergeFields.map((f) => (
              <button
                key={f.key}
                type="button"
                title={`Preview: ${f.sample}${f.fallback ? ` · fallback: ${f.fallback}` : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertToken(f.key)}
                className="cursor-pointer rounded-full border border-crm-border bg-crm-raised px-2 py-0.5 text-[11px] text-crm-soft outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <ol className="flex flex-col gap-2" aria-label="Blocks">
          {t.blocks.map((b, i) => {
            const Meta = blockMeta[b.type];
            return (
              <li
                key={b.id}
                onFocusCapture={() => setFocusId(b.id)}
                className={cn(
                  "rounded-crm border bg-crm-raised p-2",
                  focusId === b.id ? "border-crm-primary/70" : "border-crm-border",
                )}
              >
                <div className="mb-1.5 flex items-center gap-1.5 text-xs text-crm-soft">
                  <Meta.icon className="size-3.5" aria-hidden />
                  <span className="flex-1">{Meta.label}</span>
                  <IconButton
                    label={`Move ${Meta.label} up`}
                    className="size-6"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    label={`Move ${Meta.label} down`}
                    className="size-6"
                    disabled={i === t.blocks.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </IconButton>
                  <IconButton
                    label={`Delete ${Meta.label}`}
                    className="size-6"
                    onClick={() => update({ ...t, blocks: t.blocks.filter((x) => x.id !== b.id) })}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
                {b.type === "heading" ? (
                  <Input
                    aria-label="Heading text"
                    value={b.text}
                    onFocus={track({ field: "block", blockId: b.id, prop: "text" })}
                    onChange={(e) => patchBlock(b.id, { text: e.target.value })}
                  />
                ) : b.type === "text" ? (
                  <Textarea
                    aria-label="Paragraph text"
                    autoResize
                    maxRows={8}
                    value={b.text}
                    onFocus={track({ field: "block", blockId: b.id, prop: "text" })}
                    onChange={(e) => patchBlock(b.id, { text: e.target.value })}
                  />
                ) : b.type === "button" ? (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <Input
                      aria-label="Button label"
                      value={b.label}
                      onFocus={track({ field: "block", blockId: b.id, prop: "label" })}
                      onChange={(e) => patchBlock(b.id, { label: e.target.value })}
                    />
                    <Input
                      aria-label="Button link"
                      value={b.url}
                      invalid={badUrls.includes(b)}
                      onFocus={track({ field: "block", blockId: b.id, prop: "url" })}
                      onChange={(e) => patchBlock(b.id, { url: e.target.value })}
                    />
                  </div>
                ) : (
                  <hr className="border-crm-border" />
                )}
              </li>
            );
          })}
          {!t.blocks.length ? (
            <li className="rounded-crm border border-dashed border-crm-border p-4 text-center text-xs text-crm-subtle">
              Add a block to start writing.
            </li>
          ) : null}
        </ol>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(blockMeta) as TemplateBlock["type"][]).map((type) => (
            <Button key={type} size="sm" variant="muted" onClick={() => addBlock(type)}>
              <Plus /> {blockMeta[type].label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 bg-crm-bg p-4">
        <div className="flex items-center justify-between gap-2">
          <SegmentedControl
            label="Preview device"
            size="sm"
            value={device}
            onValueChange={setDevice}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
            ]}
          />
          {onSave ? (
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!!issues.length}
              onClick={save}
            >
              Save template
            </Button>
          ) : null}
        </div>
        {issues.length ? (
          <ul
            role="alert"
            className="flex flex-col gap-1 rounded-crm border border-crm-danger/40 bg-crm-danger/10 p-2 text-xs text-crm-danger"
          >
            {issues.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <Tag color="green" size="sm" className="self-start">
            Ready to send
          </Tag>
        )}
        <div
          aria-label="Inbox preview"
          className={cn(
            "mx-auto w-full rounded-crm bg-white text-[#1f2328] shadow-crm-raised transition-[max-width] duration-200",
            device === "mobile" ? "max-w-[340px]" : "max-w-[560px]",
          )}
        >
          <div className="border-b border-[#e5e7eb] px-4 py-3">
            <p className="truncate text-sm font-semibold">
              {renderMerge(t.subject, mergeFields) || "(no subject)"}
            </p>
            <p className="truncate text-xs text-[#6b7280]">
              {renderMerge(t.preheader, mergeFields)}
            </p>
          </div>
          <div className="flex flex-col gap-3 px-4 py-4 text-sm leading-relaxed">
            {t.blocks.map((b) =>
              b.type === "heading" ? (
                <h3 key={b.id} className="text-lg font-semibold">
                  {renderMerge(b.text, mergeFields)}
                </h3>
              ) : b.type === "text" ? (
                <p key={b.id} className="whitespace-pre-wrap">
                  {renderMerge(b.text, mergeFields)}
                </p>
              ) : b.type === "button" ? (
                <span
                  key={b.id}
                  className="self-start rounded-md bg-[#6346ff] px-4 py-2 text-sm font-medium text-white"
                >
                  {renderMerge(b.label, mergeFields)}
                </span>
              ) : (
                <hr key={b.id} className="border-[#e5e7eb]" />
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
