import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ProductRepository } from "@/repositories/ProductRepository";

interface Deposit {
  name: string;
  ignore: boolean;
  balance: number;
}

interface FlexStockLine {
  sku: string;
  deposits: Deposit[];
}

export async function POST(req: Request) {
  await connectDB();
  const payload: FlexStockLine[] = await req.json();
  const lines = payload.map((line) => ({
    sku: line.sku,
    storage:
      line.deposits.find((d) => d.name === "Galpão" && !d.ignore)?.balance ?? 0,
    incoming:
      line.deposits.find((d) => d.name === "A Caminho" && !d.ignore)?.balance ??
      0,
    damage:
      line.deposits.find((d) => d.name === "Avaria" && !d.ignore)?.balance ?? 0,
  }));
  const repo = new ProductRepository();
  await repo.updateStock(lines);
  return NextResponse.json({ updated: lines.length });
}
