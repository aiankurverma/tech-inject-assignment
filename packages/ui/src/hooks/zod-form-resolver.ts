import type { FieldError, FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * Minimal react-hook-form resolver for zod schemas. Equivalent to `zodResolver` from
 * @hookform/resolvers, inlined because only package roots are allow-listed for previews and the
 * zod adapter lives on a sub-path. Maps the first zod issue per path to a nested field error.
 */
export function zodFormResolver<T extends FieldValues>(schema: ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length ? issue.path.map(String) : ["root"];
      let node = errors;
      for (let i = 0; i < path.length - 1; i++) {
        const k = path[i]!;
        if (typeof node[k] !== "object" || node[k] === null) node[k] = {};
        node = node[k] as Record<string, unknown>;
      }
      const leaf = path[path.length - 1]!;
      if (!node[leaf]) {
        const err: FieldError = { type: issue.code, message: issue.message };
        node[leaf] = err;
      }
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}
