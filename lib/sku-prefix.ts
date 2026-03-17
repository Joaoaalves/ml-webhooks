/**
 * SKU prefix extraction service.
 *
 * SKU formats:
 *   Simples  →  BUB-PATIN-BANH-AM         prefix = "BUB"
 *   Kit      →  2U-BUB-PATIN-BANH-AM      type prefix stripped, then prefix = "BUB"
 *   Combo    →  COM-BUB-MOAS-XXX          type prefix stripped, then prefix = "BUB"
 *
 * The "supplier prefix" is always the FIRST segment of the SKU after the
 * optional type prefix (COM- or {n}U-).
 */

import { ProductType } from "@/types/product";

const KIT_RE = /^(\d+)U-/i;
const COMBO_RE = /^COM-/i;

export interface SkuInfo {
  productType: ProductType;
  kitQuantity?: number;
  /** First segment after stripping the type prefix, e.g. "BUB". */
  supplierPrefix: string;
  /** Remainder of the SKU after stripping type prefix + supplier prefix. */
  body: string;
}

export function parseSkuPrefix(sku: string): SkuInfo {
  // 1. Combo
  if (COMBO_RE.test(sku)) {
    const rest = sku.replace(COMBO_RE, "");
    const [supplierPrefix, ...tail] = rest.split("-");
    return { productType: "combo", supplierPrefix, body: tail.join("-") };
  }

  // 2. Kit
  const kitMatch = KIT_RE.exec(sku);
  if (kitMatch) {
    const kitQuantity = parseInt(kitMatch[1], 10);
    const rest = sku.replace(KIT_RE, "");
    const [supplierPrefix, ...tail] = rest.split("-");
    return {
      productType: "kit",
      kitQuantity,
      supplierPrefix,
      body: tail.join("-"),
    };
  }

  // 3. Simples
  const [supplierPrefix, ...tail] = sku.split("-");
  return { productType: "simples", supplierPrefix, body: tail.join("-") };
}

/** Returns only the supplier prefix string from a SKU. */
export function supplierPrefixFromSku(sku: string): string {
  return parseSkuPrefix(sku).supplierPrefix;
}
