import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  parseTinyBodies,
  ProductIngestService,
} from "@/services/product-ingest.service";

export async function POST(req: Request) {
  const body = await req.json();

  const { items, errors: parseErrors } = parseTinyBodies(body);

  if (items.length === 0) {
    return NextResponse.json(
      { error: "No valid Tiny payloads found.", details: parseErrors },
      { status: 422 },
    );
  }

  await connectDB();

  const service = new ProductIngestService();
  const { fulfilled, failed } = await service.ingestMany(items);

  const allFailed = failed.length > 0 && fulfilled.length === 0;

  return NextResponse.json(
    {
      ok: !allFailed,
      processed: fulfilled.length,
      results: fulfilled,
      parseErrors: parseErrors.length ? parseErrors : undefined,
      ingestErrors: failed.length ? failed : undefined,
    },
    { status: allFailed ? 500 : 200 },
  );
}
