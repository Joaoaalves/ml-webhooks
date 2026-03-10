import { model, models, Schema } from "mongoose";

// Tracks individual ML orders that have been counted in SalesBucket.
// Needed to correctly reverse a sale when a refund (estorno) arrives.
export interface IMlOrder {
  orderId: string;
  itemId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  logisticType: string;
  saleDate: Date; // truncated to day — used as SalesBucket key
  counted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const MlOrderSchema = new Schema<IMlOrder>(
  {
    orderId: { type: String, required: true, unique: true },
    itemId: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    logisticType: { type: String, required: true, default: "self-service" },
    saleDate: { type: Date, required: true },
    counted: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

MlOrderSchema.index({ itemId: 1 });
MlOrderSchema.index({ sku: 1, saleDate: 1 });

export const MlOrder = models.MlOrder || model("MlOrder", MlOrderSchema);
