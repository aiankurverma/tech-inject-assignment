import mongoose from "mongoose";
import type { Model } from "mongoose";

export type FeatureStatus = "new" | "valid" | "rejected" | "building";
export type BuildStatus = "idle" | "running" | "done" | "failed";

export interface IFeatureRequest {
  _id: mongoose.Types.ObjectId;
  term: string;
  searchCount: number;
  status: FeatureStatus;
  eta: Date | null;
  lastSearchedAt: Date;
  createdAt: Date;
  buildStatus: BuildStatus;
  buildError?: string;
  draftSlug?: string;
}

const schema = new mongoose.Schema<IFeatureRequest>({
  term: { type: String, required: true, unique: true },
  searchCount: { type: Number, required: true, default: 1 },
  status: {
    type: String,
    enum: ["new", "valid", "rejected", "building"] satisfies FeatureStatus[],
    required: true,
    default: "new" satisfies FeatureStatus,
  },
  eta: { type: Date, default: null },
  lastSearchedAt: { type: Date, required: true, default: () => new Date() },
  createdAt: { type: Date, required: true, default: () => new Date() },
  buildStatus: {
    type: String,
    enum: ["idle", "running", "done", "failed"] satisfies BuildStatus[],
    default: "idle" satisfies BuildStatus,
  },
  buildError: { type: String },
  draftSlug: { type: String },
});

// Avoid model recompilation in hot-reload environments
export const FeatureRequest: Model<IFeatureRequest> =
  (mongoose.models["FeatureRequest"] as Model<IFeatureRequest> | undefined) ??
  mongoose.model<IFeatureRequest>("FeatureRequest", schema, "feature_requests");
