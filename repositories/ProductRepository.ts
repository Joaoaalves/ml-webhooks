import "@/models/Supplier";
import { Product } from "@/models/Product";
import { IProduct } from "@/types/product";

// ─── Calculated fields ────────────────────────────────────────────────────────

function withCalculatedFields<T extends Partial<IProduct>>(product: T): T {
  // Combo: price = sum of (component priceWithTaxes × quantity)
  if (product.productType === "combo" && Array.isArray(product.components)) {
    const priceWithTaxes = product.components.reduce((sum, c) => {
      const comp = withCalculatedFields(c.product as Partial<IProduct>);
      return sum + (comp.priceWithTaxes ?? 0) * c.quantity;
    }, 0);
    return { ...product, priceWithTaxes };
  }

  // Simples + Kit: tax calculation from tablePrice
  const { tablePrice, icms = 0, ipi = 0, difal = 0, unitsPerBox } = product;
  if (tablePrice == null) return product;
  const priceWithTaxes = tablePrice * (1 + (icms + ipi + difal) / 100);
  const unitPrice = unitsPerBox ? priceWithTaxes / unitsPerBox : undefined;
  return { ...product, priceWithTaxes, unitPrice };
}

/** Maps form's supplierId field → Mongoose's supplier field. */
function mapSupplier(data: any) {
  const { supplierId, ...rest } = data;
  return supplierId ? { ...rest, supplier: supplierId } : rest;
}

export class ProductRepository {
  create(data: any) {
    return Product.create(mapSupplier(data));
  }

  async findAll(populate: boolean = true) {
    if (!populate) return Product.find().lean();

    const docs = await Product.find()
      .populate("supplier")
      .populate("parentProduct")
      .populate({ path: "components.product", populate: { path: "supplier" } })
      .lean();

    return docs.map(withCalculatedFields);
  }

  update(prodId: string, data: any) {
    return Product.findByIdAndUpdate(prodId, mapSupplier(data), {
      returnDocument: "after",
    });
  }

  delete(prodId: string) {
    return Product.findByIdAndDelete(prodId);
  }

  findByTinyId(tinyId: string) {
    return Product.findOne({ tinyId }).lean();
  }

  upsertBySku(baseSku: string, data: Record<string, unknown>) {
    return Product.findOneAndUpdate(
      { baseSku },
      { $set: data },
      { upsert: true, returnDocument: "after" },
    );
  }

  bulkCreate(data: any[]) {
    if (!data.length) return Promise.resolve([]);
    return Product.insertMany(data.map(mapSupplier), { ordered: false });
  }

  updateStock(
    lines: { sku: string; storage: number; incoming: number; damage: number }[],
  ) {
    if (!lines.length) return;

    return Product.bulkWrite(
      lines.map(({ sku, storage, incoming, damage }) => ({
        updateOne: {
          filter: { baseSku: sku },
          update: {
            $set: {
              "stock.storage": Math.max(0, storage),
              "stock.incoming": Math.max(0, incoming),
              "stock.damage": Math.max(0, damage),
            },
          },
        },
      })),
      { ordered: false },
    );
  }
}
