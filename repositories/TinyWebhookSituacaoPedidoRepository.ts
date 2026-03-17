import { TinyWebhookSituacaoPedido } from "@/models/TinyWebhookSituacaoPedido";
import { ITinyWebhookSituacaoPedido } from "@/types/tiny";

export const TinyWebhookSituacaoPedidoRepository = {
  async save(p: ITinyWebhookSituacaoPedido) {
    return TinyWebhookSituacaoPedido.create({
      cnpj: p.cnpj,
      idEcommerce: p.idEcommerce,
      idPedidoEcommerce: p.dados.idPedidoEcommerce,
      idVendaTiny: p.dados.idVendaTiny,
      situacao: p.dados.situacao,
      descricaoSituacao: p.dados.descricaoSituacao,
      raw: p,
      processed: false,
    });
  },

  async markProcessed(idVendaTiny: number) {
    return TinyWebhookSituacaoPedido.findOneAndUpdate(
      { idVendaTiny },
      { processed: true },
      { sort: { _id: -1 } },
    );
  },
};
