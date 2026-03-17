import { ISupplier } from "@/types/supplier";
import { model, models, Schema } from "mongoose";

export const SupplierSchema = new Schema<ISupplier>({
  name: { type: String, required: true },

  prefix: {
    type: String,
    uppercase: true,
    trim: true,
    sparse: true,
    unique: true,
  },

  leadTimeDays: { type: Number, required: true },

  safetyDays: { type: Number, default: 0 },

  active: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
});

export const Supplier = models.Supplier || model("Supplier", SupplierSchema);
