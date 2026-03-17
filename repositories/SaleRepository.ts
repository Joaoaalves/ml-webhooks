import { Sales } from "@/models/Sale";

export class SaleRepository {
  async upsertMany(docs: any[]) {
    if (!docs.length) return;

    return Sales.bulkWrite(
      docs.map((doc) => {
        const normalizedDate = new Date(doc.date);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        return {
          updateOne: {
            filter: {
              product: doc.product,
              date: normalizedDate,
            },
            update: {
              $set: {
                sku: doc.sku,
                unitPrice: doc.unitPrice,
                total: doc.total,
                mercadoLivre: doc.mercadoLivre,
                mercadoLivreFulfillment: doc.mercadoLivreFulfillment,
                shopee: doc.shopee,
                amazon: doc.amazon,
                tiktok: doc.tiktok,
                magalu: doc.magalu,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }

  incrementBucket(
    product: string,
    date: Date,
    sku: string,
    unitPrice: number,
    inc: Record<string, number>,
  ) {
    return Sales.findOneAndUpdate(
      { product, date },
      {
        $setOnInsert: { product, sku, date, unitPrice },
        $inc: inc,
      },
      { upsert: true, new: true },
    );
  }

  decrementBucket(product: string, date: Date, inc: Record<string, number>) {
    return Sales.findOneAndUpdate({ product, date }, { $inc: inc });
  }
}
