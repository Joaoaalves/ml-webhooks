import { connectDB } from "@/lib/db";
import { parseTinyWebhookBody } from "@/lib/parseTinyWebhookBody";
import { handleEstoque, RateLimitError } from "@/lib/tiny";
import { TinyWebhookEstoqueRepository } from "@/repositories/TinyWebhookEstoqueRepository";
import { ITinyWebhookEstoque } from "@/types/tiny";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const result = await parseTinyWebhookBody<ITinyWebhookEstoque>(req);
  if ("ping" in result) return result.ping;
  if ("error" in result) return result.error;
  const { payload } = result;

  try {
    await connectDB();
    await TinyWebhookEstoqueRepository.save(payload);
    await handleEstoque(payload);
    await TinyWebhookEstoqueRepository.markProcessed(payload.dados.idProduto);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn(
        "[tiny-webhook/estoque] Rate limit reached, asking Tiny to retry",
      );
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }
    console.error("[tiny-webhook/estoque] Error processing estoque:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
