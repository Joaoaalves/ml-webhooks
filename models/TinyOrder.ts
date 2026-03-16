import { ITinyOrder } from "@/types/tiny";
import { model, models, Schema } from "mongoose";

const schema = new Schema<ITinyOrder>(
  {
    orderId: { type: String, required: true, unique: true },
    itemId: { type: String, required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    saleDate: { type: Date, required: true },
    counted: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

schema.index({ itemId: 1, saleDate: 1 });
schema.index({ counted: 1 });

export const TinyOrder =
  models.TinyOrder || model("TinyOrder", schema);
