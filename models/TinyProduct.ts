import { ITinyProduct } from "@/types/tiny";
import { model, models, Schema } from "mongoose";

const schema = new Schema<ITinyProduct>(
  {
    tinyId: { type: Number, required: true, unique: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    status: { type: String, required: true, default: "A" },
    tipo: { type: String },
    unidade: { type: String },
    stock: { type: Number, required: true, default: 0 },
    stockMin: { type: Number },
    stockMax: { type: Number },
    gtin: { type: String },
    ncm: { type: String },
  },
  { timestamps: true },
);

schema.index({ sku: 1 });

export const TinyProduct =
  models.TinyProduct || model("TinyProduct", schema);
