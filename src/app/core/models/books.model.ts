/** Books of Account — data shapes (Module 4). */

export interface PurchaseEntry {
  id: string;
  date: string; // ISO
  invoiceNo: string;
  supplierName: string;
  ledgerName: string;
  inwardNo: string;
  amount: number; // taxable value (Dr)
  gst: number;
}

export interface SalesEntry {
  id: string;
  date: string; // ISO
  invoiceNo: string;
  customerName: string;
  ledgerName: string;
  outwardNo: string;
  amount: number; // taxable value (Cr)
  gst: number;
}

export type CashSide = 'Receipt' | 'Payment';

export interface CashEntry {
  id: string;
  date: string; // ISO
  particulars: string;
  folio: string;
  side: CashSide; // Receipt = Dr (left), Payment = Cr (right)
  discount: number;
  cash: number;
  bank: number;
}

export interface Loan {
  id: string;
  lender: string;
  principal: number;
  annualRate: number; // % per annum
  tenureMonths: number;
  startDate: string; // ISO
}

export interface EmiRow {
  no: number;
  dueDate: string; // ISO
  openingBalance: number;
  emi: number;
  interest: number;
  principal: number;
  closingBalance: number;
}
