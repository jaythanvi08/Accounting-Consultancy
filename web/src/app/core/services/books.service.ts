import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { CompanyService } from './company.service';
import { CashEntry, EmiRow, Loan, PurchaseEntry, SalesEntry } from '../models';

/**
 * Per-company store for the Books of Account (Module 4). Mock backend:
 * signals + localStorage. Demo rows are seeded on first use so the books
 * render meaningfully before the Vouchers module is wired in.
 * Call {@link sync} from the feature component before reading.
 */
@Injectable({ providedIn: 'root' })
export class BooksService {
  private readonly storage = inject(StorageService);
  private readonly companies = inject(CompanyService);

  private readonly _purchases = signal<PurchaseEntry[]>([]);
  private readonly _sales = signal<SalesEntry[]>([]);
  private readonly _cash = signal<CashEntry[]>([]);
  private readonly _loans = signal<Loan[]>([]);

  readonly purchases = this._purchases.asReadonly();
  readonly sales = this._sales.asReadonly();
  readonly cash = this._cash.asReadonly();
  readonly loans = this._loans.asReadonly();

  private cid(): string {
    return this.companies.activeCompany()?.id ?? 'none';
  }
  private key(book: string): string {
    return `ledgerai.books.${book}.${this.cid()}`;
  }

  /** Base calendar year for seeded demo dates (company FY year, else current). */
  private fyYear(): number {
    const fy = this.companies.activeCompany()?.financialYearStart;
    const d = fy ? new Date(fy) : new Date();
    return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  }
  private iso(month: number, day: number): string {
    const y = this.fyYear();
    return new Date(y, month - 1, day).toISOString();
  }

  sync(): void {
    this._purchases.set(this.load('purchase', () => this.seedPurchases()));
    this._sales.set(this.load('sales', () => this.seedSales()));
    this._cash.set(this.load('cash', () => this.seedCash()));
    this._loans.set(this.load('finance', () => this.seedLoans()));
  }

  private load<T>(book: string, seed: () => T[]): T[] {
    const existing = this.storage.get<T[]>(this.key(book));
    if (existing) {
      return existing;
    }
    const seeded = seed();
    this.storage.set(this.key(book), seeded);
    return seeded;
  }

  // ───────── Date filtering ─────────
  private inRange(isoDate: string, from: string, to: string): boolean {
    const t = new Date(isoDate).getTime();
    if (from && t < new Date(from).getTime()) {
      return false;
    }
    if (to && t > new Date(to).getTime() + 86_399_000) {
      return false; // include the whole "to" day
    }
    return true;
  }

  filterPurchases(from: string, to: string): PurchaseEntry[] {
    return this._purchases().filter((e) => this.inRange(e.date, from, to));
  }
  filterSales(from: string, to: string): SalesEntry[] {
    return this._sales().filter((e) => this.inRange(e.date, from, to));
  }
  filterCash(from: string, to: string): CashEntry[] {
    return this._cash().filter((e) => this.inRange(e.date, from, to));
  }

  // ───────── Finance maths ─────────
  /** Equated Monthly Instalment for a reducing-balance loan. */
  emiOf(loan: Loan): number {
    const r = loan.annualRate / 12 / 100;
    if (r === 0) {
      return loan.principal / loan.tenureMonths;
    }
    const f = Math.pow(1 + r, loan.tenureMonths);
    return (loan.principal * r * f) / (f - 1);
  }

  /** Full reducing-balance amortization schedule. */
  schedule(loan: Loan): EmiRow[] {
    const r = loan.annualRate / 12 / 100;
    const emi = this.emiOf(loan);
    const start = new Date(loan.startDate);
    const rows: EmiRow[] = [];
    let balance = loan.principal;

    for (let i = 1; i <= loan.tenureMonths; i++) {
      const interest = balance * r;
      let principal = emi - interest;
      let closing = balance - principal;
      if (i === loan.tenureMonths) {
        // absorb rounding drift in the final instalment
        principal += closing;
        closing = 0;
      }
      const due = new Date(start);
      due.setMonth(due.getMonth() + i);
      rows.push({
        no: i,
        dueDate: due.toISOString(),
        openingBalance: balance,
        emi: interest + principal,
        interest,
        principal,
        closingBalance: Math.max(0, closing)
      });
      balance = closing;
    }
    return rows;
  }

  /** Instalments whose due date is on/before today (used for accrued figures). */
  elapsedCount(loan: Loan): number {
    const now = Date.now();
    return this.schedule(loan).filter((row) => new Date(row.dueDate).getTime() <= now).length;
  }

  // ───────── Demo seed data ─────────
  private seedPurchases(): PurchaseEntry[] {
    return [
      { id: crypto.randomUUID(), date: this.iso(4, 5), invoiceNo: 'PUR/24-25/001', supplierName: 'Rajdhani Steels', ledgerName: 'Purchase Account', inwardNo: 'IN-001', amount: 50000, gst: 9000 },
      { id: crypto.randomUUID(), date: this.iso(4, 18), invoiceNo: 'PUR/24-25/002', supplierName: 'Marwar Traders', ledgerName: 'Purchase Account', inwardNo: 'IN-002', amount: 24000, gst: 4320 },
      { id: crypto.randomUUID(), date: this.iso(5, 2), invoiceNo: 'PUR/24-25/003', supplierName: 'Jodhpur Hardware', ledgerName: 'Purchase Account', inwardNo: 'IN-003', amount: 17500, gst: 3150 }
    ];
  }
  private seedSales(): SalesEntry[] {
    return [
      { id: crypto.randomUUID(), date: this.iso(4, 8), invoiceNo: 'INV/24-25/001', customerName: 'Latiyal Enterprises', ledgerName: 'Sales Account', outwardNo: 'OUT-001', amount: 80000, gst: 14400 },
      { id: crypto.randomUUID(), date: this.iso(4, 25), invoiceNo: 'INV/24-25/002', customerName: 'Shree Ram Stores', ledgerName: 'Sales Account', outwardNo: 'OUT-002', amount: 32000, gst: 5760 },
      { id: crypto.randomUUID(), date: this.iso(5, 11), invoiceNo: 'INV/24-25/003', customerName: 'Maa Karni Agencies', ledgerName: 'Sales Account', outwardNo: 'OUT-003', amount: 45000, gst: 8100 }
    ];
  }
  private seedCash(): CashEntry[] {
    return [
      { id: crypto.randomUUID(), date: this.iso(4, 1), particulars: 'To Opening Balance', folio: '—', side: 'Receipt', discount: 0, cash: 25000, bank: 150000 },
      { id: crypto.randomUUID(), date: this.iso(4, 8), particulars: 'To Sales (Cash)', folio: 'L-12', side: 'Receipt', discount: 0, cash: 18000, bank: 0 },
      { id: crypto.randomUUID(), date: this.iso(4, 10), particulars: 'To Latiyal Enterprises', folio: 'L-04', side: 'Receipt', discount: 500, cash: 0, bank: 80000 },
      { id: crypto.randomUUID(), date: this.iso(4, 12), particulars: 'By Purchase (Cash)', folio: 'L-20', side: 'Payment', discount: 0, cash: 12000, bank: 0 },
      { id: crypto.randomUUID(), date: this.iso(4, 20), particulars: 'By Rent Paid', folio: 'L-31', side: 'Payment', discount: 0, cash: 0, bank: 25000 },
      { id: crypto.randomUUID(), date: this.iso(4, 28), particulars: 'By Salaries', folio: 'L-33', side: 'Payment', discount: 0, cash: 8000, bank: 40000 }
    ];
  }
  private seedLoans(): Loan[] {
    return [
      { id: crypto.randomUUID(), lender: 'State Bank of India — Term Loan', principal: 500000, annualRate: 11, tenureMonths: 24, startDate: this.iso(4, 1) }
    ];
  }
}
