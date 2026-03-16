import { ITinyWebhookEstoqueDoc } from "@/types/tiny";
import { model, models, Schema } from "mongoose";

const schema = new Schema<ITinyWebhookEstoqueDoc>(
  {
    cnpj: { type: String, required: true },
    idEcommerce: { type: Number },
    tipoEstoque: { type: String },
    saldo: { type: Number, required: true },
    idProduto: { type: Number, required: true },
    sku: { type: String, required: true },
    skuMapeamento: { type: String },
    skuMapeamentoPai: { type: String },
    raw: { type: Schema.Types.Mixed, required: true },
    receivedAt: { type: Date, required: true, default: () => new Date() },
    processed: { type: Boolean, required: true, default: false },
  },
  { timestamps: false },
);

schema.index({ idProduto: 1, receivedAt: -1 });
schema.index({ sku: 1 });
schema.index({ processed: 1 });

export const TinyWebhookEstoque =
  models.TinyWebhookEstoque || model("TinyWebhookEstoque", schema);
