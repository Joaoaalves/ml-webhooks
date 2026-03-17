import {
  ITinyOrderResponse,
  ITinyProductResponse,
  ITinyStockResponse,
  ITinyWebhookEstoque,
  ITinyWebhookSituacaoPedido,
  ITinyWebhookVenda,
} from "@/types/tiny";
import { TinyOrder } from "@/models/TinyOrder";
import { TinyProduct } from "@/models/TinyProduct";
import { TinyProductStock } from "@/models/TinyProductStock";
import { TinyRateLimit } from "@/models/TinyRateLimit";
import { TinySalesBucket } from "@/models/TinySalesBucket";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const TINY_TOKEN = process.env.TINY_TOKEN!;
const TINY_BASE = "https://api.tiny.com.br/api2";
const RATE_LIMIT_PER_MIN = 30;

// ---------------------------------------------------------------------------
// Status codes
// ---------------------------------------------------------------------------

// Statuses that mean the order should be counted as a valid sale.
const VALID_STATUSES = ["pronto para envio", "enviado", "entregue"];

// Statuses that should trigger a sale reversal.
const CANCELLED_STATUSES = ["cancelado"];

// Maps nomeEcommerce (case-insensitive) to the bucket channel key.
const CHANNEL_MAP: Record<string, string> = {
  "mercado livre fulfillment": "mercadoLivreFulfillment",
  "mercado livre": "mercadoLivre",
  "shopee": "shopee",
  "amazon": "amazon",
  "tiktok shop": "tiktok",
  "magalu": "magalu",
};

function getChannelKey(nomeEcommerce: string): string | null {
  return CHANNEL_MAP[nomeEcommerce.toLowerCase()] ?? null;
}

function isValid(situacao: string): boolean {
  return VALID_STATUSES.some((s) => situacao.toLowerCase().includes(s));
}

function isCancelled(situacao: string): boolean {
  return CANCELLED_STATUSES.some((s) => situacao.toLowerCase().includes(s));
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

// Uses a TTL-indexed collection where each document = 1 API call.
// MongoDB auto-removes documents after 60 s, giving a rolling window count.
//
// Returns true if the slot was claimed (call may proceed).
// Returns false if the limit is already reached; the caller should return
// HTTP 429 so Tiny retries the webhook in ~5 min.

export async function acquireRateLimit(): Promise<boolean> {
  const count = await TinyRateLimit.countDocuments({});
  if (count >= RATE_LIMIT_PER_MIN) return false;
  await TinyRateLimit.create({});
  return true;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

async function tinyPost<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams({ token: TINY_TOKEN, formato: "JSON", ...params });

  const res = await fetch(`${TINY_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Tiny ${endpoint} HTTP ${res.status}`);
  }

  const data = (await res.json()) as T;
  return data;
}

async function getProduct(id: number): Promise<ITinyProductResponse> {
  return tinyPost<ITinyProductResponse>("produto.obter.php", { id: String(id) });
}

async function getOrder(id: number): Promise<ITinyOrderResponse> {
  return tinyPost<ITinyOrderResponse>("pedido.obter.php", { id: String(id) });
}

async function getProductStock(id: number): Promise<ITinyStockResponse> {
  return tinyPost<ITinyStockResponse>("produto.obter.estoque.php", { id: String(id) });
}

// ---------------------------------------------------------------------------
// Stock snapshot helper
// ---------------------------------------------------------------------------

async function upsertProductStock(productId: number): Promise<void> {
  const allowed = await acquireRateLimit();
  if (!allowed) throw new RateLimitError("Tiny rate limit reached");

  const res = await getProductStock(productId);

  if (res.retorno.status !== "OK" || !res.retorno.produto) {
    const erros = res.retorno.erros?.map((e) => e.erro).join(", ") ?? "unknown";
    throw new Error(`Tiny produto.obter.estoque failed: ${erros}`);
  }

  const p = res.retorno.produto;

  await TinyProductStock.findOneAndUpdate(
    { productId: String(p.id) },
    {
      productId: String(p.id),
      name: p.nome,
      sku: p.codigo,
      unit: p.unidade ?? "",
      balance: p.saldo ?? 0,
      reservedBalance: p.saldoReservado ?? 0,
      deposits: (p.depositos ?? []).map((d) => ({
        name: d.nome,
        ignore: d.ignorar ?? false,
        balance: d.saldo ?? 0,
        company: d.empresa,
      })),
    },
    { upsert: true, new: true },
  );
}

// ---------------------------------------------------------------------------
// Topic handlers
// ---------------------------------------------------------------------------

/**
 * estoque — Fetch full product from Tiny and upsert TinyProduct with latest stock.
 */
export async function handleEstoque(payload: ITinyWebhookEstoque): Promise<void> {
  const allowed = await acquireRateLimit();
  if (!allowed) {
    throw new RateLimitError("Tiny rate limit reached");
  }

  const res = await getProduct(payload.dados.idProduto);

  if (res.retorno.status !== "OK" || !res.retorno.produto) {
    const erros = res.retorno.erros?.map((e) => e.erro).join(", ") ?? "unknown";
    throw new Error(`Tiny produto.obter failed: ${erros}`);
  }

  const p = res.retorno.produto;

  await TinyProduct.findOneAndUpdate(
    { tinyId: p.id },
    {
      tinyId: p.id,
      sku: p.codigo,
      name: p.nome,
      price: p.preco,
      status: p.situacao,
      tipo: p.tipo,
      unidade: p.unidade,
      // Use the saldo from the webhook as the authoritative stock value
      // (the product endpoint may lag behind)
      stock: payload.dados.saldo,
      ...(p.estoque_minimo !== undefined && { stockMin: p.estoque_minimo }),
      ...(p.estoque_maximo !== undefined && { stockMax: p.estoque_maximo }),
      ...(p.gtin && { gtin: p.gtin }),
      ...(p.ncm && { ncm: p.ncm }),
    },
    { upsert: true, new: true },
  );

  await upsertProductStock(payload.dados.idProduto);
}

/**
 * inclusao_pedido / atualizacao_pedido — Fetch full order and record/reverse sale.
 */
export async function handleVenda(payload: ITinyWebhookVenda): Promise<void> {
  const allowed = await acquireRateLimit();
  if (!allowed) {
    throw new RateLimitError("Tiny rate limit reached");
  }

  const res = await getOrder(payload.dados.id);

  if (res.retorno.status !== "OK" || !res.retorno.pedido) {
    const erros = res.retorno.erros?.map((e) => e.erro).join(", ") ?? "unknown";
    throw new Error(`Tiny pedido.obter failed: ${erros}`);
  }

  const pedido = res.retorno.pedido;
  const orderId = String(pedido.id);
  const situacao = pedido.situacao ?? pedido.codigo_situacao ?? "";

  const nomeEcommerce = payload.dados.nomeEcommerce ?? "";

  if (payload.tipo === "inclusao_pedido") {
    // Only new orders are counted — atualizacao_pedido never adds, only cancels
    if (isValid(situacao)) {
      await recordTinySale(pedido, orderId, nomeEcommerce);
    }
  } else if (isCancelled(situacao)) {
    await reverseTinySale(orderId);
  }
}

/**
 * situacao_pedido — Reverse a sale if the order was cancelled via ecommerce.
 */
export async function handleSituacaoPedido(
  payload: ITinyWebhookSituacaoPedido,
): Promise<void> {
  if (isCancelled(payload.dados.situacao)) {
    await reverseTinySale(String(payload.dados.idVendaTiny));
  }
}

// ---------------------------------------------------------------------------
// Sale helpers
// ---------------------------------------------------------------------------

async function recordTinySale(
  pedido: NonNullable<ITinyOrderResponse["retorno"]["pedido"]>,
  orderId: string,
  nomeEcommerce: string,
): Promise<void> {
  // Parse date: DD/MM/YYYY → Date (UTC midnight)
  const [dd, mm, yyyy] = pedido.data_pedido.split("/");
  const saleDate = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));

  const situacao = pedido.situacao ?? pedido.codigo_situacao ?? "";
  const channelKey = getChannelKey(nomeEcommerce);

  for (const lineItem of pedido.itens) {
    const { id: itemId, codigo: sku, descricao: name, quantidade: qty, valor_unitario } =
      lineItem.item;

    const unitPrice = valor_unitario;
    const product = String(itemId);
    const revenue = unitPrice * qty;

    const existing = await TinyOrder.findOne({ orderId, itemId: product }).lean();
    if (existing?.counted) continue;

    await TinyOrder.findOneAndUpdate(
      { orderId, itemId: product },
      { orderId, itemId: product, sku, name, quantity: qty, unitPrice, saleDate, counted: true, ecommerce: nomeEcommerce, situacao },
      { upsert: true, new: true },
    );

    const inc: Record<string, number> = {
      "total.items": qty,
      "total.revenue": revenue,
      "total.orders": 1,
    };

    if (channelKey) {
      inc[`${channelKey}.valid.items`] = qty;
      inc[`${channelKey}.valid.revenue`] = revenue;
      inc[`${channelKey}.valid.orders`] = 1;
      inc[`${channelKey}.byStatus.${situacao}.items`] = qty;
      inc[`${channelKey}.byStatus.${situacao}.revenue`] = revenue;
      inc[`${channelKey}.byStatus.${situacao}.orders`] = 1;
    }

    await TinySalesBucket.findOneAndUpdate(
      { product, date: saleDate },
      {
        $setOnInsert: { product, sku, date: saleDate, unitPrice },
        $inc: inc,
      },
      { upsert: true, new: true },
    );

    await upsertProductStock(itemId);
  }
}

async function reverseTinySale(orderId: string): Promise<void> {
  const items = await TinyOrder.find({ orderId, counted: true }).lean();
  if (!items.length) return;

  for (const order of items) {
    const revenue = order.unitPrice * order.quantity;
    const channelKey = order.ecommerce ? getChannelKey(order.ecommerce) : null;
    const situacao = order.situacao ?? "";

    const inc: Record<string, number> = {
      "total.items": -order.quantity,
      "total.revenue": -revenue,
      "total.orders": -1,
    };

    if (channelKey) {
      inc[`${channelKey}.valid.items`] = -order.quantity;
      inc[`${channelKey}.valid.revenue`] = -revenue;
      inc[`${channelKey}.valid.orders`] = -1;
      inc[`${channelKey}.invalid.items`] = order.quantity;
      inc[`${channelKey}.invalid.revenue`] = revenue;
      inc[`${channelKey}.invalid.orders`] = 1;
      if (situacao) {
        inc[`${channelKey}.byStatus.${situacao}.items`] = -order.quantity;
        inc[`${channelKey}.byStatus.${situacao}.revenue`] = -revenue;
        inc[`${channelKey}.byStatus.${situacao}.orders`] = -1;
      }
    }

    await TinySalesBucket.findOneAndUpdate(
      { product: order.itemId, date: order.saleDate },
      { $inc: inc },
    );
  }

  await TinyOrder.updateMany({ orderId }, { counted: false });
}

// ---------------------------------------------------------------------------
// Custom error for rate limiting
// ---------------------------------------------------------------------------

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}
