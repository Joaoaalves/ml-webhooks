import { connectDB } from "@/lib/db";
import { processWebhook } from "@/lib/mercadolivre";
import { MlWebhookRepository } from "@/repositories/MlWebhookRepository";
import { IMlWebhookPayload } from "@/types/webhook";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let payload: IMlWebhookPayload;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload._id || !payload.topic || !payload.resource) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    await connectDB();

    // Save the raw webhook — use upsert so retries from ML don't duplicate
    const webhook = await MlWebhookRepository.upsert(payload);

    // Process the notification
    await processWebhook(payload);

    // Mark as processed
    await MlWebhookRepository.markProcessed(payload._id);

    return NextResponse.json({ ok: true, id: webhook._id });
  } catch (err) {
    console.error(`[webhook] Error processing ${payload.topic} ${payload.resource}:`, err);
    // Return 200 anyway so ML doesn't keep retrying for server errors
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
  }
}
