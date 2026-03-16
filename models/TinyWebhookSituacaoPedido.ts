import { ITinyWebhookSituacaoPedidoDoc } from "@/types/tiny";
import { model, models, Schema } from "mongoose";

const schema = new Schema<ITinyWebhookSituacaoPedidoDoc>(
  {
    cnpj: { type: String, required: true },
    idEcommerce: { type: Number },
    idPedidoEcommerce: { type: String },
    idVendaTiny: { type: Number, required: true },
    situacao: { type: String, required: true },
    descricaoSituacao: { type: String },
    raw: { type: Schema.Types.Mixed, required: true },
    receivedAt: { type: Date, required: true, default: () => new Date() },
    processed: { type: Boolean, required: true, default: false },
  },
  { timestamps: false },
);

schema.index({ idVendaTiny: 1, receivedAt: -1 });
schema.index({ processed: 1 });

export const TinyWebhookSituacaoPedido =
  models.TinyWebhookSituacaoPedido || model("TinyWebhookSituacaoPedido", schema);
