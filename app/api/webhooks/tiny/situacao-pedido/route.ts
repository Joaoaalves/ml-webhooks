import { connectDB } from "@/lib/db";
import { parseTinyWebhookBody } from "@/lib/parseTinyWebhookBody";
import { handleSituacaoPedido, RateLimitError } from "@/lib/tiny";
import { TinyWebhookSituacaoPedidoRepository } from "@/repositories/TinyWebhookSituacaoPedidoRepository";
import { ITinyWebhookSituacaoPedido } from "@/types/tiny";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const result = await parseTinyWebhookBody<ITinyWebhookSituacaoPedido>(req);
  if ("ping" in result) return result.ping;
  if ("error" in result) return result.error;
  const { payload } = result;

  try {
    await connectDB();
    await TinyWebhookSituacaoPedidoRepository.save(payload);
    await handleSituacaoPedido(payload);
    await TinyWebhookSituacaoPedidoRepository.markProcessed(payload.dados.idVendaTiny);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn("[tiny-webhook/situacao-pedido] Rate limit reached, asking Tiny to retry");
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }
    console.error("[tiny-webhook/situacao-pedido] Error processing situacao_pedido:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
