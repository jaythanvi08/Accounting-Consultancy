import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { CompanyService } from './company.service';
import { VoucherService } from './voucher.service';
import { PurchaseInvoice, PurchaseItem, PurchaseReturn, PurchaseType, Voucher, VoucherLine } from '../models';

/**
 * Per-company store for purchase invoices, purchase returns (debit notes) and
 * cash-discount entries. Each posting also writes a voucher via VoucherService.
 * Mock backend: signals + localStorage.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly storage = inject(StorageService);
  private readonly companies = inject(CompanyService);
  private readonly vouchers = inject(VoucherService);

  private readonly _purchases = signal<PurchaseInvoice[]>([]);
  private readonly _returns = signal<PurchaseReturn[]>([]);

  readonly purchases = this._purchases.asReadonly();
  readonly returns = this._returns.asReadonly();

  private cid(): string {
    return this.companies.activeCompany()?.id ?? 'none';
  }
  private purchaseKey(): string {
    return `ledgerai.purchases.${this.cid()}`;
  }
  private returnsKey(): string {
    return `ledgerai.purchaseReturns.${this.cid()}`;
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
    const existing = this.storage.get<PurchaseInvoice[]>(this.purchaseKey());
    if (existing) {
      this._purchases.set(existing);
    } else {
      const seeded = this.seed();
      this.storage.set(this.purchaseKey(), seeded);
      this._purchases.set(seeded);
    }
    this._returns.set(this.storage.get<PurchaseReturn[]>(this.returnsKey()) ?? []);
    this.vouchers.sync();
  }

  // ─────────────── Item / total maths (trade discount on each line) ───────────────
  itemBase(it: PurchaseItem): number {
    return (it.qty || 0) * (it.rate || 0);
  }
  itemTaxable(it: PurchaseItem): number {
    return this.itemBase(it) * (1 - (it.discountPct || 0) / 100);
  }
  itemGst(it: PurchaseItem): number {
    return (this.itemTaxable(it) * (it.gstRate || 0)) / 100;
  }
  itemTotal(it: PurchaseItem): number {
    return this.itemTaxable(it) + this.itemGst(it);
  }
  totals(items: PurchaseItem[]): { subTotal: number; gstTotal: number; grandTotal: number } {
    const subTotal = items.reduce((s, it) => s + this.itemTaxable(it), 0);
    const gstTotal = items.reduce((s, it) => s + this.itemGst(it), 0);
    return { subTotal, gstTotal, grandTotal: subTotal + gstTotal };
  }

  nextInvoiceNo(type: PurchaseType): string {
    const prefix = type === 'Cash' ? 'CP' : 'CRP';
    const max = this._purchases()
      .filter((p) => p.type === type)
      .reduce((m, p) => Math.max(m, Number(p.invoiceNo.split('-').pop()) || 0), 0);
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }
  nextDebitNoteNo(): string {
    const max = this._returns().reduce((m, r) => Math.max(m, Number(r.debitNoteNo.split('-').pop()) || 0), 0);
    return `DN-${String(max + 1).padStart(4, '0')}`;
  }

  // ─────────────── Mutations ───────────────
  createPurchase(data: Omit<PurchaseInvoice, 'id' | 'createdAt' | 'subTotal' | 'gstTotal' | 'grandTotal' | 'voucherId'>): PurchaseInvoice {
    const t = this.totals(data.items);
    const voucher = this.postPurchaseVoucher(data, t);
    const invoice: PurchaseInvoice = {
      ...data,
      ...t,
      id: crypto.randomUUID(),
      voucherId: voucher?.id,
      createdAt: new Date().toISOString()
    };
    this._purchases.update((list) => [...list, invoice]);
    this.storage.set(this.purchaseKey(), this._purchases());
    return invoice;
  }

  createReturn(data: Omit<PurchaseReturn, 'id' | 'createdAt' | 'subTotal' | 'gstTotal' | 'grandTotal' | 'voucherId'>): PurchaseReturn {
    const t = this.totals(data.items);
    const voucher = this.postReturnVoucher(data, t);
    const ret: PurchaseReturn = {
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

  deletePurchase(id: string): void {
    this._purchases.update((list) => list.filter((p) => p.id !== id));
    this.storage.set(this.purchaseKey(), this._purchases());
  }
  deleteReturn(id: string): void {
    this._returns.update((list) => list.filter((r) => r.id !== id));
    this.storage.set(this.returnsKey(), this._returns());
  }

  /** Record a cash discount received on settling a creditor: Dr Creditor / Cr Bank + Discount Received. */
  recordCashDiscount(creditor: string, gross: number, discount: number, date: string): Voucher | null {
    const net = gross - discount;
    const lines: VoucherLine[] = [{ ledgerId: '', ledgerName: creditor || 'Sundry Creditors', type: 'Dr', amount: gross }];
    if (net > 0) {
      lines.push({ ledgerId: '', ledgerName: 'Bank', type: 'Cr', amount: net });
    }
    if (discount > 0) {
      lines.push({ ledgerId: '', ledgerName: 'Discount Received', type: 'Cr', amount: discount });
    }
    return this.vouchers.create({
      voucherType: 'Payment',
      voucherNo: this.vouchers.nextVoucherNo('Payment'),
      date: new Date(date).toISOString(),
      narration: `Paid ${creditor || 'creditor'} ₹${net.toFixed(2)} with cash discount ₹${discount.toFixed(2)}`,
      lines,
      totalDebit: gross,
      totalCredit: gross
    });
  }

  // ─────────────── Voucher posting ───────────────
  private postPurchaseVoucher(
    data: Pick<PurchaseInvoice, 'type' | 'date' | 'supplierName' | 'paymentMode' | 'creditorLedger' | 'narration'>,
    t: { subTotal: number; gstTotal: number; grandTotal: number }
  ): Voucher | null {
    const lines: VoucherLine[] = [{ ledgerId: '', ledgerName: 'Purchase', type: 'Dr', amount: t.subTotal }];
    if (t.gstTotal > 0) {
      lines.push({ ledgerId: '', ledgerName: 'GST Input Tax', type: 'Dr', amount: t.gstTotal });
    }
    const credit = data.type === 'Cash' ? (data.paymentMode === 'Cash' ? 'Cash' : 'Bank') : data.creditorLedger || data.supplierName;
    lines.push({ ledgerId: '', ledgerName: credit, type: 'Cr', amount: t.grandTotal });
    return this.vouchers.create({
      voucherType: 'Purchase',
      voucherNo: this.vouchers.nextVoucherNo('Purchase'),
      date: new Date(data.date).toISOString(),
      narration: data.narration || `${data.type} purchase from ${data.supplierName}`,
      lines,
      totalDebit: t.grandTotal,
      totalCredit: t.grandTotal
    });
  }

  private postReturnVoucher(
    data: Pick<PurchaseReturn, 'date' | 'supplierName' | 'originalInvoiceNo'>,
    t: { subTotal: number; gstTotal: number; grandTotal: number }
  ): Voucher | null {
    const lines: VoucherLine[] = [{ ledgerId: '', ledgerName: data.supplierName || 'Sundry Creditors', type: 'Dr', amount: t.grandTotal }];
    lines.push({ ledgerId: '', ledgerName: 'Purchase Return', type: 'Cr', amount: t.subTotal });
    if (t.gstTotal > 0) {
      lines.push({ ledgerId: '', ledgerName: 'GST Input Tax', type: 'Cr', amount: t.gstTotal });
    }
    return this.vouchers.create({
      voucherType: 'Journal',
      voucherNo: this.vouchers.nextVoucherNo('Journal'),
      date: new Date(data.date).toISOString(),
      narration: `Purchase return (debit note) against ${data.originalInvoiceNo} to ${data.supplierName}`,
      lines,
      totalDebit: t.grandTotal,
      totalCredit: t.grandTotal
    });
  }

  // ─────────────── Demo seed ───────────────
  private seed(): PurchaseInvoice[] {
    const mk = (
      invoiceNo: string,
      m: number,
      d: number,
      supplier: string,
      type: PurchaseType,
      items: PurchaseItem[],
      extra: Partial<PurchaseInvoice> = {}
    ): PurchaseInvoice => {
      const t = this.totals(items);
      return {
        id: crypto.randomUUID(),
        invoiceNo,
        date: this.iso(m, d),
        supplierName: supplier,
        type,
        items,
        ...t,
        createdAt: new Date().toISOString(),
        ...extra
      };
    };
    return [
      mk('CP-0001', 4, 5, 'Rajdhani Steels', 'Cash', [{ name: 'TMT Bars', qty: 50, rate: 1000, discountPct: 5, gstRate: 18 }], { paymentMode: 'Cheque' }),
      mk('CRP-0001', 4, 18, 'Marwar Traders', 'Credit', [{ name: 'Cement', qty: 200, rate: 320, discountPct: 2, gstRate: 28 }], { creditorLedger: 'Marwar Traders', creditPeriodDays: 30 }),
      mk('CP-0002', 5, 2, 'Jodhpur Hardware', 'Cash', [{ name: 'Fittings', qty: 80, rate: 250, discountPct: 0, gstRate: 18 }], { paymentMode: 'Cash' })
    ];
  }
}
