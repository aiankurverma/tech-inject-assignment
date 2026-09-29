import * as React from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import * as Tabs from "@radix-ui/react-tabs";
import type { Accept } from "react-dropzone";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { AttachmentDropzone } from "@/components/crm/pro-email-composer/attachment-dropzone";
import { EmailPreview } from "@/components/crm/pro-email-composer/email-preview";
import { MERGE_NODE, tokensIn } from "@/components/crm/pro-email-composer/merge";
import {
  MergeContext,
  MergeField,
  type MergeContextValue,
} from "@/components/crm/pro-email-composer/merge-field-extension";
import { isEmail, RecipientInput } from "@/components/crm/pro-email-composer/recipient-input";
import { SendLaterPicker } from "@/components/crm/pro-email-composer/send-later-picker";
import {
  SuggestionMenu,
  useSuggestionBridge,
} from "@/components/crm/pro-email-composer/suggestion-menu";
import { ComposerToolbar } from "@/components/crm/pro-email-composer/toolbar";
import type {
  EmailAttachment,
  EmailDraft,
  EmailSnippet,
  MergeFieldDef,
  SampleRecord,
  ScheduleValue,
  SuggestionItemBase,
} from "@/components/crm/pro-email-composer/types";

export type {
  EmailAttachment,
  EmailDraft,
  EmailSnippet,
  MergeFieldDef,
  SampleRecord,
  ScheduleValue,
} from "@/components/crm/pro-email-composer/types";

interface FieldItem extends SuggestionItemBase {
  fallback?: string;
}
interface SnippetItem extends SuggestionItemBase {
  snippet: EmailSnippet;
}

const MAX_SUGGESTIONS = 50;

function matches(q: string, ...hay: (string | undefined)[]) {
  if (!q) return true;
  const n = q.toLowerCase();
  return hay.some((h) => h?.toLowerCase().includes(n));
}

export interface ProEmailComposerProps {
  /** Fields that can be merged with `{{`. */
  fields: MergeFieldDef[];
  /** Reusable blocks inserted with `/`. */
  snippets?: EmailSnippet[];
  /** Records used by the Preview tab to render merge fields. */
  sampleRecords?: SampleRecord[];
  from?: string;
  /** Controlled recipients. */
  to?: string[];
  defaultTo?: string[];
  onToChange?: (to: string[]) => void;
  defaultSubject?: string;
  /** Initial body: Tiptap JSON or HTML (merge tokens like `{{contact.firstName}}` become chips). */
  defaultContent?: JSONContent | string;
  /** Controlled schedule. `null` = send now. */
  schedule?: ScheduleValue | null;
  onScheduleChange?: (s: ScheduleValue | null) => void;
  /** Controlled attachments. */
  attachments?: EmailAttachment[];
  onAttachmentsChange?: (a: EmailAttachment[]) => void;
  /** Called on every change with the full draft. */
  onDraftChange?: (draft: EmailDraft) => void;
  /** Send or schedule. Throw / reject to show an error. */
  onSend: (draft: EmailDraft) => void | Promise<void>;
  /** Zone the send-later picker opens in, e.g. the recipient's. */
  defaultTimeZone?: string;
  maxAttachmentBytes?: number;
  maxAttachments?: number;
  acceptAttachments?: Accept;
  placeholder?: string;
  disabled?: boolean;
  /** Shows a skeleton while template data loads. */
  loading?: boolean;
  className?: string;
}

/**
 * Sales email composer on Tiptap: merge field chips with fallbacks (`{{`), slash snippets (`/`),
 * attachments, time-zone aware send-later and a preview rendered against sample records.
 */
export function ProEmailComposer({
  fields,
  snippets = [],
  sampleRecords = [],
  from,
  to: toProp,
  defaultTo = [],
  onToChange,
  defaultSubject = "",
  defaultContent = "",
  schedule: scheduleProp,
  onScheduleChange,
  attachments: attachmentsProp,
  onAttachmentsChange,
  onDraftChange,
  onSend,
  defaultTimeZone,
  maxAttachmentBytes = 25 * 1024 * 1024,
  maxAttachments = 10,
  acceptAttachments,
  placeholder = "Write your email… type {{ for merge fields or / for snippets",
  disabled = false,
  loading = false,
  className,
}: ProEmailComposerProps) {
  const [to, setTo] = useControllableState(toProp, defaultTo, onToChange);
  const [schedule, setSchedule] = useControllableState<ScheduleValue | null>(
    scheduleProp,
    null,
    onScheduleChange,
  );
  const [attachments, setAttachments] = useControllableState(
    attachmentsProp,
    [],
    onAttachmentsChange,
  );
  const [subject, setSubject] = React.useState(defaultSubject);
  const [doc, setDoc] = React.useState<JSONContent>({ type: "doc", content: [] });
  const [tab, setTab] = React.useState("write");
  const [recordId, setRecordId] = React.useState(sampleRecords[0]?.id);
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; at: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const fieldMap = React.useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const fieldItems = React.useMemo<FieldItem[]>(
    () =>
      fields.map((f) => ({
        id: f.key,
        label: f.label,
        group: f.group,
        hint: f.key,
        fallback: f.fallback,
      })),
    [fields],
  );
  const snippetItems = React.useMemo<SnippetItem[]>(
    () =>
      snippets.map((s) => ({
        id: s.id,
        label: s.title,
        hint: s.description,
        group: "Snippets",
        snippet: s,
      })),
    [snippets],
  );
  // Suggestion plugins are created once; read the latest items through refs.
  const itemsRef = React.useRef({ fieldItems, snippetItems });
  itemsRef.current = { fieldItems, snippetItems };

  const fieldBridge = useSuggestionBridge<FieldItem>();
  const snippetBridge = useSuggestionBridge<SnippetItem>();

  const editor = useEditor({
    editable: !disabled,
    content: defaultContent,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      Placeholder.configure({ placeholder }),
      MergeField.configure({
        fields,
        HTMLAttributes: { class: "merge-field" },
        suggestions: [
          {
            char: "{{",
            items: ({ query }) =>
              itemsRef.current.fieldItems
                .filter((f) => matches(query, f.label, f.id, f.group))
                .slice(0, MAX_SUGGESTIONS),
            command: ({ editor: ed, range, props }) => {
              const item = props as FieldItem;
              ed.chain()
                .focus()
                .insertContentAt(range, [
                  {
                    type: MERGE_NODE,
                    attrs: { id: item.id, label: item.label, fallback: item.fallback ?? null },
                  },
                  { type: "text", text: " " },
                ])
                .run();
            },
            render: fieldBridge.render,
          },
          {
            char: "/",
            items: ({ query }) =>
              itemsRef.current.snippetItems
                .filter((s) => matches(query, s.label, s.hint))
                .slice(0, MAX_SUGGESTIONS),
            command: ({ editor: ed, range, props }) => {
              const { snippet } = props as SnippetItem;
              ed.chain().focus().deleteRange(range).insertContent(snippet.content).run();
            },
            render: snippetBridge.render,
          },
        ],
      }),
    ],
    editorProps: {
      attributes: {
        "aria-label": "Email body",
        "aria-multiline": "true",
        role: "textbox",
        class:
          "min-h-[220px] px-4 py-3 text-sm leading-relaxed text-crm-fg outline-none [&_blockquote]:border-l-2 [&_blockquote]:border-crm-input [&_blockquote]:pl-3 [&_blockquote]:text-crm-soft [&_a]:text-crm-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-crm-faint [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
      },
    },
    onCreate: ({ editor: ed }) => setDoc(ed.getJSON()),
    onUpdate: ({ editor: ed }) => setDoc(ed.getJSON()),
  });

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const buildDraft = React.useCallback(
    (): EmailDraft => ({
      to,
      subject,
      json: doc,
      templateHtml: editor?.getHTML() ?? "",
      attachments,
      schedule,
    }),
    [to, subject, doc, editor, attachments, schedule],
  );

  const draftRef = React.useRef(onDraftChange);
  draftRef.current = onDraftChange;
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    draftRef.current?.(buildDraft());
  }, [buildDraft]);

  const validRecipients = to.filter(isEmail);
  const invalidRecipients = to.length - validRecipients.length;
  const bodyEmpty = !(doc.content ?? []).some((n) => (n.content?.length ?? 0) > 0);
  const unknownSubjectFields = tokensIn(subject).filter((t) => !fieldMap.has(t.key));
  const problems = [
    !validRecipients.length && "Add at least one recipient",
    invalidRecipients > 0 &&
      `${invalidRecipients} invalid address${invalidRecipients > 1 ? "es" : ""}`,
    !subject.trim() && "Add a subject",
    bodyEmpty && "Write a message",
    unknownSubjectFields.length > 0 &&
      `Unknown subject field ${unknownSubjectFields.map((f) => f.key).join(", ")}`,
  ].filter(Boolean) as string[];
  const canSend = !disabled && !loading && problems.length === 0 && status.kind !== "sending";

  const send = async () => {
    if (!canSend) return;
    setStatus({ kind: "sending" });
    try {
      await onSend(buildDraft());
      setStatus({
        kind: "sent",
        at: schedule ? "Scheduled" : "Sent",
      });
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error)?.message || "Could not send the email." });
    }
  };

  const mergeCtx = React.useMemo<MergeContextValue>(() => {
    const rec = sampleRecords.find((r) => r.id === recordId) ?? sampleRecords[0];
    return { fields: fieldMap, record: rec?.data, recordLabel: rec?.label, disabled };
  }, [fieldMap, sampleRecords, recordId, disabled]);

  if (loading || !editor) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading composer"
        className={cn(
          "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 font-crm",
          className,
        )}
      >
        {[40, 60, 100, 90, 70].map((w, i) => (
          <div
            key={i}
            className={cn("animate-pulse rounded bg-crm-muted", i < 2 ? "h-6" : "h-4")}
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <MergeContext.Provider value={mergeCtx}>
      <form
        aria-label="Compose email"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void send();
          }
        }}
        className={cn(
          "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
          disabled && "opacity-70",
          className,
        )}
      >
        {from && (
          <div className="flex items-center gap-2 border-b border-crm-border px-4 py-2 text-sm">
            <span className="text-crm-muted-fg">From</span>
            <span className="truncate">{from}</span>
          </div>
        )}
        <RecipientInput
          label="To"
          value={to}
          onChange={setTo}
          disabled={disabled}
          placeholder="name@company.com"
        />
        <div className="flex items-center gap-2 border-b border-crm-border px-4 py-2">
          <label htmlFor="kb-email-subject" className="text-sm text-crm-muted-fg">
            Subject
          </label>
          <input
            id="kb-email-subject"
            value={subject}
            disabled={disabled}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Quick question about {{company.name}}"
            className="h-7 flex-1 bg-transparent text-sm font-medium text-crm-fg outline-none placeholder:font-normal placeholder:text-crm-faint"
          />
        </div>

        <Tabs.Root value={tab} onValueChange={setTab} className="flex flex-col">
          <Tabs.List
            aria-label="Composer view"
            className="flex gap-1 border-b border-crm-border px-3 pt-1.5"
          >
            {[
              { v: "write", l: "Write" },
              { v: "preview", l: "Preview" },
            ].map((t) => (
              <Tabs.Trigger
                key={t.v}
                value={t.v}
                className="-mb-px border-b-2 border-transparent px-2 pb-1.5 text-sm text-crm-muted-fg hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none data-[state=active]:border-crm-primary data-[state=active]:text-crm-fg"
              >
                {t.l}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value="write" forceMount className="data-[state=inactive]:hidden">
            <ComposerToolbar editor={editor} disabled={disabled} />
            <EditorContent editor={editor} />
          </Tabs.Content>
          <Tabs.Content value="preview" className="p-4">
            <EmailPreview
              doc={doc}
              subject={subject}
              from={from}
              to={validRecipients}
              records={sampleRecords}
              recordId={recordId}
              onRecordChange={setRecordId}
              fields={fieldMap}
            />
          </Tabs.Content>
        </Tabs.Root>

        <div className="border-t border-crm-border px-4 py-3">
          <AttachmentDropzone
            value={attachments}
            onChange={setAttachments}
            maxTotalBytes={maxAttachmentBytes}
            maxFiles={maxAttachments}
            accept={acceptAttachments}
            disabled={disabled}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-crm-border bg-crm-raised/40 px-4 py-3">
          <div className="min-w-0 flex-1 text-xs" aria-live="polite">
            {status.kind === "error" ? (
              <span role="alert" className="flex items-center gap-1.5 text-crm-danger">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                {status.message}
              </span>
            ) : status.kind === "sent" ? (
              <span className="flex items-center gap-1.5 text-crm-success">
                <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                {status.at}
              </span>
            ) : problems.length ? (
              <span className="text-crm-muted-fg">{problems[0]}</span>
            ) : (
              <span className="text-crm-subtle">
                Ctrl+Enter to {schedule ? "schedule" : "send"}
              </span>
            )}
          </div>
          <SendLaterPicker
            value={schedule}
            onChange={setSchedule}
            defaultTimeZone={defaultTimeZone}
            disabled={disabled}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-crm-primary px-3 text-sm font-medium text-crm-primary-fg shadow-crm-primary focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none disabled:opacity-40"
          >
            {status.kind === "sending" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {status.kind === "sending" ? "Sending…" : schedule ? "Schedule" : "Send"}
          </button>
        </div>
      </form>
      <SuggestionMenu bridge={fieldBridge} label="Merge fields" emptyText="No matching fields" />
      <SuggestionMenu
        bridge={snippetBridge}
        label="Snippets"
        emptyText="No matching snippets"
        renderItem={(item) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-crm-fg">{item.label}</span>
            {item.hint && <span className="truncate text-xs text-crm-subtle">{item.hint}</span>}
          </span>
        )}
      />
    </MergeContext.Provider>
  );
}
