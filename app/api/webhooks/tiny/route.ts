import { connectDB } from "@/lib/db";
import {
  handleEstoque,
  handleSituacaoPedido,
  handleVenda,
  RateLimitError,
} from "@/lib/tiny";
import { TinyWebhookEstoqueRepository } from "@/repositories/TinyWebhookEstoqueRepository";
import { TinyWebhookSituacaoPedidoRepository } from "@/repositories/TinyWebhookSituacaoPedidoRepository";
import { TinyWebhookVendaRepository } from "@/repositories/TinyWebhookVendaRepository";
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
    const text = await req.text();
    try {
      payload = JSON.parse(text);
    } catch {
      // Tiny may send webhooks as application/x-www-form-urlencoded with a "dados" field
      const params = new URLSearchParams(text);
      const dados = params.get("dados");
      if (!dados) throw new Error("No dados field in form body");
      payload = JSON.parse(dados);
    }
  } catch (err) {
    console.warn(`[tiny-webhook] Could not parse body: ${err}`);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!payload.tipo || !payload.cnpj) {
    console.warn(`[tiny-webhook] - Missing required fields. Data: ${payload}`);
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    await connectDB();

    switch (payload.tipo) {
      case "inclusao_pedido":
      case "atualizacao_pedido": {
        const p = payload as ITinyWebhookVenda;
        await TinyWebhookVendaRepository.save(p);
        await handleVenda(p);
        await TinyWebhookVendaRepository.markProcessed(p.dados.id, p.tipo);
        break;
      }

      case "estoque": {
        const p = payload as ITinyWebhookEstoque;
        await TinyWebhookEstoqueRepository.save(p);
        await handleEstoque(p);
        await TinyWebhookEstoqueRepository.markProcessed(p.dados.idProduto);
        break;
      }

      case "situacao_pedido": {
        const p = payload as ITinyWebhookSituacaoPedido;
        await TinyWebhookSituacaoPedidoRepository.save(p);
        await handleSituacaoPedido(p);
        await TinyWebhookSituacaoPedidoRepository.markProcessed(
          p.dados.idVendaTiny,
        );
        break;
      }

      default:
        // Unknown tipo — saved as-is but no processing
        console.warn(
          `[tiny-webhook] Unknown tipo: ${(payload as Record<string, unknown>).tipo}`,
        );
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
