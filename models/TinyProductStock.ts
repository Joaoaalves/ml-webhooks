import { ITinyProductStockDoc } from "@/types/tiny";
import { model, models, Schema } from "mongoose";

const depositSchema = new Schema(
  {
    name: { type: String, required: true },
    ignore: { type: Boolean, required: true, default: false },
    balance: { type: Number, required: true, default: 0 },
    company: { type: String, required: true },
  },
  { _id: false },
);

const schema = new Schema<ITinyProductStockDoc>(
  {
    productId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    sku: { type: String, required: true, index: true },
    unit: { type: String, required: true, default: "" },
    balance: { type: Number, required: true, default: 0 },
    reservedBalance: { type: Number, required: true, default: 0 },
    deposits: { type: [depositSchema], required: true, default: [] },
  },
  { timestamps: true },
);

export const TinyProductStock =
  models.TinyProductStock || model("TinyProductStock", schema);
