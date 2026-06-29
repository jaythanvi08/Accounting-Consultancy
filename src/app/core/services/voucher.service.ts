import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { CompanyService } from './company.service';
import { VOUCHER_META } from '../constants/vouchers';
import { Voucher, VoucherType } from '../models';

/**
 * Per-company store for accounting vouchers (Module 6). Mock backend:
 * signals + localStorage (`ledgerai.vouchers.<companyId>`). Call {@link sync}
 * from a feature component before reading.
 */
@Injectable({ providedIn: 'root' })
export class VoucherService {
  private readonly storage = inject(StorageService);
  private readonly companies = inject(CompanyService);

  private readonly _vouchers = signal<Voucher[]>([]);
  readonly vouchers = this._vouchers.asReadonly();

  private cid(): string {
    return this.companies.activeCompany()?.id ?? 'none';
  }
  private key(): string {
    return `ledgerai.vouchers.${this.cid()}`;
  }

  sync(): void {
    this._vouchers.set(this.storage.get<Voucher[]>(this.key()) ?? []);
  }

  getById(id: string): Voucher | undefined {
    return this._vouchers().find((v) => v.id === id);
  }

  /** Next sequential voucher number for a type, e.g. "JV-0004". */
  nextVoucherNo(type: VoucherType): string {
    const prefix = VOUCHER_META[type].prefix;
    const maxSeq = this._vouchers()
      .filter((v) => v.voucherType === type)
      .reduce((max, v) => {
        const n = Number(v.voucherNo.split('-').pop());
        return Number.isNaN(n) ? max : Math.max(max, n);
      }, 0);
    return `${prefix}-${String(maxSeq + 1).padStart(4, '0')}`;
  }

  create(data: Omit<Voucher, 'id' | 'createdAt'>): Voucher {
    const voucher: Voucher = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this._vouchers.update((list) => [...list, voucher]);
    this.persist();
    return voucher;
  }

  update(id: string, patch: Partial<Voucher>): void {
    this._vouchers.update((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    this.persist();
  }

  delete(id: string): void {
    this._vouchers.update((list) => list.filter((v) => v.id !== id));
    this.persist();
  }

  /** Filter by date range (inclusive) and voucher type ('All' = any). */
  filter(from: string, to: string, type: 'All' | VoucherType): Voucher[] {
    return this._vouchers()
      .filter((v) => type === 'All' || v.voucherType === type)
      .filter((v) => this.inRange(v.date, from, to))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  private inRange(isoDate: string, from: string, to: string): boolean {
    const t = new Date(isoDate).getTime();
    if (from && t < new Date(from).getTime()) {
      return false;
    }
    if (to && t > new Date(to).getTime() + 86_399_000) {
      return false;
    }
    return true;
  }

  private persist(): void {
    this.storage.set(this.key(), this._vouchers());
  }
}
