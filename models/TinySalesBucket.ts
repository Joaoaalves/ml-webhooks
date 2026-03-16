import { ITinySalesBucket } from "@/types/tiny";
import { model, models, Schema } from "mongoose";

const schema = new Schema<ITinySalesBucket>(
  {
    date: { type: Date, required: true },
    product: { type: String, required: true },
    sku: { type: String, required: true, index: true },
    unitPrice: { type: Number, required: true },
    total: {
      items: { type: Number, required: true, default: 0 },
      revenue: { type: Number, required: true, default: 0 },
      orders: { type: Number, required: true, default: 0 },
    },
  },
  { timestamps: true },
);

schema.index({ product: 1, date: 1 }, { unique: true });
schema.index({ sku: 1, date: 1 });
schema.index({ date: 1 });

export const TinySalesBucket =
  models.TinySalesBucket || model("TinySalesBucket", schema);
