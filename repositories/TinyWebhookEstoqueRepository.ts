import { TinyWebhookEstoque } from "@/models/Tiny/TinyWebhookEstoque";
import { ITinyWebhookEstoque } from "@/types/tiny";

export const TinyWebhookEstoqueRepository = {
  async save(p: ITinyWebhookEstoque) {
    return TinyWebhookEstoque.create({
      cnpj: p.cnpj,
      idEcommerce: p.idEcommerce,
      tipoEstoque: p.dados.tipoEstoque,
      saldo: p.dados.saldo,
      idProduto: p.dados.idProduto,
      sku: p.dados.sku,
      skuMapeamento: p.dados.skuMapeamento,
      skuMapeamentoPai: p.dados.skuMapeamentoPai,
      raw: p,
      processed: false,
    });
  },

  async markProcessed(idProduto: number) {
    return TinyWebhookEstoque.findOneAndUpdate(
      { idProduto },
      { processed: true },
      { sort: { _id: -1 } },
    );
  },
};
