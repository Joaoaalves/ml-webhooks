import { connectDB } from "@/lib/db";
import { parseTinyWebhookBody } from "@/lib/parseTinyWebhookBody";
import { handleVenda, RateLimitError } from "@/lib/tiny";
import { TinyWebhookVendaRepository } from "@/repositories/TinyWebhookVendaRepository";
import { ITinyWebhookVenda } from "@/types/tiny";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const result = await parseTinyWebhookBody<ITinyWebhookVenda>(req);
  if ("ping" in result) return result.ping;
  if ("error" in result) return result.error;
  const { payload } = result;

  try {
    await connectDB();
    await TinyWebhookVendaRepository.save(payload);
    await handleVenda(payload);
    await TinyWebhookVendaRepository.markProcessed(
      payload.dados.id,
      payload.tipo,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn(
        "[tiny-webhook/venda] Rate limit reached, asking Tiny to retry",
      );
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }
    console.error(
      `[tiny-webhook/venda] Error processing tipo=${payload.tipo}:`,
      err,
    );
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
