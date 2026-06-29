/** Stock / Inventory Management (Module 11). */

export type StockValuationMethod = 'FIFO' | 'LIFO' | 'WAC';

export interface StockItem {
  id: string;
  name: string;
  code?: string;
  category?: string;
  unit: string; // unit of measure (Nos, Kg, Ltr…)
  gstRate: number; // %
  hsnCode?: string;
  openingQty: number;
  openingRate: number;
  /** Derived/cached from StockTxn records by StockService.sync() */
  currentQty?: number;
  currentValue?: number;
  valuationMethod?: StockValuationMethod;
  reorderLevel?: number;
  reorderQty?: number;
  createdAt: string;
}

export type StockDirection = 'In' | 'Out';

export interface StockTxn {
  id: string;
  itemId: string;
  date: string; // ISO
  direction: StockDirection;
  qty: number;
  rate: number; // entered for 'In'; for 'Out' the valuation engine derives it
  particulars: string; // e.g. Purchase, Production, Sales, Consumption
  reference?: string;
  createdAt: string;
}

/** One row of a per-item stock register / movement ledger. */
export interface StockRegisterRow {
  date: string;
  particulars: string;
  inQty: number;
  inRate: number;
  inValue: number;
  outQty: number;
  outRate: number;
  outValue: number;
  balQty: number;
  balRate: number;
  balValue: number;
}

export interface StockSummaryRow {
  item: StockItem;
  balQty: number;
  balRate: number;
  balValue: number;
  reorderLevel: number;
  lowStock: boolean;
  lastMovement?: string; // ISO of last txn
  slowMoving: boolean;
}
