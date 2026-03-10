import { IExternalProduct, IProductBaseCache } from "@/types/product";

export type MlLogisticType =
  | "fulfillment"
  | "self-service"
  | "drop-off"
  | "xd-drop-off";

// ML API response types

export interface IMlItemResponse {
  id: string;
  title: string;
  seller_id: number;
  category_id: string;
  price: number;
  base_price: number;
  available_quantity: number;
  inventory_id: string | null;
  currency_id: string;
  listing_type_id: string;
  permalink: string;
  thumbnail: string;
  status: string;
  shipping: {
    logistic_type: MlLogisticType;
    free_shipping: boolean;
    mode: string;
  };
  catalog_listing: boolean;
  item_relations: { id: string; variation_id?: number }[];
  date_created: string;
  last_updated: string;
  attributes: { id: string; value_name: string | null }[];
}

export interface IMlOrderItem {
  item: {
    id: string;
    title: string;
    seller_sku: string | null;
    variation_id: number | null;
  };
  quantity: number;
  unit_price: number;
  full_unit_price: number;
  currency_id: string;
  sale_fee: number;
  listing_type_id: string;
}

export interface IMlPayment {
  id: number;
  order_id: number;
  status: string;
  status_detail: string;
  operation_type: string;
  payment_type: string;
  transaction_amount: number;
  transaction_amount_refunded: number;
  total_paid_amount: number;
  date_approved: string | null;
  date_created: string;
}

export interface IMlOrderResponse {
  id: number;
  date_created: string;
  last_updated: string;
  status: string;
  status_detail: string | null;
  fulfilled: boolean;
  total_amount: number;
  paid_amount: number;
  currency_id: string;
  order_items: IMlOrderItem[];
  payments: IMlPayment[];
  shipping: { id: number };
  pack_id: number | null;
  buyer: { id: number; nickname: string };
  seller: { id: number };
  tags: string[];
}

export interface IMlFulfillmentOperationResponse {
  id: number;
  seller_id: number;
  date_created: string;
  type: string;
  detail: {
    available_quantity: number;
    not_available_detail: unknown[];
  };
  result: {
    total: number;
    available_quantity: number;
    not_available_quantity: number;
    not_available_detail: unknown[];
  };
  external_references: { type: string; value: string }[];
  inventory_id: string;
}

export interface IMlTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export interface IMlToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export type MlProductStatus = "active" | "paused" | "under_review";

export interface IMlProduct extends IExternalProduct<
  MlLogisticType,
  MlProductStatus
> {
  catalogListing: boolean; // If true, is a catalog item
  itemRelation?: string; // Another productId
  inventoryId?: string;
  stock: {
    full: number;
    flex: number;
  };
}

export type IMlProductBase = IProductBaseCache<IMlProduct>;
