import type { NextFunction, Request, Response } from "express";
import type { DenyReason } from "@ti/core";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
  }
}

const DENY: Record<DenyReason, HttpError> = {
  not_found: new HttpError(404, "not_found", "Component not found."),
  sign_in_required: new HttpError(
    401,
    "sign_in_required",
    "This is a premium component. Sign in with a premium account (or set KITBASE_TOKEN) to use it.",
  ),
  premium_required: new HttpError(
    403,
    "premium_required",
    "Premium access required. Ask the library admin to upgrade your account.",
  ),
};

export const denyError = (reason: DenyReason) => DENY[reason];

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "invalid_json", message: "Request body is not valid JSON." });
    return;
  }
  if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.too.large") {
    res.status(413).json({ error: "too_large", message: "Request body is too large." });
    return;
  }
  // Unknown error: log type and message only, never the request.
  console.error(JSON.stringify({ level: "error", msg: "unhandled", error: String(err) }));
  res.status(500).json({ error: "server_error", message: "Something went wrong. Try again." });
}
