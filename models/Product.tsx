import { IProduct } from "@/types/product";
import { model, models, Schema } from "mongoose";

const ProductSchema = new Schema<IProduct>({
    productType: {
        type: String,
        enum: ["simples", "kit", "combo"],
        default: "simples",
    },

    // Informações básicas
    baseSku: { type: String, required: true, unique: true },
    tinyId: { type: String, sparse: true },
    name: { type: String, required: true },
    imageUrl: { type: String },
    manufacturerCode: { type: String },
    ncm: { type: String, match: /^\d{8}$/ },
    unitsPerBox: { type: Number },

    supplier: { type: Schema.Types.ObjectId, ref: "Supplier" },

    // Preços e impostos
    tablePrice: { type: Number },
    unitPrice: { type: Number },
    cost: { type: Number, default: 0 },
    icms: { type: Number, default: 0 },
    ipi: { type: Number, default: 0 },
    difal: { type: Number, default: 0 },
    storageCost: { type: Number, default: 0 },

    // Dimensões e peso
    lengthCm: { type: Number },
    widthCm: { type: Number },
    heightCm: { type: Number },
    volumeM3: { type: Number },
    weightKg: { type: Number },
    chargeableWeightKg: { type: Number },

    minStockDays: { type: Number, default: 30 },

    // Kit
    kitQuantity: { type: Number },
    parentProduct: { type: Schema.Types.ObjectId, ref: "InternalProduct" },

    // Combo
    components: [
        {
            product: {
                type: Schema.Types.ObjectId,
                ref: "InternalProduct",
                required: true,
            },
            quantity: { type: Number, default: 1, required: true },
        },
    ],

    stock: {
        storage: { type: Number, default: 0 },
        incoming: { type: Number, default: 0 },
        damage: { type: Number, default: 0 },
    },

    createdAt: { type: Date, default: Date.now },
});

ProductSchema.index({ baseSku: 1 });

export const Product =
    models.Product || model("Product", ProductSchema);
