import { IMlToken } from "@/types/mercado-livre";
import { model, models, Schema } from "mongoose";

// Singleton document — only one token is stored for the ML account.
const MlTokenSchema = new Schema<IMlToken>(
  {
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const MlToken = models.MlToken || model("MlToken", MlTokenSchema);
