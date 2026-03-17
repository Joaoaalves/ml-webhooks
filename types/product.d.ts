import { ISupplier } from "./supplier";

export type ProductType = "simples" | "kit" | "combo";

export interface IProduct {
  productType: ProductType;

  // Informações básicas
  baseSku: string;
  tinyId: string;
  name: string;
  imageUrl?: string;
  manufacturerCode?: string;
  ncm?: string; // Código Mercosul — 8 dígitos
  unitsPerBox?: number;
  supplier: ISupplier;

  // Preços e impostos
  tablePrice?: number;
  cost: number;
  icms?: number;
  ipi?: number;
  difal?: number;
  storageCost?: number;
  // Calculados (não persistidos)
  priceWithTaxes?: number;
  unitPrice?: number;

  // Dimensões e peso
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  volumeM3?: number;
  weightKg?: number;
  chargeableWeightKg?: number;

  minStockDays: number;

  // Kit
  kitQuantity?: number;
  parentProduct?: IProduct | string;

  // Combo
  components?: IProductComponent[];

  stock?: {
    storage: number; // Galpão
    incoming: number; // A Caminho
    damage: number; // Avaria
  };

  createdAt: Date;
}

export interface IExternalProduct<
  TLogistic extends string,
  TStatus extends string,
> {
  productId: string;
  sku: string;
  name: string;

  link: string;
  image: string;

  unitsPerPack: number;
  price: number;

  logisticType: TLogistic;

  dateCreated: Date;
  status: TStatus;
}

export type IProductBaseCache<TProduct extends IExternalProduct> = TProduct & {
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
  updatedAt: Date;
};
