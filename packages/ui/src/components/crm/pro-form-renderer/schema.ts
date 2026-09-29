import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type { RuleGroupType, RuleType } from "react-querybuilder";
import { z } from "zod";

/* ------------------------------------------------------------------------------------------------
 * Form schema: the JSON contract shared by ProFormBuilder (writes it) and ProFormRenderer (reads it).
 * Conditional logic uses the react-querybuilder RuleGroupType format so it can be edited visually.
 * ---------------------------------------------------------------------------------------------- */

export const FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "url",
  "number",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "multiselect",
  "date",
  "rating",
  "file",
  "consent",
  "heading",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  /** JavaScript regular expression source, without slashes. */
  pattern?: string;
  patternMessage?: string;
  /** For multiselect / checkbox groups / files. */
  minItems?: number;
  maxItems?: number;
}

export interface FileSettings {
  /** MIME types or extensions, e.g. ["application/pdf", ".docx", "image/*"]. */
  accept?: string[];
  maxSizeMb?: number;
  maxFiles?: number;
}

export interface FormField {
  id: string;
  type: FieldType;
  /** Key used in the submitted values object. Unique within the form. */
  name: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  width?: "full" | "half";
  defaultValue?: unknown;
  options?: FieldOption[];
  validation?: FieldValidation;
  file?: FileSettings;
  /** Field is shown only when this rule group matches the current values. */
  logic?: RuleGroupType;
  /** Name of an async validator passed to the renderer via `asyncValidators`. */
  asyncValidator?: string;
}

export interface FormPage {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  /** Page is skipped when this rule group does not match. */
  logic?: RuleGroupType;
}

export interface FormSchema {
  $schema?: string;
  id: string;
  version: 1;
  title: string;
  description?: string;
  pages: FormPage[];
  settings?: {
    submitLabel?: string;
    showProgress?: boolean;
    successMessage?: string;
  };
}

export type FormValues = Record<string, unknown>;

/* ------------------------------------------------------------------------------------------------
 * Structural validation of a schema document (e.g. JSON pasted into the builder or fetched from an
 * API) with Ajv, before anything tries to render it.
 * ---------------------------------------------------------------------------------------------- */

const ruleGroupJson = {
  type: "object",
  required: ["combinator", "rules"],
  properties: {
    combinator: { type: "string" },
    not: { type: "boolean" },
    rules: { type: "array" },
  },
} as const;

export const FORM_JSON_SCHEMA = {
  $id: "https://kitbase.dev/schemas/pro-form.json",
  type: "object",
  required: ["id", "version", "title", "pages"],
  additionalProperties: true,
  properties: {
    id: { type: "string", minLength: 1 },
    version: { const: 1 },
    title: { type: "string" },
    description: { type: "string" },
    pages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "title", "fields"],
        properties: {
          id: { type: "string", minLength: 1 },
          title: { type: "string" },
          description: { type: "string" },
          logic: ruleGroupJson,
          fields: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "type", "name", "label"],
              properties: {
                id: { type: "string", minLength: 1 },
                type: { enum: [...FIELD_TYPES] },
                name: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" },
                label: { type: "string" },
                placeholder: { type: "string" },
                helpText: { type: "string" },
                required: { type: "boolean" },
                width: { enum: ["full", "half"] },
                asyncValidator: { type: "string" },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["label", "value"],
                    properties: { label: { type: "string" }, value: { type: "string" } },
                  },
                },
                validation: {
                  type: "object",
                  properties: {
                    minLength: { type: "integer", minimum: 0 },
                    maxLength: { type: "integer", minimum: 0 },
                    min: { type: "number" },
                    max: { type: "number" },
                    pattern: { type: "string" },
                    patternMessage: { type: "string" },
                    minItems: { type: "integer", minimum: 0 },
                    maxItems: { type: "integer", minimum: 0 },
                  },
                },
                file: {
                  type: "object",
                  properties: {
                    accept: { type: "array", items: { type: "string" } },
                    maxSizeMb: { type: "number", exclusiveMinimum: 0 },
                    maxFiles: { type: "integer", minimum: 1 },
                  },
                },
                logic: ruleGroupJson,
              },
            },
          },
        },
      },
    },
    settings: {
      type: "object",
      properties: {
        submitLabel: { type: "string" },
        showProgress: { type: "boolean" },
        successMessage: { type: "string" },
      },
    },
  },
} as const;

let compiled: ValidateFunction | null = null;
function schemaValidator(): ValidateFunction {
  if (!compiled) compiled = new Ajv({ allErrors: true, strict: false }).compile(FORM_JSON_SCHEMA);
  return compiled;
}

export type SchemaCheck = { ok: true; schema: FormSchema } | { ok: false; errors: string[] };

const formatAjv = (e: ErrorObject) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`;

/** Ajv structural check plus semantic rules JSON Schema cannot express (unique names / ids). */
export function validateFormSchema(input: unknown): SchemaCheck {
  const validate = schemaValidator();
  if (!validate(input)) return { ok: false, errors: (validate.errors ?? []).map(formatAjv) };
  const schema = input as FormSchema;
  const errors: string[] = [];
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const page of schema.pages) {
    if (ids.has(page.id)) errors.push(`duplicate id "${page.id}"`);
    ids.add(page.id);
    for (const f of page.fields) {
      if (ids.has(f.id)) errors.push(`duplicate id "${f.id}"`);
      ids.add(f.id);
      if (f.type === "heading") continue;
      if (names.has(f.name)) errors.push(`duplicate field name "${f.name}"`);
      names.add(f.name);
      if (f.validation?.pattern) {
        try {
          new RegExp(f.validation.pattern);
        } catch {
          errors.push(`field "${f.name}": invalid pattern`);
        }
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, schema };
}

/* ------------------------------------------------------------------------------------------------
 * Conditional logic evaluation. react-querybuilder ships editors and exporters but no evaluator,
 * so this small interpreter covers its default operator set over plain form values.
 * ---------------------------------------------------------------------------------------------- */

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || v === false;

const asList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String)
    : typeof v === "string"
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : v === undefined || v === null
        ? []
        : [String(v)];

function compare(a: unknown, b: unknown): number {
  const na = Number(a);
  const nb = Number(b);
  if (a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function evaluateRule(rule: RuleType, values: FormValues): boolean {
  const actual = values[rule.field];
  const expected = rule.value as unknown;
  const s = (v: unknown) => String(v ?? "").toLowerCase();
  // Multi-value fields: "=" means "includes", "!=" means "does not include".
  if (Array.isArray(actual) && (rule.operator === "=" || rule.operator === "!=")) {
    const has = actual.map(String).includes(String(expected));
    return rule.operator === "=" ? has : !has;
  }
  switch (rule.operator) {
    case "=":
      return typeof actual === "boolean"
        ? String(actual) === s(expected)
        : s(actual) === s(expected);
    case "!=":
      return typeof actual === "boolean"
        ? String(actual) !== s(expected)
        : s(actual) !== s(expected);
    case "<":
      return !isEmpty(actual) && compare(actual, expected) < 0;
    case "<=":
      return !isEmpty(actual) && compare(actual, expected) <= 0;
    case ">":
      return !isEmpty(actual) && compare(actual, expected) > 0;
    case ">=":
      return !isEmpty(actual) && compare(actual, expected) >= 0;
    case "contains":
      return s(actual).includes(s(expected));
    case "doesNotContain":
      return !s(actual).includes(s(expected));
    case "beginsWith":
      return s(actual).startsWith(s(expected));
    case "doesNotBeginWith":
      return !s(actual).startsWith(s(expected));
    case "endsWith":
      return s(actual).endsWith(s(expected));
    case "doesNotEndWith":
      return !s(actual).endsWith(s(expected));
    case "null":
      return isEmpty(actual);
    case "notNull":
      return !isEmpty(actual);
    case "in":
    case "notIn": {
      const list = asList(expected).map((x) => x.toLowerCase());
      const hit = asList(actual).some((x) => list.includes(x.toLowerCase()));
      return rule.operator === "in" ? hit : !hit;
    }
    case "between":
    case "notBetween": {
      const [lo, hi] = asList(expected);
      const inside = !isEmpty(actual) && compare(actual, lo) >= 0 && compare(actual, hi) <= 0;
      return rule.operator === "between" ? inside : !inside;
    }
    default:
      return true;
  }
}

/** True when the group matches. An absent or empty group always matches. */
export function evaluateLogic(group: RuleGroupType | undefined, values: FormValues): boolean {
  if (!group || !group.rules?.length) return true;
  const results = group.rules
    .filter((r): r is RuleType | RuleGroupType => typeof r === "object" && r !== null)
    .map((r) => ("rules" in r ? evaluateLogic(r, values) : evaluateRule(r, values)));
  if (!results.length) return true;
  const matched = group.combinator === "or" ? results.some(Boolean) : results.every(Boolean);
  return group.not ? !matched : matched;
}

/** Names of fields a logic group depends on (for cycle checks and "used by" hints). */
export function logicDependencies(group: RuleGroupType | undefined, out = new Set<string>()) {
  for (const r of group?.rules ?? []) {
    if (typeof r !== "object" || r === null) continue;
    if ("rules" in r) logicDependencies(r, out);
    else out.add(r.field);
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * Field helpers
 * ---------------------------------------------------------------------------------------------- */

export const isInputField = (f: FormField) => f.type !== "heading";
export const hasOptions = (t: FieldType) =>
  t === "select" || t === "radio" || t === "checkbox" || t === "multiselect";
export const isMultiValue = (f: FormField) =>
  f.type === "multiselect" ||
  f.type === "file" ||
  (f.type === "checkbox" && (f.options?.length ?? 0) > 0);

export function emptyValueFor(f: FormField): unknown {
  if (f.defaultValue !== undefined) return f.defaultValue;
  if (isMultiValue(f)) return [];
  if (f.type === "consent" || (f.type === "checkbox" && !f.options?.length)) return false;
  if (f.type === "rating" || f.type === "number") return undefined;
  return "";
}

export function defaultValues(schema: FormSchema): FormValues {
  const out: FormValues = {};
  for (const p of schema.pages)
    for (const f of p.fields) if (isInputField(f)) out[f.name] = emptyValueFor(f);
  return out;
}

export interface VisibleState {
  pages: FormPage[];
  hiddenFields: Set<string>;
}

/** Resolves page skipping and field show/hide for the current values in a single pass. */
export function resolveVisibility(schema: FormSchema, values: FormValues): VisibleState {
  const hiddenFields = new Set<string>();
  const pages: FormPage[] = [];
  for (const p of schema.pages) {
    const pageOn = evaluateLogic(p.logic, values);
    for (const f of p.fields) {
      if (!pageOn || !evaluateLogic(f.logic, values)) hiddenFields.add(f.name);
    }
    if (pageOn) pages.push(p);
  }
  return { pages, hiddenFields };
}

/* ------------------------------------------------------------------------------------------------
 * Zod schema generation per page. Hidden fields are skipped so they never block progress.
 * ---------------------------------------------------------------------------------------------- */

export type AsyncValidator = (value: unknown, values: FormValues) => Promise<string | null | void>;

const PHONE = /^\+?[0-9 ()\-.]{7,20}$/;

export function fileMatchesAccept(file: { name: string; type: string }, accept?: string[]) {
  if (!accept?.length) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return accept.some((a) => {
    const rule = a.trim().toLowerCase();
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

function fieldZod(f: FormField): z.ZodTypeAny {
  const v = f.validation ?? {};
  const req = !!f.required;
  const msgReq = `${f.label || "This field"} is required`;
  let schema: z.ZodTypeAny;

  switch (f.type) {
    case "number":
    case "rating": {
      let n = z.number({ invalid_type_error: "Enter a number", required_error: msgReq });
      if (v.min !== undefined) n = n.min(v.min, `Must be at least ${v.min}`);
      if (v.max !== undefined) n = n.max(v.max, `Must be at most ${v.max}`);
      schema = z.preprocess(
        (x) => (x === "" || x === null || Number.isNaN(x) ? undefined : x),
        req ? n : n.optional(),
      );
      break;
    }
    case "consent":
      schema = req ? z.literal(true, { errorMap: () => ({ message: msgReq }) }) : z.boolean();
      break;
    case "checkbox":
    case "multiselect":
    case "file": {
      if (f.type === "checkbox" && !f.options?.length) {
        schema = req ? z.literal(true, { errorMap: () => ({ message: msgReq }) }) : z.boolean();
        break;
      }
      let arr = f.type === "file" ? z.array(z.any()) : z.array(z.string());
      const min = Math.max(req ? 1 : 0, v.minItems ?? 0);
      if (min > 0) arr = arr.min(min, min === 1 ? msgReq : `Choose at least ${min}`);
      const max = f.type === "file" ? (f.file?.maxFiles ?? v.maxItems) : v.maxItems;
      if (max !== undefined) arr = arr.max(max, `Choose at most ${max}`);
      schema = arr;
      if (f.type === "file") {
        const maxBytes = (f.file?.maxSizeMb ?? 0) * 1024 * 1024;
        schema = arr.superRefine((files, ctx) => {
          for (const file of files as { name: string; size: number; type: string }[]) {
            if (maxBytes && file.size > maxBytes)
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${file.name} is larger than ${f.file?.maxSizeMb} MB`,
              });
            else if (!fileMatchesAccept(file, f.file?.accept))
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${file.name} is not an accepted file type`,
              });
          }
        });
      }
      break;
    }
    default: {
      let s = z.string({ required_error: msgReq }).trim();
      if (req) s = s.min(1, msgReq);
      if (v.minLength) s = s.min(v.minLength, `Use at least ${v.minLength} characters`);
      if (v.maxLength) s = s.max(v.maxLength, `Use at most ${v.maxLength} characters`);
      if (v.pattern) {
        try {
          s = s.regex(new RegExp(v.pattern), v.patternMessage || "Invalid format");
        } catch {
          /* invalid pattern is reported by validateFormSchema */
        }
      }
      let out: z.ZodTypeAny = s;
      if (f.type === "email") out = s.email("Enter a valid email address");
      if (f.type === "url") out = s.url("Enter a valid URL");
      if (f.type === "phone") out = s.regex(PHONE, "Enter a valid phone number");
      if (f.type === "select" || f.type === "radio") {
        const allowed = new Set((f.options ?? []).map((o) => o.value));
        out = out.refine((x: string) => !x || allowed.has(x), "Choose one of the options");
      }
      // Optional text fields accept "" even when format rules would reject it.
      schema = req ? out : z.union([z.literal(""), out]).optional();
      break;
    }
  }

  // Async validators are attached at object level (buildPageZod) so they can see sibling values.
  return schema;
}

/** Zod object for the given fields, skipping hidden ones; async validators run after sync rules. */
export function buildPageZod(
  fields: FormField[],
  hidden: Set<string>,
  asyncValidators?: Record<string, AsyncValidator>,
) {
  const shape: Record<string, z.ZodTypeAny> = {};
  const asyncFields: FormField[] = [];
  for (const f of fields) {
    if (!isInputField(f) || hidden.has(f.name)) continue;
    shape[f.name] = fieldZod(f);
    if (f.asyncValidator && asyncValidators?.[f.asyncValidator]) asyncFields.push(f);
  }
  const obj = z.object(shape).passthrough();
  if (!asyncFields.length) return obj;
  return obj.superRefine(async (values, ctx) => {
    await Promise.all(
      asyncFields.map(async (f) => {
        const value = (values as FormValues)[f.name];
        if (value === "" || value === undefined) return;
        const msg = await asyncValidators![f.asyncValidator!]?.(value, values as FormValues);
        if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [f.name], message: msg });
      }),
    );
  });
}

let seq = 0;
/** Short collision-resistant id for fields and pages. */
export function uid(prefix = "f") {
  seq = (seq + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
