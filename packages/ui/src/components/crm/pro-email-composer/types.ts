import type { JSONContent } from "@tiptap/react";

/** A field that can be merged into the email, e.g. `contact.firstName`. */
export interface MergeFieldDef {
  /** Dot path into the sample record, e.g. "contact.firstName". */
  key: string;
  /** Human label shown in the picker and on the chip. */
  label: string;
  /** Picker group heading, e.g. "Contact". */
  group?: string;
  /** Default fallback used when the record has no value. */
  fallback?: string;
}

/** A reusable block of content inserted with the `/` slash menu. */
export interface EmailSnippet {
  id: string;
  title: string;
  description?: string;
  /** Tiptap JSON or HTML inserted at the cursor. May contain merge field nodes. */
  content: JSONContent[] | string;
}

/** A record used to preview merge fields (any nested object). */
export type MergeRecord = Record<string, unknown>;

export interface SampleRecord {
  id: string;
  label: string;
  data: MergeRecord;
}

export interface EmailAttachment {
  id: string;
  file: File;
}

export interface ScheduleValue {
  /** Absolute instant the email should go out. */
  sendAt: Date;
  /** IANA zone the sender picked the wall-clock time in. */
  timeZone: string;
}

export interface EmailDraft {
  to: string[];
  subject: string;
  /** Editor document with merge field nodes intact (store this as the template). */
  json: JSONContent;
  /** Template HTML with merge fields as `{{key|fallback}}` tokens. */
  templateHtml: string;
  attachments: EmailAttachment[];
  schedule: ScheduleValue | null;
}

export interface SuggestionItemBase {
  id: string;
  label: string;
  group?: string;
  hint?: string;
}
