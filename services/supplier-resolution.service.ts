import { supplierPrefixFromSku } from "@/lib/sku-prefix";
import { SupplierRepository } from "@/repositories/SupplierRepository";

/**
 * Resolves a supplier ID from different signals, in priority order:
 *   1. SKU prefix  (e.g. "BUB" from "BUB-PATIN-BANH-AM")
 *   2. Supplier name (partial match)
 *
 * Used by both the CSV import route and the Tiny ERP ingest service.
 */
export class SupplierResolutionService {
  constructor(private readonly suppliers = new SupplierRepository()) {}

  async resolveBySkuPrefix(sku: string): Promise<string | undefined> {
    const prefix = supplierPrefixFromSku(sku).toUpperCase();
    const doc = await this.suppliers.findByPrefix(prefix);
    return doc ? (doc as any)._id.toString() : undefined;
  }

  async resolveByName(name: string | undefined): Promise<string | undefined> {
    if (!name?.trim()) return undefined;
    const doc = await this.suppliers.findByNamePartial(name.trim());
    return doc ? (doc as any)._id.toString() : undefined;
  }

  /** Tries SKU prefix first, then falls back to name matching. */
  async resolve(sku: string, name?: string): Promise<string | undefined> {
    return (
      (await this.resolveBySkuPrefix(sku)) ?? (await this.resolveByName(name))
    );
  }
}
