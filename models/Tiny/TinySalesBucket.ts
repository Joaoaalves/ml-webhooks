import { ITinySalesBucket } from "@/types/tiny";
import { model, models, Schema } from "mongoose";

const metricsSchema = {
  items: { type: Number, required: true, default: 0 },
  revenue: { type: Number, required: true, default: 0 },
  orders: { type: Number, required: true, default: 0 },
};

const channelSchema = {
  valid: metricsSchema,
  invalid: metricsSchema,
  byStatus: { type: Schema.Types.Mixed, default: {} },
};

const emptyChannel = {
  valid: { items: 0, revenue: 0, orders: 0 },
  invalid: { items: 0, revenue: 0, orders: 0 },
  byStatus: {},
};

const schema = new Schema<ITinySalesBucket>(
  {
    date: { type: Date, required: true },
    product: { type: String, required: true },
    sku: { type: String, required: true, index: true },
    unitPrice: { type: Number, required: true },
    total: metricsSchema,
    mercadoLivre: { type: channelSchema, default: () => ({ ...emptyChannel }) },
    mercadoLivreFulfillment: { type: channelSchema, default: () => ({ ...emptyChannel }) },
    shopee: { type: channelSchema, default: () => ({ ...emptyChannel }) },
    amazon: { type: channelSchema, default: () => ({ ...emptyChannel }) },
    tiktok: { type: channelSchema, default: () => ({ ...emptyChannel }) },
    magalu: { type: channelSchema, default: () => ({ ...emptyChannel }) },
  },
  { timestamps: true },
);

schema.index({ product: 1, date: 1 }, { unique: true });
schema.index({ sku: 1, date: 1 });
schema.index({ date: 1 });

export const TinySalesBucket =
  models.TinySalesBucket || model("TinySalesBucket", schema);
