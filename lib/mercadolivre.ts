import {
  IMlFulfillmentOperationResponse,
  IMlItemResponse,
  IMlOrderResponse,
  IMlTokenResponse,
} from "@/types/mercado-livre";
import { IMlWebhookPayload } from "@/types/webhook";
import { MlOrder } from "@/models/MlOrder";
import { MlProduct } from "@/models/MlProduct";
import { MlToken } from "@/models/MlToken";
import { SalesBucket } from "@/models/Sales";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const BASE_URL = process.env.ML_BASE_URL!;
const CLIENT_ID = process.env.ML_CLIENT_ID!;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET!;
// Initial refresh token comes from .env; subsequent ones are updated in DB.
const ENV_REFRESH_TOKEN = process.env.ML_REFRESH_TOKEN!;

// Tokens expire in 6 h; refresh 5 min early to avoid edge cases.
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

async function refreshAccessToken(refreshToken: string): Promise<IMlTokenResponse> {
  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ML token refresh failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<IMlTokenResponse>;
}

/**
 * Returns a valid Bearer access token.
 * Fetches from DB if still valid; otherwise refreshes via ML OAuth and saves.
 */
export async function getAccessToken(): Promise<string> {
  const stored = await MlToken.findOne().lean();

  if (stored && stored.expiresAt.getTime() - Date.now() > TOKEN_BUFFER_MS) {
    return stored.accessToken;
  }

  // Use refresh token from DB if available (it rotates after each refresh),
  // otherwise fall back to the initial value from .env.
  const refreshToken = stored?.refreshToken ?? ENV_REFRESH_TOKEN;
  const data = await refreshAccessToken(refreshToken);

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await MlToken.findOneAndUpdate(
    {},
    { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt },
    { upsert: true, new: true },
  );

  return data.access_token;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

async function mlGet<T>(resource: string): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}${resource}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ML GET ${resource} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Topic handlers
// ---------------------------------------------------------------------------

/**
 * items — Update product info and stock in MlProduct.
 */
async function handleItems(resource: string): Promise<void> {
  const item = await mlGet<IMlItemResponse>(resource);

  const sku =
    item.attributes.find((a) => a.id === "SELLER_SKU")?.value_name ?? undefined;

  const unitsPerPackAttr = item.attributes.find((a) => a.id === "UNITS_PER_PACK");
  const unitsPerPack = unitsPerPackAttr?.value_name
    ? parseInt(unitsPerPackAttr.value_name, 10)
    : undefined;

  await MlProduct.findOneAndUpdate(
    { productId: item.id },
    {
      productId: item.id,
      name: item.title,
      price: item.price,
      status: item.status,
      logisticType: item.shipping.logistic_type,
      catalogListing: item.catalog_listing,
      inventoryId: item.inventory_id ?? undefined,
      image: item.thumbnail,
      link: item.permalink,
      dateCreated: new Date(item.date_created),
      ...(sku && { sku }),
      ...(unitsPerPack && { unitsPerPack }),
      ...(item.item_relations.length > 0 && {
        itemRelation: item.item_relations[0].id,
      }),
    },
    { upsert: true, new: true },
  );
}

/**
 * fulfillment_operations — Update warehouse stock on the related MlProduct.
 */
async function handleFulfillmentOperations(resource: string): Promise<void> {
  const op = await mlGet<IMlFulfillmentOperationResponse>(resource);

  if (!op.inventory_id) return;

  // Only act on operations that confirm a stock change.
  const stockChangingTypes = ["INBOUND", "WITHDRAWAL", "SALE_CONFIRMATION", "RETURN"];
  if (!stockChangingTypes.includes(op.type)) return;

  await MlProduct.findOneAndUpdate(
    { inventoryId: op.inventory_id },
    { "stock.full": op.result.available_quantity },
  );
}

/**
 * stock_locations — Refresh fulfillment/flex stock by re-fetching the inventory
 * using the resource path from the webhook directly.
 */
async function handleStockLocations(resource: string): Promise<void> {
  // The resource path already points to the correct stock endpoint.
  const data = await mlGet<{ available_quantity: number; inventory_id?: string }>(
    resource,
  );

  if (data.inventory_id) {
    await MlProduct.findOneAndUpdate(
      { inventoryId: data.inventory_id },
      { "stock.full": data.available_quantity },
    );
  }
}

/**
 * orders_v2 — Record paid orders in SalesBucket; reverse refunded ones.
 */
async function handleOrders(resource: string): Promise<void> {
  const order = await mlGet<IMlOrderResponse>(resource);

  const orderId = String(order.id);
  const isPaid = order.status === "paid";
  const isRefunded =
    order.status === "cancelled" ||
    order.payments.some((p) => p.transaction_amount_refunded > 0);

  if (isPaid) {
    await recordSale(order, orderId);
  } else if (isRefunded) {
    await reverseSale(orderId);
  }
}

async function recordSale(order: IMlOrderResponse, orderId: string): Promise<void> {
  for (const lineItem of order.order_items) {
    const existingOrder = await MlOrder.findOne({ orderId }).lean();
    if (existingOrder?.counted) continue; // already counted, skip

    const itemId = lineItem.item.id;
    const sku = lineItem.item.seller_sku ?? "";
    const quantity = lineItem.quantity;
    const unitPrice = lineItem.unit_price;

    // Resolve logistic type from our product cache
    const product = await MlProduct.findOne({ productId: itemId }).lean();
    const logisticType = product?.logisticType ?? "self-service";

    // Truncate order date to the start of the day (UTC)
    const rawDate = new Date(order.date_created);
    const saleDate = new Date(
      Date.UTC(rawDate.getUTCFullYear(), rawDate.getUTCMonth(), rawDate.getUTCDate()),
    );

    // Save order record
    await MlOrder.findOneAndUpdate(
      { orderId },
      { orderId, itemId, sku, quantity, unitPrice, logisticType, saleDate, counted: true },
      { upsert: true, new: true },
    );

    // Build SalesBucket increments
    const modalityField = resolveModalityField(logisticType);
    const revenue = unitPrice * quantity;

    const inc: Record<string, number> = {
      "total.items": quantity,
      "total.revenue": revenue,
      "total.orders": 1,
      [`${modalityField}.items`]: quantity,
      [`${modalityField}.revenue`]: revenue,
      [`${modalityField}.orders`]: 1,
    };

    await SalesBucket.findOneAndUpdate(
      { product: itemId, date: saleDate },
      {
        $setOnInsert: { product: itemId, sku, date: saleDate, unitPrice },
        $inc: inc,
      },
      { upsert: true, new: true },
    );
  }
}

async function reverseSale(orderId: string): Promise<void> {
  const mlOrder = await MlOrder.findOne({ orderId, counted: true }).lean();
  if (!mlOrder) return; // was never counted

  const modalityField = resolveModalityField(mlOrder.logisticType);
  const revenue = mlOrder.unitPrice * mlOrder.quantity;

  const dec: Record<string, number> = {
    "total.items": -mlOrder.quantity,
    "total.revenue": -revenue,
    "total.orders": -1,
    [`${modalityField}.items`]: -mlOrder.quantity,
    [`${modalityField}.revenue`]: -revenue,
    [`${modalityField}.orders`]: -1,
  };

  await SalesBucket.findOneAndUpdate(
    { product: mlOrder.itemId, date: mlOrder.saleDate },
    { $inc: dec },
  );

  await MlOrder.findOneAndUpdate({ orderId }, { counted: false });
}

function resolveModalityField(logisticType: string): "fulfillment" | "flex" | "dropOff" {
  if (logisticType === "fulfillment") return "fulfillment";
  if (logisticType === "xd-drop-off" || logisticType === "drop-off") return "dropOff";
  return "flex"; // self-service → flex
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

/**
 * Processes a webhook notification based on its topic.
 * Uses `resource` as the ML API path for authenticated calls.
 */
export async function processWebhook(payload: IMlWebhookPayload): Promise<void> {
  const { topic, resource } = payload;

  switch (topic) {
    case "items":
      await handleItems(resource);
      break;

    case "fulfillment_operations":
      await handleFulfillmentOperations(resource);
      break;

    case "stock_locations":
      await handleStockLocations(resource);
      break;

    case "orders_v2":
      await handleOrders(resource);
      break;

    default:
      // Unhandled topic — webhook is logged but no further action taken
      break;
  }
}
