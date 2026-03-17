import { IMlWebhook } from "@/types/webhook";
import { model, models, Schema } from "mongoose";

const MlWebhookSchema = new Schema<IMlWebhook>(
  {
    _id: { type: String },
    resource: { type: String, required: true },
    userId: { type: Number, required: true },
    topic: { type: String, required: true },
    applicationId: { type: Number },
    attempts: { type: Number, default: 1 },
    sent: { type: Date },
    received: { type: Date },
    receivedAt: { type: Date, required: true, default: () => new Date() },
    processed: { type: Boolean, default: false },
  },
  { _id: false },
);

MlWebhookSchema.index({ topic: 1, receivedAt: -1 });
MlWebhookSchema.index({ processed: 1 });

export const MlWebhook =
  models.MlWebhook || model("MlWebhook", MlWebhookSchema);
