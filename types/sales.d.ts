import { IStock } from "./stock";
import { IRegression } from "./trend";
import { AbcCurve, Momentum, Trend } from "./enums";

export interface IModalityMetrics {
  items: number;
  revenue: number;
  orders: number;
}

export interface IMonthBucket {
  year: number;
  month: number;
  date: Date;
  views: number;

  conversionRate: number;

  total: IModalityMetrics;

  fulfillment: IModalityMetrics;
  flex: IModalityMetrics;
  dropOff: IModalityMetrics;
}

export interface ISaleBucket {
  date: Date;
  product: string;
  sku: string;

  unitPrice: number;

  // Modalities
  total: IModalityMetrics;
  fulfillment: IModalityMetrics;
  flex: IModalityMetrics;
  dropOff: IModalityMetrics;
  //

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMlSalesDashboardProduct {
  productId: string;
  sku: string;
  name: string;
  image: string;
  link: string;
  price: number;
  status: string;
  logisticType: string;
  catalogListing: boolean;
  itemRelation?: string;
  stock: {
    full: number;
    flex: number;
  };
  isNew: boolean;
  months: IMonthBucket[];
  totals: {
    units: number;
    revenue: number;
    orders: number;
    views: number;
  };
  dailyAvg45: {
    revenue: number;
    units: number;
    activeDays: number;
  };
  dailyAvg30: {
    revenue: number;
    units: number;
    activeDays: number;
  };
  dateCreated: Date;

  // Analytics por produto
  trend: Trend;
  momentum: Momentum;
  earlySignal: Momentum | null;
  regression: IRegression;
  conversionDropped: boolean;
  conversionDropPct: number;

  abcCurve: AbcCurve;
  abcCumulativePct: number;
}

export interface ISalesDashboardItem {
  sku: string; // baseSku — chave de agregação

  name: string;
  image: string;
  dateCreated: Date;

  // Campos representativos (derivados dos produtos do SKU)
  status: string;            // "active" se qualquer produto está ativo
  logisticType: string;      // "fulfillment" se qualquer produto é Full
  isNew: boolean;            // true se algum produto é novo
  availableQuantity: number; // total stock (full + flex) de todos os produtos

  // Valores agregados (soma de todos os produtos do SKU)
  months: IMonthBucket[];
  totals: {
    units: number;
    revenue: number;
    orders: number;
    views: number;
  };
  dailyAvg45: {
    revenue: number;
    units: number;
    activeDays: number;
  };
  dailyAvg30: {
    revenue: number;
    units: number;
    activeDays: number;
  };

  products: IMlSalesDashboardProduct[];

  // Analytics SKU-level (do produto dominante)
  trend: Trend;
  momentum: Momentum;
  earlySignal: Momentum | null;
  regression: IRegression;
  conversionDropped: boolean;
  conversionDropPct: number;

  abcCurve: AbcCurve;
  abcCumulativePct: number;

  stock: IStock;
}

export type SalesRow = ISalesDashboardItem & {
  resolvedMonths: IMonthBucket[];
  currentMonth: IMonthBucket | null;
};
