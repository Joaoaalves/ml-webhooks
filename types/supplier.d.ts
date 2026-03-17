export interface ISupplier {
  name: string;
  /** Short uppercase prefix used as the first segment of product SKUs, e.g. "BUB". */
  prefix?: string;
  active: boolean;

  createdAt: Date;

  leadTimeDays: number;
  safetyDays: number;
}
