import { z } from "zod";
import { ProductRepository } from "@/repositories/ProductRepository";
import { SupplierRepository } from "@/repositories/SupplierRepository";
import { SupplierResolutionService } from "@/services/supplier-resolution.service";
import { ProductType } from "@/types/product";

// ─── Tiny schema ─────────────────────────────────────────────────────────────

const tinyProductSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  codigo: z.string().min(1),
  nome: z.string().min(1),
  ncm: z.string().optional().default(""),
  preco: z.coerce.number().optional(),
  preco_custo: z.coerce.number().default(0),
  valor_ipi_fixo: z.coerce.number().optional(),
  peso_liquido: z.coerce.number().optional(),
  peso_bruto: z.coerce.number().optional(),
  alturaEmbalagem: z.coerce.number().optional(),
  comprimentoEmbalagem: z.coerce.number().optional(),
  larguraEmbalagem: z.coerce.number().optional(),
  unidade_por_caixa: z.coerce.number().optional(),
  estoque_minimo: z.coerce.number().optional(),
  nome_fornecedor: z.string().optional(),
  codigo_pelo_fornecedor: z.string().optional(),
  marca: z.string().optional(),
  unidade: z.enum(["UN", "KIT", "CB"]).optional(),
  classe_produto: z.enum(["S", "K", "V"]).optional(),
  situacao: z.enum(["A", "I"]).optional(),
  kit: z
    .array(
      z.object({
        item: z.object({
          id_produto: z.union([z.string(), z.number()]).transform(String),
          quantidade: z.coerce.number().default(1),
        }),
      }),
    )
    .optional()
    .default([]),
  anexos: z
    .array(z.object({ anexo: z.string().url() }))
    .optional()
    .default([]),
});

const tinyBodySchema = z.object({
  retorno: z.object({
    status: z.literal("OK"),
    produto: tinyProductSchema,
  }),
});

export type TinyBody = z.infer<typeof tinyBodySchema>;
export type TinyProduct = z.infer<typeof tinyProductSchema>;

// ─── Validation ───────────────────────────────────────────────────────────────

export function parseTinyBodies(raw: unknown): {
  items: TinyProduct[];
  errors: { index: number; details: z.ZodFormattedError<TinyProduct> }[];
} {
  const payloads = Array.isArray(raw) ? raw : [raw];
  const items: TinyProduct[] = [];
  const errors: { index: number; details: z.ZodFormattedError<TinyProduct> }[] =
    [];

  for (let i = 0; i < payloads.length; i++) {
    // Webhook format: { retorno: { status: "OK", produto: {...} } }
    const webhook = tinyBodySchema.safeParse(payloads[i]);
    if (webhook.success) {
      items.push(webhook.data.retorno.produto);
      continue;
    }

    // JSONL / raw product format: { id, nome, codigo, ... }
    const raw = tinyProductSchema.safeParse(payloads[i]);
    if (raw.success) {
      if (raw.data.situacao === "A") items.push(raw.data);
      continue;
    }

    errors.push({ index: i, details: raw.error.format() });
  }

  return { items, errors };
}

// ─── Service ─────────────────────────────────────────────────────────────────

function ncmClean(raw: string): string {
  return raw.replace(/[.\s]/g, "");
}

export class ProductIngestService {
  private readonly products = new ProductRepository();
  private readonly suppliers = new SupplierRepository();
  private readonly supplierResolver = new SupplierResolutionService(
    this.suppliers,
  );

  private async resolveSupplier(
    sku: string,
    nomeFornecedor?: string,
    marca?: string,
  ): Promise<string | undefined> {
    return (
      (await this.supplierResolver.resolve(sku, nomeFornecedor)) ??
      (await this.supplierResolver.resolveByName(marca))
    );
  }

  private resolveType(p: TinyProduct): ProductType {
    if (p.codigo.startsWith("COM-")) return "combo";

    switch (p.classe_produto) {
      case "S":
        return "simples";
      case "K":
        if (p.unidade === "CB") return "combo";
        return "kit";
      default:
        if (p.unidade === "KIT") return "kit";
        return "simples";
    }
  }

  private async buildDoc(p: TinyProduct): Promise<Record<string, unknown>> {
    const productType = this.resolveType(p);
    let supplierId = await this.resolveSupplier(
      p.codigo,
      p.nome_fornecedor,
      p.marca,
    );

    const doc: Record<string, unknown> = {
      tinyId: p.id,
      productType,
      baseSku: p.codigo,
      name: p.nome,
      ncm: p.ncm ? ncmClean(p.ncm) : undefined,
      tablePrice: p.preco,
      unitPrice: (p?.preco ?? 0) / (p?.unidade_por_caixa ?? 1),
      cost: p.preco_custo,

      ipi: p.valor_ipi_fixo,
      weightKg: p.peso_liquido,
      chargeableWeightKg: p.peso_bruto,
      heightCm: p.alturaEmbalagem || undefined,
      lengthCm: p.comprimentoEmbalagem || undefined,
      widthCm: p.larguraEmbalagem || undefined,
      unitsPerBox: p.unidade_por_caixa || undefined,
      custo: p.preco_custo,
      imageUrl: p.anexos[0]?.anexo ?? undefined,
      manufacturerCode: p.codigo_pelo_fornecedor || undefined,
    };

    // ── Kit: link parent + inherit supplier ────────────────────────────────
    if (productType === "kit" && p.kit.length > 0) {
      const { id_produto, quantidade } = p.kit[0].item;
      const parent = await this.products.findByTinyId(id_produto);
      doc.kitQuantity = quantidade;
      doc.parentProduct = parent ? (parent as any)._id : undefined;
      // Inherit supplier from the parent product when not resolved directly
      if (!supplierId && parent && (parent as any).supplier) {
        supplierId = (parent as any).supplier.toString();
      }
      // Inherit manufacturerCode from the parent when the kit has none
      if (!doc.manufacturerCode && parent && (parent as any).manufacturerCode) {
        doc.manufacturerCode = (parent as any).manufacturerCode;
      }
    }

    // ── Combo: link each component ─────────────────────────────────────────
    if (productType === "combo" && p.kit.length > 0) {
      const components = (
        await Promise.all(
          p.kit.map(async ({ item: { id_produto, quantidade } }) => {
            const comp = await this.products.findByTinyId(id_produto);
            return comp
              ? { product: (comp as any)._id, quantity: quantidade }
              : null;
          }),
        )
      ).filter(Boolean);
      doc.components = components;
    }

    doc.supplier = supplierId;

    // Strip undefined so existing fields are not nulled on update
    return Object.fromEntries(
      Object.entries(doc).filter(([, v]) => v !== undefined),
    );
  }

  async ingestOne(p: TinyProduct) {
    const doc = await this.buildDoc(p);
    const saved = await this.products.upsertBySku(p.codigo, doc);
    return {
      baseSku: p.codigo,
      productType: doc.productType as string,
      supplierId: (doc.supplier as string) ?? null,
      _id: (saved as any)?._id,
    };
  }

  /**
   * Process items in dependency order so parent/component products exist
   * before kits and combos are upserted:
   *   1. simples  (base products — no dependencies)
   *   2. kits     (reference one simples product)
   *   3. combos   (reference multiple simples/kit products)
   */
  async ingestMany(items: TinyProduct[]) {
    const simples = items.filter((p) => this.resolveType(p) === "simples");
    const kits = items.filter((p) => this.resolveType(p) === "kit");
    const combos = items.filter((p) => this.resolveType(p) === "combo");

    const run = (batch: TinyProduct[]) =>
      Promise.allSettled(batch.map((p) => this.ingestOne(p)));

    const settled = [
      ...(await run(simples)),
      ...(await run(kits)),
      ...(await run(combos)),
    ];

    const fulfilled = settled
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<
          Awaited<ReturnType<typeof this.ingestOne>>
        > => r.status === "fulfilled",
      )
      .map((r) => r.value);

    const failed = settled
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r, i) => ({ index: i, reason: String(r.reason) }));

    return { fulfilled, failed };
  }
}
