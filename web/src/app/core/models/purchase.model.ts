/** Purchase Management (Module 10). */

export type PurchaseType = 'Cash' | 'Credit';
export type PurchasePaymentMode = 'Cash' | 'UPI' | 'Card' | 'Cheque';

export interface PurchaseItem {
  name: string;
  qty: number;
  rate: number;
  discountPct: number; // trade discount %
  gstRate: number; // %
}

export interface PurchaseInvoice {
  id: string;
  invoiceNo: string;
  date: string; // ISO
  supplierName: string;
  type: PurchaseType;
  items: PurchaseItem[];
  /** Cash purchase */
  paymentMode?: PurchasePaymentMode;
  /** Credit purchase */
  creditorLedger?: string;
  creditPeriodDays?: number;
  dueDate?: string; // ISO
  narration?: string;
  subTotal: number; // taxable value (after trade discount)
  gstTotal: number;
  grandTotal: number;
  voucherId?: string;
  createdAt: string;
}

export interface PurchaseReturn {
  id: string;
  debitNoteNo: string;
  date: string; // ISO
  originalInvoiceNo: string;
  supplierName: string;
  items: PurchaseItem[];
  reason: string;
  subTotal: number;
  gstTotal: number;
  grandTotal: number;
  voucherId?: string;
  createdAt: string;
}
