import { NextRequest, NextResponse } from "next/server";

/**
 * Parses a Tiny webhook request body.
 * Tiny may send:
 *   - an empty body (endpoint verification ping)
 *   - JSON
 *   - application/x-www-form-urlencoded with a "dados" field containing JSON
 *
 * Returns the parsed payload, a 200 ping response (for empty bodies),
 * or a 400 error response. Caller should return early if `ping` or `error` is set.
 */
export async function parseTinyWebhookBody<T>(
  req: NextRequest,
): Promise<{ payload: T; ping?: never; error?: never } | { ping: NextResponse } | { error: NextResponse }> {
  try {
    const text = await req.text();

    if (!text.trim()) {
      return { ping: NextResponse.json({ ok: true }) };
    }

    try {
      return { payload: JSON.parse(text) as T };
    } catch {
      const params = new URLSearchParams(text);
      const dados = params.get("dados");
      if (!dados) throw new Error("No dados field in form body");
      return { payload: JSON.parse(dados) as T };
    }
  } catch (err) {
    console.warn(`[tiny-webhook] Could not parse body: ${err}`);
    return { error: NextResponse.json({ error: "Invalid body" }, { status: 400 }) };
  }
}
