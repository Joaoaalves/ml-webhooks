import {
  ITinyOrderResponse,
  ITinyProductResponse,
  ITinyStockResponse,
  ITinyWebhookEstoque,
  ITinyWebhookSituacaoPedido,
  ITinyWebhookVenda,
} from "@/types/tiny";
import { TinyOrder } from "@/models/Tiny/TinyOrder";
import { TinyRateLimit } from "@/models/Tiny/TinyRateLimit";
import { ProductRepository } from "@/repositories/ProductRepository";
import { SaleRepository } from "@/repositories/SaleRepository";

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
  shopee: "shopee",
  amazon: "amazon",
  "tiktok shop": "tiktok",
  magalu: "magalu",
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

async function tinyPost<T>(
  endpoint: string,
  params: Record<string, string>,
): Promise<T> {
  const body = new URLSearchParams({
    token: TINY_TOKEN,
    formato: "JSON",
    ...params,
  });

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
  return tinyPost<ITinyProductResponse>("produto.obter.php", {
    id: String(id),
  });
}

async function getOrder(id: number): Promise<ITinyOrderResponse> {
  return tinyPost<ITinyOrderResponse>("pedido.obter.php", { id: String(id) });
}

async function getProductStock(id: number): Promise<ITinyStockResponse> {
  return tinyPost<ITinyStockResponse>("produto.obter.estoque.php", {
    id: String(id),
  });
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

  const getDeposit = (name: string) =>
    (p.depositos ?? []).find(
      ({ deposito: d }) => d.nome === name && d.desconsiderar === "N",
    )?.deposito.saldo ?? 0;

  const repo = new ProductRepository();
  await repo.updateStock([
    {
      sku: p.codigo,
      storage: getDeposit("Galpão"),
      incoming: getDeposit("A Caminho"),
      damage: getDeposit("Avaria"),
    },
  ]);
}

// ---------------------------------------------------------------------------
// Topic handlers
// ---------------------------------------------------------------------------

/**
 * estoque — Fetch full product from Tiny and upsert Product + update stock deposits.
 */
export async function handleEstoque(
  payload: ITinyWebhookEstoque,
): Promise<void> {
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

  const repo = new ProductRepository();
  await repo.upsertBySku(p.codigo, {
    tinyId: String(p.id),
    name: p.nome,
    ...(p.preco != null && { tablePrice: p.preco }),
    ...(p.ncm && { ncm: p.ncm }),
  });

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
    const {
      id_produto: itemId,
      codigo: sku,
      descricao: name,
      quantidade: qty,
      valor_unitario,
    } = lineItem.item;

    const unitPrice = Number(valor_unitario);
    const quantity = Number(qty);
    const product = String(itemId);
    const revenue = unitPrice * quantity;

    const existing = await TinyOrder.findOne({
      orderId,
      itemId: product,
    }).lean();
    if (existing?.counted) continue;

    await TinyOrder.findOneAndUpdate(
      { orderId, itemId: product },
      {
        orderId,
        itemId: product,
        sku,
        name,
        quantity,
        unitPrice,
        saleDate,
        counted: true,
        ecommerce: nomeEcommerce,
        situacao,
      },
      { upsert: true, new: true },
    );

    const inc: Record<string, number> = {
      "total.items": quantity,
      "total.revenue": revenue,
      "total.orders": 1,
    };

    if (channelKey) {
      inc[`${channelKey}.valid.items`] = quantity;
      inc[`${channelKey}.valid.revenue`] = revenue;
      inc[`${channelKey}.valid.orders`] = 1;
      inc[`${channelKey}.byStatus.${situacao}.items`] = quantity;
      inc[`${channelKey}.byStatus.${situacao}.revenue`] = revenue;
      inc[`${channelKey}.byStatus.${situacao}.orders`] = 1;
    }

    const saleRepo = new SaleRepository();
    await saleRepo.incrementBucket(product, saleDate, sku, unitPrice, inc);

    try {
      await upsertProductStock(Number(itemId));
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      console.warn(
        `[tiny] Could not update stock for product ${itemId}: ${err}`,
      );
    }
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

    const saleRepo = new SaleRepository();
    await saleRepo.decrementBucket(order.itemId, order.saleDate, inc);
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
