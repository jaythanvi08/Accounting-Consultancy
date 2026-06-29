import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { CompanyService } from './company.service';
import {
  StockItem,
  StockRegisterRow,
  StockSummaryRow,
  StockTxn,
  StockValuationMethod
} from '../models';

interface Lot {
  qty: number;
  rate: number;
}

const SLOW_MOVING_DAYS = 90;

/**
 * Per-company inventory store: item master, stock movements and the chosen
 * valuation method. Computes FIFO / LIFO / Weighted-Average registers, closing
 * value, and low-stock / slow-moving reports. Mock backend: signals + localStorage.
 */
@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly storage = inject(StorageService);
  private readonly companies = inject(CompanyService);

  private readonly _items = signal<StockItem[]>([]);
  private readonly _txns = signal<StockTxn[]>([]);
  private readonly _method = signal<StockValuationMethod>('FIFO');

  readonly items = this._items.asReadonly();
  readonly txns = this._txns.asReadonly();
  readonly method = this._method.asReadonly();

  private cid(): string {
    return this.companies.activeCompany()?.id ?? 'none';
  }
  private itemsKey(): string {
    return `ledgerai.stockItems.${this.cid()}`;
  }
  private txnsKey(): string {
    return `ledgerai.stockTxns.${this.cid()}`;
  }
  private methodKey(): string {
    return `ledgerai.stockMethod.${this.cid()}`;
  }

  /** Inventory features are only available when the company maintains stock. */
  inventoryEnabled(): boolean {
    return this.companies.activeCompany()?.maintain === 'Accounts with Inventory';
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
    const items = this.storage.get<StockItem[]>(this.itemsKey());
    if (items) {
      this._items.set(items);
      this._txns.set(this.storage.get<StockTxn[]>(this.txnsKey()) ?? []);
    } else {
      const seeded = this.seedItems();
      this._items.set(seeded);
      this.storage.set(this.itemsKey(), seeded);
      const txns = this.seedTxns(seeded);
      this._txns.set(txns);
      this.storage.set(this.txnsKey(), txns);
    }
    this._method.set(this.storage.get<StockValuationMethod>(this.methodKey()) ?? 'FIFO');
  }

  getItem(id: string): StockItem | undefined {
    return this._items().find((i) => i.id === id);
  }

  setMethod(method: StockValuationMethod): void {
    this._method.set(method);
    this.storage.set(this.methodKey(), method);
  }

  // ─────────────── Item master ───────────────
  createItem(data: Omit<StockItem, 'id' | 'createdAt'>): StockItem {
    const item: StockItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this._items.update((list) => [...list, item]);
    this.storage.set(this.itemsKey(), this._items());
    return item;
  }
  updateItem(id: string, patch: Partial<StockItem>): void {
    this._items.update((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    this.storage.set(this.itemsKey(), this._items());
  }
  deleteItem(id: string): void {
    this._items.update((list) => list.filter((i) => i.id !== id));
    this._txns.update((list) => list.filter((t) => t.itemId !== id));
    this.storage.set(this.itemsKey(), this._items());
    this.storage.set(this.txnsKey(), this._txns());
  }

  // ─────────────── Transactions ───────────────
  addTxn(data: Omit<StockTxn, 'id' | 'createdAt'>): StockTxn {
    const txn: StockTxn = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this._txns.update((list) => [...list, txn]);
    this.storage.set(this.txnsKey(), this._txns());
    return txn;
  }
  deleteTxn(id: string): void {
    this._txns.update((list) => list.filter((t) => t.id !== id));
    this.storage.set(this.txnsKey(), this._txns());
  }

  txnsForItem(itemId: string): StockTxn[] {
    return this._txns()
      .filter((t) => t.itemId === itemId)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  // ─────────────── Valuation engine ───────────────
  register(itemId: string, method: StockValuationMethod = this._method()): StockRegisterRow[] {
    const item = this.getItem(itemId);
    if (!item) {
      return [];
    }
    const rows: StockRegisterRow[] = [];
    const lots: Lot[] = [];
    let balQty = 0;
    let balValue = 0;

    const openingDate = this.companies.activeCompany()?.financialYearStart ?? item.createdAt;
    if (item.openingQty > 0) {
      lots.push({ qty: item.openingQty, rate: item.openingRate });
      balQty = item.openingQty;
      balValue = item.openingQty * item.openingRate;
      rows.push(this.row(openingDate, 'Opening Balance', balQty, item.openingRate, balValue, 0, 0, 0, balQty, balValue, item.openingRate));
    }

    for (const t of this.txnsForItem(itemId)) {
      if (t.direction === 'In') {
        const value = t.qty * t.rate;
        lots.push({ qty: t.qty, rate: t.rate });
        balQty += t.qty;
        balValue += value;
        const balRate = balQty > 0 ? balValue / balQty : 0;
        rows.push(this.row(t.date, t.particulars, t.qty, t.rate, value, 0, 0, 0, balQty, balValue, balRate));
      } else {
        const { outValue, outRate } = this.consume(lots, t.qty, balQty, balValue, method);
        balQty -= t.qty;
        balValue -= outValue;
        if (balValue < 0) {
          balValue = 0;
        }
        const balRate = balQty > 0 ? balValue / balQty : 0;
        rows.push(this.row(t.date, t.particulars, 0, 0, 0, t.qty, outRate, outValue, balQty, balValue, balRate));
      }
    }
    return rows;
  }

  /** Consume `qty` from lots per method; returns the cost of goods issued. */
  private consume(
    lots: Lot[],
    qty: number,
    balQty: number,
    balValue: number,
    method: StockValuationMethod
  ): { outValue: number; outRate: number } {
    if (method === 'WAC') {
      const avg = balQty > 0 ? balValue / balQty : 0;
      // proportionally shrink lots so future avg stays consistent
      const ratio = balQty > 0 ? Math.max(0, balQty - qty) / balQty : 0;
      for (const lot of lots) {
        lot.qty *= ratio;
      }
      return { outValue: qty * avg, outRate: avg };
    }

    let remaining = qty;
    let outValue = 0;
    const take = (lot: Lot) => {
      const used = Math.min(lot.qty, remaining);
      outValue += used * lot.rate;
      lot.qty -= used;
      remaining -= used;
    };

    if (method === 'FIFO') {
      for (const lot of lots) {
        if (remaining <= 0) {
          break;
        }
        take(lot);
      }
    } else {
      // LIFO — newest first
      for (let i = lots.length - 1; i >= 0 && remaining > 0; i--) {
        take(lots[i]);
      }
    }
    // drop emptied lots
    for (let i = lots.length - 1; i >= 0; i--) {
      if (lots[i].qty <= 0.000001) {
        lots.splice(i, 1);
      }
    }
    const outRate = qty > 0 ? outValue / qty : 0;
    return { outValue, outRate };
  }

  private row(
    date: string,
    particulars: string,
    inQty: number,
    inRate: number,
    inValue: number,
    outQty: number,
    outRate: number,
    outValue: number,
    balQty: number,
    balValue: number,
    balRate: number
  ): StockRegisterRow {
    return { date, particulars, inQty, inRate, inValue, outQty, outRate, outValue, balQty, balRate, balValue };
  }

  /** Closing position for an item under the current method. */
  closing(itemId: string, method: StockValuationMethod = this._method()): { qty: number; rate: number; value: number } {
    const rows = this.register(itemId, method);
    const last = rows[rows.length - 1];
    return last ? { qty: last.balQty, rate: last.balRate, value: last.balValue } : { qty: 0, rate: 0, value: 0 };
  }

  /** Item-wise summary with low-stock & slow-moving flags. */
  summary(method: StockValuationMethod = this._method()): StockSummaryRow[] {
    const now = Date.now();
    return this._items().map((item) => {
      const c = this.closing(item.id, method);
      const txns = this.txnsForItem(item.id);
      const last = txns[txns.length - 1]?.date;
      const lastMs = last ? new Date(last).getTime() : new Date(item.createdAt).getTime();
      const reorder = item.reorderLevel ?? 0;
      return {
        item,
        balQty: c.qty,
        balRate: c.rate,
        balValue: c.value,
        reorderLevel: reorder,
        lowStock: c.qty <= reorder,
        lastMovement: last,
        slowMoving: c.qty > 0 && now - lastMs > SLOW_MOVING_DAYS * 86_400_000
      };
    });
  }

  /** Total closing-stock value (for the Balance Sheet). */
  totalValuation(method: StockValuationMethod = this._method()): number {
    return this._items().reduce((s, i) => s + this.closing(i.id, method).value, 0);
  }

  // ─────────────── Demo seed ───────────────
  private seedItems(): StockItem[] {
    return [
      { id: crypto.randomUUID(), name: 'TMT Steel Bar 12mm', code: 'TMT12', category: 'Raw Material', unit: 'Kg', gstRate: 18, hsnCode: '7214', openingQty: 500, openingRate: 55, reorderLevel: 200, reorderQty: 500, createdAt: this.iso(4, 1) },
      { id: crypto.randomUUID(), name: 'Cement Bag 50kg', code: 'CEM50', category: 'Raw Material', unit: 'Bag', gstRate: 28, hsnCode: '2523', openingQty: 120, openingRate: 360, reorderLevel: 50, reorderQty: 200, createdAt: this.iso(4, 1) },
      { id: crypto.randomUUID(), name: 'Wall Paint 20L', code: 'PNT20', category: 'Finished Goods', unit: 'Can', gstRate: 18, hsnCode: '3209', openingQty: 30, openingRate: 1800, reorderLevel: 15, reorderQty: 40, createdAt: this.iso(4, 1) }
    ];
  }
  private seedTxns(items: StockItem[]): StockTxn[] {
    const [tmt, cement, paint] = items;
    const mk = (item: StockItem, m: number, d: number, dir: 'In' | 'Out', qty: number, rate: number, particulars: string): StockTxn => ({
      id: crypto.randomUUID(),
      itemId: item.id,
      date: this.iso(m, d),
      direction: dir,
      qty,
      rate,
      particulars,
      createdAt: new Date().toISOString()
    });
    const out: StockTxn[] = [];
    if (tmt) {
      out.push(mk(tmt, 4, 6, 'In', 300, 58, 'Purchase'), mk(tmt, 4, 20, 'Out', 400, 0, 'Sales'), mk(tmt, 5, 4, 'In', 200, 60, 'Purchase'));
    }
    if (cement) {
      out.push(mk(cement, 4, 10, 'In', 200, 365, 'Purchase'), mk(cement, 4, 25, 'Out', 250, 0, 'Sales'));
    }
    if (paint) {
      out.push(mk(paint, 4, 12, 'Out', 20, 0, 'Sales'));
    }
    return out;
  }
}
