import { model, models, Schema } from "mongoose";

// Each document represents one API call. TTL index removes it after 60 s,
// which gives us a simple rolling-window counter: countDocuments() = calls/min.
const schema = new Schema({
  createdAt: { type: Date, default: Date.now },
});

// MongoDB TTL: auto-deletes documents 60 seconds after createdAt
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 });

export const TinyRateLimit =
  models.TinyRateLimit || model("TinyRateLimit", schema);
