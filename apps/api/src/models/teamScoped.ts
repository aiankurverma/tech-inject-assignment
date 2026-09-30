import type { Query, Schema } from "mongoose";

const GUARDED = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "countDocuments",
  "replaceOne",
] as const;

/**
 * Safety net for team-private collections: every query must carry a `teamId` filter.
 * The routes always add it through `teamScope()`; this hook turns a forgotten filter into
 * a thrown error instead of a cross-tenant leak.
 */
export function teamScopedPlugin(schema: Schema) {
  for (const op of GUARDED) {
    // Mongoose types each op separately; the hook body is the same for all of them.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (schema as any).pre(op, function (this: Query<unknown, unknown>) {
      const filter = this.getFilter() as Record<string, unknown>;
      if (filter.teamId === undefined || filter.teamId === null) {
        throw new Error("unscoped team query");
      }
    });
  }
}
