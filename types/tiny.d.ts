// ---------------------------------------------------------------------------
// Webhook payload types (what Tiny POSTs to our endpoint)
// ---------------------------------------------------------------------------

export interface ITinyWebhookVenda {
  versao: string;
  cnpj: string;
  tipo: "inclusao_pedido" | "atualizacao_pedido";
  dados: {
    id: number;
    numero: number;
    data: string; // DD/MM/YYYY
    idPedidoEcommerce?: string;
    codigoSituacao: string;
    descricaoSituacao?: string;
    idContato: number;
    nomeEcommerce?: string;
    cliente?: Record<string, unknown>;
    formaEnvio?: Record<string, unknown>;
  };
}

export interface ITinyWebhookEstoque {
  versao: string;
  cnpj: string;
  idEcommerce: number;
  tipo: "estoque";
  dados: {
    tipoEstoque?: "F" | "D"; // F=Physical, D=Available — not always sent by Tiny
    saldo: number;
    idProduto: number;
    sku: string;
    skuMapeamento: string;
    skuMapeamentoPai: string;
  };
}

export interface ITinyWebhookSituacaoPedido {
  versao: string;
  cnpj: string;
  idEcommerce: number;
  tipo: "situacao_pedido";
  dados: {
    idPedidoEcommerce: string;
    idVendaTiny: number;
    situacao: string;
    descricaoSituacao: string;
  };
}

export type ITinyWebhookPayload =
  | ITinyWebhookVenda
  | ITinyWebhookEstoque
  | ITinyWebhookSituacaoPedido;

// ---------------------------------------------------------------------------
// Tiny API response types
// ---------------------------------------------------------------------------

// Each entry in the depositos array is wrapped: { deposito: { ... } }
export interface ITinyStockDeposit {
  deposito: {
    nome: string;
    desconsiderar: "S" | "N"; // S=ignore from totals, N=include
    saldo: number;
    empresa: string;
  };
}

export interface ITinyStockResponse {
  retorno: {
    status_processamento: number;
    status: "OK" | "Erro";
    erros?: Array<{ erro: string }>;
    produto?: {
      id: number;
      nome: string;
      codigo: string;
      unidade: string;
      saldo: number;
      saldoReservado?: number;
      depositos?: ITinyStockDeposit[];
    };
  };
}

//

export interface ITinyOrderItem {
  item: {
    id: number;
    codigo: string;
    descricao: string;
    unidade: string;
    quantidade: number;
    valor_unitario: number;
  };
}

export interface ITinyOrderResponse {
  retorno: {
    status_processamento: number;
    status: "OK" | "Erro";
    erros?: Array<{ erro: string }>;
    pedido?: {
      id: number;
      numero: string;
      numero_ecommerce: string;
      data_pedido: string; // DD/MM/YYYY
      situacao: string;
      codigo_situacao: string;
      itens: ITinyOrderItem[];
      total_produtos: number;
      total_pedido: number;
      desconto: number;
      frete: number;
      cliente?: Record<string, unknown>;
    };
  };
}

export interface ITinyProductData {
  id: number;
  nome: string;
  codigo: string;
  preco: number;
  preco_promocional?: number;
  situacao: "A" | "I" | "E"; // A=Active, I=Inactive, E=Deleted
  tipo: string;
  unidade: string;
  estoque_atual?: number;
  estoque_minimo?: number;
  estoque_maximo?: number;
  gtin?: string;
  ncm?: string;
  [key: string]: unknown;
}

export interface ITinyProductResponse {
  retorno: {
    status_processamento: number;
    status: "OK" | "Erro";
    erros?: Array<{ erro: string }>;
    produto?: ITinyProductData;
  };
}

// ---------------------------------------------------------------------------
// DB document interfaces
// ---------------------------------------------------------------------------

export interface ITinyWebhookVendaDoc {
  cnpj: string;
  tipo: "inclusao_pedido" | "atualizacao_pedido";
  orderId: number;
  orderNumber: number;
  date: string;
  codigoSituacao: string;
  idContato: number;
  raw: Record<string, unknown>;
  receivedAt: Date;
  processed: boolean;
}

export interface ITinyWebhookEstoqueDoc {
  cnpj: string;
  idEcommerce: number;
  tipoEstoque?: "F" | "D";
  saldo: number;
  idProduto: number;
  sku: string;
  skuMapeamento: string;
  skuMapeamentoPai: string;
  raw: Record<string, unknown>;
  receivedAt: Date;
  processed: boolean;
}

export interface ITinyWebhookSituacaoPedidoDoc {
  cnpj: string;
  idEcommerce: number;
  idPedidoEcommerce: string;
  idVendaTiny: number;
  situacao: string;
  descricaoSituacao: string;
  raw: Record<string, unknown>;
  receivedAt: Date;
  processed: boolean;
}

export interface ITinyProductStockDoc {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  balance: number;
  reservedBalance: number;
  deposits: Array<{
    name: string;
    tipo: string;  // normalized slug derived from name (e.g. "galpao", "avaria", "a_caminho", "full_mercado_livre")
    ignore: boolean;
    balance: number;
    company: string;
  }>;
}

export interface ITinyProduct {
  tinyId: number;
  sku: string;
  name: string;
  price: number;
  status: "A" | "I" | "E";
  tipo: string;
  unidade: string;
  stock: number;
  stockMin?: number;
  stockMax?: number;
  gtin?: string;
  ncm?: string;
}

export interface ITinyOrder {
  orderId: string;
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  saleDate: Date;
  counted: boolean;
  ecommerce?: string; // nomeEcommerce from webhook payload
  situacao?: string;  // pedido.situacao at time of counting
}

export interface IChannelMetrics {
  valid: { items: number; revenue: number; orders: number };
  invalid: { items: number; revenue: number; orders: number };
  byStatus: Record<string, { items: number; revenue: number; orders: number }>;
}

export interface ITinySalesBucket {
  date: Date;
  product: string; // Tiny product ID as string
  sku: string;
  unitPrice: number;
  total: { items: number; revenue: number; orders: number };
  mercadoLivre: IChannelMetrics;
  mercadoLivreFulfillment: IChannelMetrics;
  shopee: IChannelMetrics;
  amazon: IChannelMetrics;
  tiktok: IChannelMetrics;
  magalu: IChannelMetrics;
}
