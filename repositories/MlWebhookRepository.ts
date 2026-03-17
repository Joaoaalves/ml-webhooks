import { MlWebhook } from "@/models/MercadoLivre/MlWebhook";
import { IMlWebhookPayload } from "@/types/webhook";

export const MlWebhookRepository = {
  async upsert(payload: IMlWebhookPayload) {
    return MlWebhook.findOneAndUpdate(
      { _id: payload._id },
      {
        _id: payload._id,
        resource: payload.resource,
        userId: payload.user_id,
        topic: payload.topic,
        applicationId: payload.application_id,
        attempts: payload.attempts,
        sent: new Date(payload.sent),
        received: new Date(payload.received),
        receivedAt: new Date(),
        processed: false,
      },
      { upsert: true, new: true },
    );
  },

  async markProcessed(id: string) {
    return MlWebhook.findByIdAndUpdate(id, { processed: true });
  },
};
