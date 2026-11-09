/**
 * Demand-driven component pipeline.
 *
 * A signal is anonymous search/request/impression evidence. Opportunities are clustered
 * signals. Drafts, quality reports and approvals are separate records so nothing can jump
 * from "someone searched for this" to "published page" without passing every gate.
 */
import mongoose from "mongoose";
import type { Model } from "mongoose";

export type DemandSource = "site_search" | "request_board" | "search_console_import" | "manual";
export type SignalStatus = "new" | "reviewing" | "covered" | "ignored" | "building" | "live";
export type RequestStatus =
  "requested" | "building" | "in_review" | "live" | "rejected" | "duplicate";
export type OpportunityDecision = "pending" | "build" | "improve" | "ignore";
export type OpportunityStatus =
  "open" | "approved" | "drafting" | "review" | "approved_to_publish" | "published" | "rejected";
export type CheckStatus = "pass" | "fail" | "manual";

export interface DemandSignalDoc {
  _id: mongoose.Types.ObjectId;
  source: DemandSource;
  query: string;
  normalizedQuery: string;
  count: number;
  impressions: number;
  clicks: number;
  zeroResultCount: number;
  clickedCount: number;
  upvotes: number;
  firstSeen: Date;
  lastSeen: Date;
  matchedComponentSlug?: string | null;
  status: SignalStatus;
  createdAt: Date;
  updatedAt: Date;
}

const demandSignalSchema = new mongoose.Schema<DemandSignalDoc>(
  {
    source: {
      type: String,
      enum: ["site_search", "request_board", "search_console_import", "manual"],
      required: true,
      index: true,
    },
    query: { type: String, required: true, maxlength: 200 },
    normalizedQuery: { type: String, required: true, maxlength: 200 },
    count: { type: Number, default: 1, min: 0 },
    impressions: { type: Number, default: 0, min: 0 },
    clicks: { type: Number, default: 0, min: 0 },
    zeroResultCount: { type: Number, default: 0, min: 0 },
    clickedCount: { type: Number, default: 0, min: 0 },
    upvotes: { type: Number, default: 0, min: 0 },
    firstSeen: { type: Date, required: true, default: () => new Date() },
    lastSeen: { type: Date, required: true, default: () => new Date() },
    matchedComponentSlug: { type: String, default: null },
    status: {
      type: String,
      enum: ["new", "reviewing", "covered", "ignored", "building", "live"],
      default: "new",
      index: true,
    },
  },
  { timestamps: true },
);
demandSignalSchema.index({ source: 1, normalizedQuery: 1 }, { unique: true });
demandSignalSchema.index({ normalizedQuery: 1 });

export interface ComponentRequestDoc {
  _id: mongoose.Types.ObjectId;
  title: string;
  normalizedTitle: string;
  description: string;
  useCase: string;
  status: RequestStatus;
  votes: number;
  requesterId?: mongoose.Types.ObjectId | null;
  /** Public credit is opt-in. Never expose an email or a name without consent. */
  creditName?: string | null;
  creditOptIn: boolean;
  notifyOptIn: boolean;
  componentSlug?: string | null;
  opportunityId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const componentRequestSchema = new mongoose.Schema<ComponentRequestDoc>(
  {
    title: { type: String, required: true, maxlength: 80 },
    normalizedTitle: { type: String, required: true, maxlength: 80 },
    description: { type: String, required: true, maxlength: 600 },
    useCase: { type: String, default: "", maxlength: 400 },
    status: {
      type: String,
      enum: ["requested", "building", "in_review", "live", "rejected", "duplicate"],
      default: "requested",
      index: true,
    },
    votes: { type: Number, default: 0, min: 0 },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    creditName: { type: String, default: null, maxlength: 60 },
    creditOptIn: { type: Boolean, default: false },
    notifyOptIn: { type: Boolean, default: false },
    componentSlug: { type: String, default: null },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DemandOpportunity",
      default: null,
    },
  },
  { timestamps: true },
);
componentRequestSchema.index({ normalizedTitle: 1 });
componentRequestSchema.index({ status: 1, votes: -1 });

export interface RequestVoteDoc {
  _id: mongoose.Types.ObjectId;
  requestId: mongoose.Types.ObjectId;
  /** SHA-256 of a client-generated token or the signed-in customer id. Never the raw token. */
  voterHash: string;
  createdAt: Date;
}

const requestVoteSchema = new mongoose.Schema<RequestVoteDoc>(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "ComponentRequest", required: true },
    voterHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
requestVoteSchema.index({ requestId: 1, voterHash: 1 }, { unique: true });

export interface OpportunityDoc {
  _id: mongoose.Types.ObjectId;
  clusterKey: string;
  canonicalQuery: string;
  memberQueries: string[];
  demandScore: number;
  evidence: {
    searches: number;
    upvotes: number;
    impressions: number;
    clicks: number;
    zeroResultRate: number;
  };
  decision: OpportunityDecision;
  reasons: string[];
  status: OpportunityStatus;
  requestId?: mongoose.Types.ObjectId | null;
  featureRequestId?: mongoose.Types.ObjectId | null;
  draftSlug?: string | null;
  qualityReportId?: mongoose.Types.ObjectId | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const opportunitySchema = new mongoose.Schema<OpportunityDoc>(
  {
    clusterKey: { type: String, required: true, unique: true },
    canonicalQuery: { type: String, required: true },
    memberQueries: { type: [String], default: [] },
    demandScore: { type: Number, default: 0 },
    evidence: {
      searches: { type: Number, default: 0 },
      upvotes: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      zeroResultRate: { type: Number, default: 0 },
    },
    decision: {
      type: String,
      enum: ["pending", "build", "improve", "ignore"],
      default: "pending",
      index: true,
    },
    reasons: { type: [String], default: [] },
    status: {
      type: String,
      enum: [
        "open",
        "approved",
        "drafting",
        "review",
        "approved_to_publish",
        "published",
        "rejected",
      ],
      default: "open",
      index: true,
    },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "ComponentRequest", default: null },
    featureRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeatureRequest",
      default: null,
    },
    draftSlug: { type: String, default: null },
    qualityReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QualityReport",
      default: null,
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
opportunitySchema.index({ status: 1, demandScore: -1 });

export interface QualityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface QualityReportDoc {
  _id: mongoose.Types.ObjectId;
  draftSlug: string;
  checks: QualityCheck[];
  passed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const qualityReportSchema = new mongoose.Schema<QualityReportDoc>(
  {
    draftSlug: { type: String, required: true, index: true },
    checks: {
      type: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true },
          status: { type: String, enum: ["pass", "fail", "manual"], required: true },
          detail: { type: String, default: "" },
        },
      ],
      default: [],
    },
    passed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export interface DemandSettingsDoc {
  _id: string;
  killSwitch: boolean;
  autoBuild: boolean;
  autoPublish: boolean;
  buildThreshold: number;
  voteThreshold: number;
  maxPublishPerDay: number;
  publishedDay: string;
  publishedToday: number;
  updatedAt: Date;
}

const demandSettingsSchema = new mongoose.Schema<DemandSettingsDoc>(
  {
    _id: { type: String, default: "global" },
    killSwitch: { type: Boolean, default: false },
    autoBuild: { type: Boolean, default: false },
    autoPublish: { type: Boolean, default: false },
    buildThreshold: { type: Number, default: 5, min: 1 },
    voteThreshold: { type: Number, default: 3, min: 1 },
    maxPublishPerDay: { type: Number, default: 10, min: 1, max: 100 },
    publishedDay: { type: String, default: "" },
    publishedToday: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export interface AuditDoc {
  _id: mongoose.Types.ObjectId;
  action: string;
  actor: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: Date;
}

const auditSchema = new mongoose.Schema<AuditDoc>(
  {
    action: { type: String, required: true, index: true },
    actor: { type: String, required: true },
    target: { type: String, required: true },
    detail: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ createdAt: -1 });

export interface NotificationDoc {
  _id: mongoose.Types.ObjectId;
  requestId: mongoose.Types.ObjectId;
  email: string;
  componentSlug: string;
  status: "pending" | "sent" | "skipped";
  createdAt: Date;
}

const notificationSchema = new mongoose.Schema<NotificationDoc>(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "ComponentRequest", required: true },
    email: { type: String, required: true },
    componentSlug: { type: String, required: true },
    status: { type: String, enum: ["pending", "sent", "skipped"], default: "pending" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
// Publishing twice must not queue the same "it shipped" email twice.
notificationSchema.index({ requestId: 1, componentSlug: 1 }, { unique: true });

/**
 * Reuse an existing model during hot reload. The cast keeps mongoose's generic `model<T>()`
 * from expanding `Model<T>` deeply enough to exhaust the TypeScript heap; the schema generic
 * above still gives us typed documents.
 */
const model = <T>(name: string, schema: mongoose.Schema): Model<T> =>
  (mongoose.models[name] as unknown as Model<T> | undefined) ??
  (mongoose.model(name, schema) as unknown as Model<T>);

export const DemandSignal = model<DemandSignalDoc>("DemandSignal", demandSignalSchema);
export const ComponentRequest = model<ComponentRequestDoc>(
  "ComponentRequest",
  componentRequestSchema,
);
export const RequestVote = model<RequestVoteDoc>("RequestVote", requestVoteSchema);
export const DemandOpportunity = model<OpportunityDoc>("DemandOpportunity", opportunitySchema);
export const QualityReport = model<QualityReportDoc>("QualityReport", qualityReportSchema);
export const DemandSettings = model<DemandSettingsDoc>("DemandSettings", demandSettingsSchema);
export const DemandAudit = model<AuditDoc>("DemandAudit", auditSchema);
export const DemandNotification = model<NotificationDoc>("DemandNotification", notificationSchema);
