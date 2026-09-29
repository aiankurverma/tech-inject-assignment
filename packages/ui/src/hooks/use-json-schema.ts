import * as React from "react";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";

export interface SchemaIssue {
  /** JSON pointer of the offending value ("" = root). */
  pointer: string;
  message: string;
  keyword: string;
}

export interface SchemaValidation {
  ok: boolean;
  issues: SchemaIssue[];
  byPointer: ReadonlyMap<string, SchemaIssue[]>;
  /** Set when the schema itself does not compile. */
  schemaError: string | null;
  validate: (value: unknown) => SchemaIssue[];
}

const EMPTY: SchemaIssue[] = [];

function toIssues(errors: ErrorObject[] | null | undefined): SchemaIssue[] {
  if (!errors?.length) return EMPTY;
  return errors.map((e) => {
    // "required" errors point at the parent; attach them to the missing child for clarity.
    const missing =
      e.keyword === "required"
        ? (e.params as { missingProperty?: string }).missingProperty
        : undefined;
    return {
      pointer: e.instancePath,
      keyword: e.keyword,
      message: missing ? `missing required property "${missing}"` : (e.message ?? e.keyword),
    };
  });
}

/** Compiles a JSON Schema once with ajv (allErrors) and validates the current document. */
export function useJsonSchema(schema: object | undefined, value: unknown): SchemaValidation {
  const compiled = React.useMemo<{ fn: ValidateFunction | null; error: string | null }>(() => {
    if (!schema) return { fn: null, error: null };
    try {
      const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
      return { fn: ajv.compile(schema), error: null };
    } catch (err) {
      return { fn: null, error: (err as Error).message };
    }
  }, [schema]);

  const validate = React.useCallback(
    (v: unknown) => {
      if (!compiled.fn) return EMPTY;
      return compiled.fn(v) ? EMPTY : toIssues(compiled.fn.errors);
    },
    [compiled],
  );

  const deferred = React.useDeferredValue(value);
  const issues = React.useMemo(() => validate(deferred), [validate, deferred]);
  const byPointer = React.useMemo(() => {
    const m = new Map<string, SchemaIssue[]>();
    for (const i of issues) m.set(i.pointer, [...(m.get(i.pointer) ?? []), i]);
    return m;
  }, [issues]);

  return { ok: issues.length === 0, issues, byPointer, schemaError: compiled.error, validate };
}
