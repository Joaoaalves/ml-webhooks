import { connectDB } from "@/lib/db";
import { TinySalesBucket } from "@/models/Tiny/TinySalesBucket";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await connectDB();

  const text = await req.text();
  const lines = text.split("\n").filter((l) => l.trim());

  if (!lines.length) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  let processed = 0;
  const errors: string[] = [];

  for (const line of lines) {
    try {
      const bucket = JSON.parse(line);
      const date = new Date(String(bucket.date).replace(" ", "T"));

      await TinySalesBucket.findOneAndUpdate(
        { product: bucket.product, date },
        {
          $set: {
            product: bucket.product,
            sku: bucket.sku,
            date,
            unitPrice: bucket.unitPrice,
            total: bucket.total,
            mercadoLivre: bucket.mercadoLivre,
            mercadoLivreFulfillment: bucket.mercadoLivreFulfillment,
            shopee: bucket.shopee,
            amazon: bucket.amazon,
            tiktok: bucket.tiktok,
            magalu: bucket.magalu,
          },
        },
        { upsert: true },
      );
      processed++;
    } catch (err) {
      errors.push(String(err));
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    processed,
    errors: errors.length ? errors : undefined,
  });
}
