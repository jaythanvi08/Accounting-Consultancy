import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { CompanyService } from './company.service';
import { VoucherService } from './voucher.service';
import { SaleInvoice, SaleItem, SaleType, SalesReturn, StockInfo, Voucher, VoucherLine } from '../models';

/**
 * Per-company store for sales invoices, returns and the stock figures used by
 * COGS. Posting a sale/return also writes a voucher through VoucherService.
 * Mock backend: signals + localStorage.
 */
@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly storage = inject(StorageService);
  private readonly companies = inject(CompanyService);
  private readonly vouchers = inject(VoucherService);

  private readonly _sales = signal<SaleInvoice[]>([]);
  private readonly _returns = signal<SalesReturn[]>([]);
  private readonly _stock = signal<StockInfo>({ opening: 0, closing: 0 });

  readonly sales = this._sales.asReadonly();
  readonly returns = this._returns.asReadonly();
  readonly stock = this._stock.asReadonly();

  private cid(): string {
    return this.companies.activeCompany()?.id ?? 'none';
  }
  private salesKey(): string {
    return `ledgerai.sales.${this.cid()}`;
  }
  private returnsKey(): string {
    return `ledgerai.salesReturns.${this.cid()}`;
  }
  private stockKey(): string {
    return `ledgerai.stock.${this.cid()}`;
  }

  private fyYear(): number {
    const fy = this.companies.activeCompany()?.financialYearStart;
    const d = fy ? new Date(fy) : new Date();
    return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  }
  private iso(month: number, day: number): string {
    return new Date(this.fyYear(), month - 1, day).toISOString();
  }

  sync(): void {
    const existing = this.storage.get<SaleInvoice[]>(this.salesKey());
    if (existing) {
      this._sales.set(existing);
    } else {
      const seeded = this.seedSales();
      this.storage.set(this.salesKey(), seeded);
      this._sales.set(seeded);
    }
    this._returns.set(this.storage.get<SalesReturn[]>(this.returnsKey()) ?? []);
    this._stock.set(this.storage.get<StockInfo>(this.stockKey()) ?? { opening: 120000, closing: 95000 });
    this.vouchers.sync();
  }

  // ─────────────── Item / total maths ───────────────
  itemAmount(it: SaleItem): number {
    return (it.qty || 0) * (it.rate || 0);
  }
  itemGst(it: SaleItem): number {
    return (this.itemAmount(it) * (it.gstRate || 0)) / 100;
  }
  itemTotal(it: SaleItem): number {
    return this.itemAmount(it) + this.itemGst(it);
  }
  totals(items: SaleItem[]): { subTotal: number; gstTotal: number; grandTotal: number } {
    const subTotal = items.reduce((s, it) => s + this.itemAmount(it), 0);
    const gstTotal = items.reduce((s, it) => s + this.itemGst(it), 0);
    return { subTotal, gstTotal, grandTotal: subTotal + gstTotal };
  }

  nextInvoiceNo(type: SaleType): string {
    const prefix = type === 'Cash' ? 'CS' : 'CR';
    const max = this._sales()
      .filter((s) => s.type === type)
      .reduce((m, s) => Math.max(m, Number(s.invoiceNo.split('-').pop()) || 0), 0);
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }
  nextReturnNo(): string {
    const max = this._returns().reduce((m, r) => Math.max(m, Number(r.returnNo.split('-').pop()) || 0), 0);
    return `SR-${String(max + 1).padStart(4, '0')}`;
  }

  // ─────────────── Mutations ───────────────
  createSale(data: Omit<SaleInvoice, 'id' | 'createdAt' | 'subTotal' | 'gstTotal' | 'grandTotal' | 'voucherId'>): SaleInvoice {
    const t = this.totals(data.items);
    const id = crypto.randomUUID();
    const voucher = this.postSaleVoucher(data, t);
    const invoice: SaleInvoice = {
      ...data,
      ...t,
      id,
      voucherId: voucher?.id,
      createdAt: new Date().toISOString()
    };
    this._sales.update((list) => [...list, invoice]);
    this.storage.set(this.salesKey(), this._sales());
    return invoice;
  }

  createReturn(data: Omit<SalesReturn, 'id' | 'createdAt' | 'subTotal' | 'gstTotal' | 'grandTotal' | 'voucherId'>): SalesReturn {
    const t = this.totals(data.items);
    const voucher = this.postReturnVoucher(data, t);
    const ret: SalesReturn = {
      ...data,
      ...t,
      id: crypto.randomUUID(),
      voucherId: voucher?.id,
      createdAt: new Date().toISOString()
    };
    this._returns.update((list) => [...list, ret]);
    this.storage.set(this.returnsKey(), this._returns());
    return ret;
  }

  deleteSale(id: string): void {
    this._sales.update((list) => list.filter((s) => s.id !== id));
    this.storage.set(this.salesKey(), this._sales());
  }
  deleteReturn(id: string): void {
    this._returns.update((list) => list.filter((r) => r.id !== id));
    this.storage.set(this.returnsKey(), this._returns());
  }

  setStock(info: StockInfo): void {
    this._stock.set(info);
    this.storage.set(this.stockKey(), info);
  }

  // ─────────────── Voucher posting ───────────────
  private postSaleVoucher(
    data: Pick<SaleInvoice, 'type' | 'date' | 'customerName' | 'paymentMode' | 'debtorLedger' | 'narration'>,
    t: { subTotal: number; gstTotal: number; grandTotal: number }
  ): Voucher | null {
    const lines: VoucherLine[] = [];
    const debit = data.type === 'Cash' ? (data.paymentMode === 'Cash' ? 'Cash' : 'Bank') : data.debtorLedger || data.customerName;
    lines.push({ ledgerId: '', ledgerName: debit, type: 'Dr', amount: t.grandTotal });
    lines.push({ ledgerId: '', ledgerName: 'Sales', type: 'Cr', amount: t.subTotal });
    if (t.gstTotal > 0) {
      lines.push({ ledgerId: '', ledgerName: 'GST Payable', type: 'Cr', amount: t.gstTotal });
    }
    return this.vouchers.create({
      voucherType: 'Sales',
      voucherNo: this.vouchers.nextVoucherNo('Sales'),
      date: new Date(data.date).toISOString(),
      narration: data.narration || `${data.type} sale to ${data.customerName}`,
      lines,
      totalDebit: t.grandTotal,
      totalCredit: t.grandTotal
    });
  }

  private postReturnVoucher(
    data: Pick<SalesReturn, 'date' | 'customerName' | 'originalInvoiceNo'>,
    t: { subTotal: number; gstTotal: number; grandTotal: number }
  ): Voucher | null {
    const lines: VoucherLine[] = [{ ledgerId: '', ledgerName: 'Sales Return', type: 'Dr', amount: t.subTotal }];
    if (t.gstTotal > 0) {
      lines.push({ ledgerId: '', ledgerName: 'GST Payable', type: 'Dr', amount: t.gstTotal });
    }
    lines.push({ ledgerId: '', ledgerName: data.customerName || 'Sundry Debtors', type: 'Cr', amount: t.grandTotal });
    return this.vouchers.create({
      voucherType: 'Journal',
      voucherNo: this.vouchers.nextVoucherNo('Journal'),
      date: new Date(data.date).toISOString(),
      narration: `Sales return against ${data.originalInvoiceNo} from ${data.customerName}`,
      lines,
      totalDebit: t.grandTotal,
      totalCredit: t.grandTotal
    });
  }

  // ─────────────── Demo seed ───────────────
  private seedSales(): SaleInvoice[] {
    const mk = (
      invoiceNo: string,
      m: number,
      d: number,
      customer: string,
      type: SaleType,
      items: SaleItem[],
      extra: Partial<SaleInvoice> = {}
    ): SaleInvoice => {
      const t = this.totals(items);
      return {
        id: crypto.randomUUID(),
        invoiceNo,
        date: this.iso(m, d),
        customerName: customer,
        type,
        items,
        ...t,
        createdAt: new Date().toISOString(),
        ...extra
      };
    };
    return [
      mk('CS-0001', 4, 6, 'Walk-in Customer', 'Cash', [{ name: 'Steel Rod 12mm', qty: 20, rate: 600, gstRate: 18 }], { paymentMode: 'UPI' }),
      mk('CR-0001', 4, 14, 'Latiyal Enterprises', 'Credit', [{ name: 'Cement Bag', qty: 100, rate: 380, gstRate: 28 }], { debtorLedger: 'Latiyal Enterprises', creditPeriodDays: 30 }),
      mk('CS-0002', 5, 3, 'Walk-in Customer', 'Cash', [{ name: 'Paint 20L', qty: 10, rate: 2200, gstRate: 18 }], { paymentMode: 'Card' }),
      mk('CR-0002', 5, 22, 'Shree Ram Stores', 'Credit', [{ name: 'Plywood Sheet', qty: 40, rate: 1500, gstRate: 18 }], { debtorLedger: 'Shree Ram Stores', creditPeriodDays: 45 })
    ];
  }
}
