import { ISaleBucket } from "@/types/sales";
import { model, models, Schema } from "mongoose";

const SaleBucketSchema = new Schema<ISaleBucket>(
  {
    date: {
      type: Date,
      required: true,
    },

    product: {
      type: String,
      required: true,
    },

    sku: {
      type: String,
      required: true,
      index: true,
    },

    unitPrice: {
      type: Number,
      required: true,
    },

    total: {
      items: {
        type: Number,
        required: true,
        default: 0,
      },
      revenue: {
        type: Number,
        required: true,
        default: 0,
      },
      orders: {
        type: Number,
        required: true,
        default: 0,
      },
    },

    fulfillment: {
      items: {
        type: Number,
        required: true,
        default: 0,
      },
      revenue: {
        type: Number,
        required: true,
        default: 0,
      },
      orders: {
        type: Number,
        required: true,
        default: 0,
      },
    },

    flex: {
      items: {
        type: Number,
        required: true,
        default: 0,
      },
      revenue: {
        type: Number,
        required: true,
        default: 0,
      },
      orders: {
        type: Number,
        required: true,
        default: 0,
      },
    },

    dropOff: {
      items: {
        type: Number,
        required: true,
        default: 0,
      },
      revenue: {
        type: Number,
        required: true,
        default: 0,
      },
      orders: {
        type: Number,
        required: true,
        default: 0,
      },
    },
  },
  { timestamps: true },
);

SaleBucketSchema.index({ product: 1, date: 1 }, { unique: true });
SaleBucketSchema.index({ sku: 1, date: 1 });
SaleBucketSchema.index({ date: 1 });
SaleBucketSchema.index({ product: 1 });

export const SalesBucket =
  models.SalesBucket || model("SalesBucket", SaleBucketSchema);
