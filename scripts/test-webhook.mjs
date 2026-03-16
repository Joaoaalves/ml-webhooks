/**
 * Local webhook test script
 *
 * Usage:
 *   node scripts/test-webhook.mjs [source] [topic]
 *
 * Sources: ml | tiny
 * ML topics:   items | orders_v2 | fulfillment_operations | stock_locations
 * Tiny topics: estoque | inclusao_pedido | atualizacao_pedido | situacao_pedido
 *
 * Examples:
 *   node scripts/test-webhook.mjs              → all ML webhooks
 *   node scripts/test-webhook.mjs ml           → all ML webhooks
 *   node scripts/test-webhook.mjs ml orders_v2 → specific ML topic
 *   node scripts/test-webhook.mjs tiny         → all Tiny webhooks
 *   node scripts/test-webhook.mjs tiny estoque → specific Tiny topic
 *
 * Requires the dev server running: npm run dev
 */

const ML_BASE =
  process.env.ML_WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/mercadolivre";
const TINY_BASE =
  process.env.TINY_WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/tiny";

// ---------------------------------------------------------------------------
// Mercado Livre payloads
// ---------------------------------------------------------------------------

const ML_PAYLOADS = {
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

// ---------------------------------------------------------------------------
// Tiny payloads
// ---------------------------------------------------------------------------

const TINY_PAYLOADS = {
  estoque: {
    versao: "1.0.0",
    cnpj: "12345678000100",
    idEcommerce: 1,
    tipo: "estoque",
    dados: {
      tipoEstoque: "F",
      saldo: 15,
      idProduto: 123456789,
      sku: "SKU-TESTE-001",
      skuMapeamento: "MLB3709435848",
      skuMapeamentoPai: "",
    },
  },

  inclusao_pedido: {
    versao: "1.0.0",
    cnpj: "12345678000100",
    tipo: "inclusao_pedido",
    dados: {
      id: 987654321,
      numero: 1001,
      data: new Date().toLocaleDateString("pt-BR"),
      codigoSituacao: "aprovado",
      idContato: 111222333,
      cliente: { nome: "Cliente Teste", email: "teste@email.com" },
    },
  },

  atualizacao_pedido: {
    versao: "1.0.0",
    cnpj: "12345678000100",
    tipo: "atualizacao_pedido",
    dados: {
      id: 987654321,
      numero: 1001,
      data: new Date().toLocaleDateString("pt-BR"),
      codigoSituacao: "cancelado",
      idContato: 111222333,
    },
  },

  situacao_pedido: {
    versao: "1.0.0",
    cnpj: "12345678000100",
    idEcommerce: 1,
    tipo: "situacao_pedido",
    dados: {
      idPedidoEcommerce: "2000015413099528",
      idVendaTiny: 987654321,
      situacao: "cancelado",
      descricaoSituacao: "Cancelado",
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function send(label, url, payload) {
  const tipo = payload.tipo ?? payload.topic ?? "?";
  console.log(`\n→ [${label}] POST ${url}`);
  console.log(`  tipo/topic: ${tipo}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  const ok = res.status === 200 && (body.ok !== false);
  console.log(`  ${ok ? "✓" : "✗"} status=${res.status}`, JSON.stringify(body));
}

async function runAll(source, payloads, url) {
  for (const [key, payload] of Object.entries(payloads)) {
    await send(`${source}:${key}`, url, payload);
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

const [source, topic] = process.argv.slice(2);

if (!source || source === "ml") {
  if (topic) {
    if (!ML_PAYLOADS[topic]) {
      console.error(`Unknown ML topic "${topic}". Available: ${Object.keys(ML_PAYLOADS).join(", ")}`);
      process.exit(1);
    }
    await send(`ml:${topic}`, ML_BASE, ML_PAYLOADS[topic]);
  } else {
    await runAll("ml", ML_PAYLOADS, ML_BASE);
  }
} else if (source === "tiny") {
  if (topic) {
    if (!TINY_PAYLOADS[topic]) {
      console.error(`Unknown Tiny topic "${topic}". Available: ${Object.keys(TINY_PAYLOADS).join(", ")}`);
      process.exit(1);
    }
    await send(`tiny:${topic}`, TINY_BASE, TINY_PAYLOADS[topic]);
  } else {
    await runAll("tiny", TINY_PAYLOADS, TINY_BASE);
  }
} else {
  console.error(`Unknown source "${source}". Use "ml" or "tiny".`);
  process.exit(1);
}
