/**
 * Local webhook test script
 *
 * Usage:
 *   node scripts/test-webhook.mjs [topic]
 *
 * Topics: items | orders_v2 | fulfillment_operations | stock_locations
 * Default: runs all sequentially
 *
 * Requires the dev server running: npm run dev
 */

const BASE = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/mercadolivre";

const PAYLOADS = {
  items: {
    _id: "test-items-0001",
    resource: "/items/MLB3709435848",
    user_id: 227584372,
    topic: "items",
    application_id: 2069392825111111,
    attempts: 1,
    sent: new Date().toISOString(),
    received: new Date().toISOString(),
  },

  orders_v2: {
    _id: "test-orders-0001",
    resource: "/orders/2000015413099528",
    user_id: 227584372,
    topic: "orders_v2",
    application_id: 2069392825111111,
    attempts: 1,
    sent: new Date().toISOString(),
    received: new Date().toISOString(),
  },

  fulfillment_operations: {
    _id: "test-fulfilment-op-0001",
    resource: "/stock/fulfillment/operations/1594883622543408468",
    user_id: 227584372,
    topic: "fulfillment_operations",
    application_id: 2069392825111111,
    attempts: 1,
    sent: new Date().toISOString(),
    received: new Date().toISOString(),
  },

  stock_locations: {
    _id: "test-stock-0001",
    resource: "/user/227584372/inventories/TMML71337/stock/fulfillment",
    user_id: 227584372,
    topic: "stock_locations",
    application_id: 2069392825111111,
    attempts: 1,
    sent: new Date().toISOString(),
    received: new Date().toISOString(),
  },
};

async function send(topic, payload) {
  console.log(`\n→ [${topic}] POST ${BASE}`);
  console.log("  resource:", payload.resource);

  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  const icon = body.ok ? "✓" : "✗";
  console.log(`  ${icon} status=${res.status}`, JSON.stringify(body));
}

const arg = process.argv[2];

if (arg) {
  if (!PAYLOADS[arg]) {
    console.error(`Unknown topic "${arg}". Available: ${Object.keys(PAYLOADS).join(", ")}`);
    process.exit(1);
  }
  await send(arg, PAYLOADS[arg]);
} else {
  for (const [topic, payload] of Object.entries(PAYLOADS)) {
    await send(topic, payload);
  }
}
