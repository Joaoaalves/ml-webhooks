import "@/models/Product";
import { Supplier } from "@/models/Supplier";

export class SupplierRepository {
  create(data: any) {
    return Supplier.create(data);
  }

  findAll() {
    return Supplier.find().lean();
  }

  findAllWithProductCount() {
    return Supplier.aggregate([
      {
        $lookup: {
          from: "internalproducts",
          localField: "_id",
          foreignField: "supplier",
          as: "_products",
        },
      },
      {
        $addFields: { productCount: { $size: "$_products" } },
      },
      {
        $project: { _products: 0 },
      },
      { $sort: { name: 1 } },
    ]);
  }

  update(supplierId: string, data: any) {
    return Supplier.findByIdAndUpdate(supplierId, data, {
      returnDocument: "after",
    });
  }

  delete(supplierId: string) {
    return Supplier.findByIdAndDelete(supplierId);
  }

  findByPrefix(prefix: string) {
    return Supplier.findOne({ prefix }).lean();
  }

  findByNamePartial(name: string) {
    return Supplier.findOne({
      name: { $regex: name.slice(0, 20), $options: "i" },
    }).lean();
  }
}
