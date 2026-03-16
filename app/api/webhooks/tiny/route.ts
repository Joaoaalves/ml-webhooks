import { connectDB } from "@/lib/db";
import {
  handleEstoque,
  handleSituacaoPedido,
  handleVenda,
  RateLimitError,
} from "@/lib/tiny";
import { TinyWebhookEstoque } from "@/models/TinyWebhookEstoque";
import { TinyWebhookSituacaoPedido } from "@/models/TinyWebhookSituacaoPedido";
import { TinyWebhookVenda } from "@/models/TinyWebhookVenda";
import {
  ITinyWebhookEstoque,
  ITinyWebhookPayload,
  ITinyWebhookSituacaoPedido,
  ITinyWebhookVenda,
} from "@/types/tiny";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let payload: ITinyWebhookPayload;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.tipo || !payload.cnpj) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    await connectDB();

    switch (payload.tipo) {
      case "inclusao_pedido":
      case "atualizacao_pedido": {
        const p = payload as ITinyWebhookVenda;
        await TinyWebhookVenda.create({
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
        await handleVenda(p);
        await TinyWebhookVenda.findOneAndUpdate(
          { orderId: p.dados.id, tipo: p.tipo },
          { processed: true },
          { sort: { _id: -1 } },
        );
        break;
      }

      case "estoque": {
        const p = payload as ITinyWebhookEstoque;
        await TinyWebhookEstoque.create({
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
        await handleEstoque(p);
        await TinyWebhookEstoque.findOneAndUpdate(
          { idProduto: p.dados.idProduto },
          { processed: true },
          { sort: { _id: -1 } },
        );
        break;
      }

      case "situacao_pedido": {
        const p = payload as ITinyWebhookSituacaoPedido;
        await TinyWebhookSituacaoPedido.create({
          cnpj: p.cnpj,
          idEcommerce: p.idEcommerce,
          idPedidoEcommerce: p.dados.idPedidoEcommerce,
          idVendaTiny: p.dados.idVendaTiny,
          situacao: p.dados.situacao,
          descricaoSituacao: p.dados.descricaoSituacao,
          raw: p,
          processed: false,
        });
        await handleSituacaoPedido(p);
        await TinyWebhookSituacaoPedido.findOneAndUpdate(
          { idVendaTiny: p.dados.idVendaTiny },
          { processed: true },
          { sort: { _id: -1 } },
        );
        break;
      }

      default:
        // Unknown tipo — saved as-is but no processing
        console.warn(`[tiny-webhook] Unknown tipo: ${(payload as Record<string, unknown>).tipo}`);
        return NextResponse.json({ ok: true, note: "unhandled tipo" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RateLimitError) {
      // Return 429 so Tiny retries in ~5 minutes.
      // The raw webhook was already saved to DB before this point.
      console.warn("[tiny-webhook] Rate limit reached, asking Tiny to retry");
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }

    console.error(`[tiny-webhook] Error processing tipo=${payload.tipo}:`, err);
    // Return 500 so Tiny retries on unexpected failures too
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
