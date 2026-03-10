import { ISupplier } from "./supplier";

export interface ISelfProduct {
  name: string;
  baseSku: string;
  supplier: ISupplier;

  minStockDays: number;

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
