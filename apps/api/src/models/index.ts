import mongoose, { Schema, type InferSchemaType } from "mongoose";
import type { Bundle } from "@ti/core";

const customerSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    plan: { type: String, enum: ["free", "premium"], default: "free", required: true },
    /** Set by the admin on the Privileges page; a disabled customer cannot sign in or use tokens. */
    disabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const apiTokenSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    name: { type: String, required: true },
    /** sha256 of the token; the plain token is shown once and never stored. */
    hash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

/**
 * Long-lived refresh tokens (sha256 only). Each use replaces the token with a new one in the
 * same `family`; presenting an already-used token revokes the whole family (theft detection).
 */
const refreshTokenSchema = new Schema(
  {
    hash: { type: String, required: true, unique: true },
    audience: { type: String, enum: ["customer", "admin"], required: true },
    /** Customer id, or "admin". */
    subject: { type: String, required: true },
    family: { type: String, required: true, index: true },
    usedAt: { type: Date },
    revokedAt: { type: Date },
    /** MongoDB removes the document after this date (TTL index). */
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

/**
 * `draft` is what the admin edits. `published` is an immutable snapshot copied on publish;
 * preview, copy code, installer and agent prompt all read this same snapshot.
 */
const componentSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["draft", "published", "unpublished"],
      default: "draft",
      required: true,
    },
    draft: { type: Schema.Types.Mixed, required: true },
    published: { type: Schema.Types.Mixed },
    publishedAt: { type: Date },
  },
  { timestamps: true, minimize: false },
);

/**
 * Capture Engine run: a public URL analysed into design tokens + a component inventory.
 * `themeCss` is the saved Theme draft (crm-theme.css variables) once generated.
 */
const captureSchema = new Schema(
  {
    url: { type: String, required: true },
    finalUrl: { type: String },
    title: { type: String },
    status: {
      type: String,
      enum: ["queued", "running", "done", "failed"],
      default: "queued",
      required: true,
      index: true,
    },
    tokens: { type: Schema.Types.Mixed },
    inventory: { type: Schema.Types.Mixed },
    screenshot: { type: String },
    themeCss: { type: String },
    error: { type: String },
    finishedAt: { type: Date },
  },
  { timestamps: true, minimize: false },
);

export const Customer = mongoose.model("Customer", customerSchema);
export const ApiToken = mongoose.model("ApiToken", apiTokenSchema);
export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
export const ComponentModel = mongoose.model("Component", componentSchema);
export const CaptureModel = mongoose.model("Capture", captureSchema);

export type CustomerDoc = InferSchemaType<typeof customerSchema> & { _id: mongoose.Types.ObjectId };
export type ComponentRecord = {
  slug: string;
  status: "draft" | "published" | "unpublished";
  draft: Bundle;
  published?: Bundle;
  publishedAt?: Date;
  updatedAt?: Date;
};
