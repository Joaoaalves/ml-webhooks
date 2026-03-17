import { TinyWebhookVenda } from "@/models/TinyWebhookVenda";
import { ITinyWebhookVenda } from "@/types/tiny";

export const TinyWebhookVendaRepository = {
  async save(p: ITinyWebhookVenda) {
    return TinyWebhookVenda.create({
      cnpj: p.cnpj,
      tipo: p.tipo,
      orderId: p.dados.id,
      orderNumber: p.dados.numero,
      date: p.dados.data,
      codigoSituacao: p.dados.codigoSituacao,
      idContato: p.dados.idContato,
      raw: p,
      processed: false,
    });
  },

  async markProcessed(orderId: string | number, tipo: string) {
    return TinyWebhookVenda.findOneAndUpdate(
      { orderId, tipo },
      { processed: true },
      { sort: { _id: -1 } },
    );
  },
};
