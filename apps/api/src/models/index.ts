import mongoose, { Schema, type InferSchemaType } from "mongoose";
import type { Bundle } from "@ti/core";
import { teamScopedPlugin } from "./teamScoped";

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
    /** Set = team-scoped token: only installs that team's components, never public premium. */
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);
apiTokenSchema.index({ customerId: 1, teamId: 1 });

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

// ---------------------------------------------------------------------------
// Team workspaces. Private components live in their own collection (`TeamComponent`), so
// nothing in the public catalogue, its cache or the global unique slug ever sees them.
// ---------------------------------------------------------------------------

const TEAM_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const teamSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, immutable: true, match: TEAM_SLUG },
    name: { type: String, required: true, minlength: 2, maxlength: 60 },
    createdBy: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    /** Platform admin switch: a disabled team is 404 for everyone. */
    disabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const teamMemberSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    role: { type: String, enum: ["owner", "admin", "member"], required: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "Customer" },
  },
  { timestamps: true },
);
teamMemberSchema.index({ teamId: 1, customerId: 1 }, { unique: true });
teamMemberSchema.index({ teamId: 1, role: 1 });

/** Same draft / immutable published snapshot shape as `Component`, plus the owning team. */
const teamComponentSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    slug: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "published", "unpublished"],
      default: "draft",
      required: true,
    },
    draft: { type: Schema.Types.Mixed, required: true },
    published: { type: Schema.Types.Mixed },
    publishedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "Customer" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Customer" },
  },
  { timestamps: true, minimize: false },
);
teamComponentSchema.index({ teamId: 1, slug: 1 }, { unique: true });
teamComponentSchema.index({ teamId: 1, status: 1 });
teamComponentSchema.plugin(teamScopedPlugin);

/**
 * Email invites are matched on the invitee's account email. Link invites store only the
 * sha256 of the `kbi_` token; both kinds expire after 7 days (TTL index) and work once.
 */
const teamInviteSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    kind: { type: String, enum: ["email", "link"], required: true },
    role: { type: String, enum: ["admin", "member"], required: true },
    email: { type: String, lowercase: true, trim: true },
    tokenHash: { type: String },
    prefix: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    usedAt: { type: Date },
    usedBy: { type: Schema.Types.ObjectId, ref: "Customer" },
    declinedAt: { type: Date },
    revokedAt: { type: Date },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);
teamInviteSchema.index({ tokenHash: 1 }, { unique: true, sparse: true });
teamInviteSchema.index({ email: 1, usedAt: 1 });
teamInviteSchema.index({ teamId: 1 });
teamInviteSchema.plugin(teamScopedPlugin);

/** Ownership record for a queued team upload, so `GET /jobs/:id` can be filtered by team. */
const teamJobSchema = new Schema(
  {
    _id: { type: String, required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    slug: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "Customer" },
    /** Jobs are kept for an hour, like the queue's own status. */
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);
teamJobSchema.index({ teamId: 1 });
teamJobSchema.plugin(teamScopedPlugin);

export const Customer = mongoose.model("Customer", customerSchema);
export const ApiToken = mongoose.model("ApiToken", apiTokenSchema);
export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
export const ComponentModel = mongoose.model("Component", componentSchema);
export const CaptureModel = mongoose.model("Capture", captureSchema);
export const Team = mongoose.model("Team", teamSchema);
export const TeamMember = mongoose.model("TeamMember", teamMemberSchema);
/** Only `services/teamRepo.ts` may import this (enforced by a test). */
export const TeamComponent = mongoose.model("TeamComponent", teamComponentSchema);
export const TeamInvite = mongoose.model("TeamInvite", teamInviteSchema);
export const TeamJob = mongoose.model("TeamJob", teamJobSchema);

export type CustomerDoc = InferSchemaType<typeof customerSchema> & { _id: mongoose.Types.ObjectId };
export type TeamDoc = InferSchemaType<typeof teamSchema> & { _id: mongoose.Types.ObjectId };
export type TeamMemberDoc = InferSchemaType<typeof teamMemberSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type TeamInviteDoc = InferSchemaType<typeof teamInviteSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type TeamComponentRecord = ComponentRecord & {
  _id: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
};
export type ComponentRecord = {
  slug: string;
  status: "draft" | "published" | "unpublished";
  draft: Bundle;
  published?: Bundle;
  publishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
