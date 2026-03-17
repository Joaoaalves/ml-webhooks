import { connectDB } from "@/lib/db";
import { SaleRepository } from "@/repositories/SaleRepository";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await connectDB();

  const body = await req.json();
  const docs: unknown[] = Array.isArray(body) ? body : [body];

  if (!docs.length) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const repo = new SaleRepository();
  await repo.upsertMany(docs);

  return NextResponse.json({ ok: true, processed: docs.length });
}
