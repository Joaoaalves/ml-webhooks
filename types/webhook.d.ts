export interface IMlWebhookPayload {
  _id: string;
  resource: string;
  user_id: number;
  topic: string;
  application_id: number;
  attempts: number;
  sent: string;
  received: string;
}

export interface IMlWebhook {
  _id: string;
  resource: string;
  userId: number;
  topic: string;
  applicationId: number;
  attempts: number;
  sent: Date;
  received: Date;
  receivedAt: Date;
  processed: boolean;
}
