/** Sales Management (Module 9). */

export type SaleType = 'Cash' | 'Credit';
export type PaymentMode = 'Cash' | 'UPI' | 'Card';

export interface SaleItem {
  name: string;
  qty: number;
  rate: number;
  gstRate: number; // %
}

export interface SaleInvoice {
  id: string;
  invoiceNo: string;
  date: string; // ISO
  customerName: string;
  type: SaleType;
  items: SaleItem[];
  /** Cash sales */
  paymentMode?: PaymentMode;
  /** Credit sales */
  debtorLedger?: string;
  creditPeriodDays?: number;
  dueDate?: string; // ISO
  narration?: string;
  subTotal: number; // taxable value
  gstTotal: number;
  grandTotal: number;
  voucherId?: string;
  createdAt: string;
}

export interface SalesReturn {
  id: string;
  returnNo: string;
  date: string; // ISO
  originalInvoiceNo: string;
  customerName: string;
  items: SaleItem[];
  reason: string;
  subTotal: number;
  gstTotal: number;
  grandTotal: number;
  voucherId?: string;
  createdAt: string;
}

export interface StockInfo {
  opening: number;
  closing: number;
}
