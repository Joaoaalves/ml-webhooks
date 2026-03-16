import { ITinyWebhookVendaDoc } from "@/types/tiny";
import { model, models, Schema } from "mongoose";

const schema = new Schema<ITinyWebhookVendaDoc>(
  {
    cnpj: { type: String, required: true },
    tipo: { type: String, required: true },
    orderId: { type: Number, required: true },
    orderNumber: { type: Number, required: true },
    date: { type: String, required: true },
    codigoSituacao: { type: String, required: true },
    idContato: { type: Number },
    raw: { type: Schema.Types.Mixed, required: true },
    receivedAt: { type: Date, required: true, default: () => new Date() },
    processed: { type: Boolean, required: true, default: false },
  },
  { timestamps: false },
);

schema.index({ orderId: 1, tipo: 1 });
schema.index({ receivedAt: -1 });
schema.index({ processed: 1 });

export const TinyWebhookVenda =
  models.TinyWebhookVenda || model("TinyWebhookVenda", schema);
