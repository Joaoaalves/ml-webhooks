import { IMlProduct } from "@/types/mercado-livre";
import { model, models, Schema } from "mongoose";

const MlProductSchema = new Schema<IMlProduct>({
  productId: {
    type: String,
    required: true,
    unique: true,
  },
  sku: String,
  unitsPerPack: Number,
  name: String,
  image: String,
  link: String,
  price: Number,
  catalogListing: Boolean,
  inventoryId: String,
  logisticType: String,
  itemRelation: String,
  dateCreated: Date,
  stock: {
    full: { type: Number, default: 0 },
    flex: { type: Number, default: 0 },
  },
  status: {
    type: String,
    required: true,
    default: "active",
  },
});

MlProductSchema.index({ sku: 1 });
MlProductSchema.index({ itemRelation: 1 });

export const MlProduct =
  models.MlProduct || model("MlProduct", MlProductSchema);
