import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { CompanyService } from './company.service';
import { VoucherService } from './voucher.service';
import { AssetAccount, DepYearRow, Voucher, VoucherLine } from '../models';

export interface DisposalInput {
  mode: 'Sold' | 'Scrapped';
  date: string; // ISO
  value: number; // sale proceeds (0 for scrapped)
}

/**
 * Per-company store for fixed-asset accounts (Module 7). Computes SLM / WDV
 * depreciation and posts depreciation & disposal journal entries through the
 * VoucherService. Mock backend: signals + localStorage.
 */
@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly storage = inject(StorageService);
  private readonly companies = inject(CompanyService);
  private readonly vouchers = inject(VoucherService);

  private readonly _assets = signal<AssetAccount[]>([]);
  readonly assets = this._assets.asReadonly();

  private cid(): string {
    return this.companies.activeCompany()?.id ?? 'none';
  }
  private key(): string {
    return `ledgerai.assets.${this.cid()}`;
  }

  sync(): void {
    this._assets.set(this.storage.get<AssetAccount[]>(this.key()) ?? []);
    this.vouchers.sync();
  }

  getById(id: string): AssetAccount | undefined {
    return this._assets().find((a) => a.id === id);
  }

  create(data: Omit<AssetAccount, 'id' | 'createdAt' | 'status' | 'postedYears'>): AssetAccount {
    const asset: AssetAccount = {
      ...data,
      id: crypto.randomUUID(),
      status: 'Active',
      postedYears: 0,
      createdAt: new Date().toISOString()
    };
    this._assets.update((list) => [...list, asset]);
    this.persist();
    return asset;
  }

  update(id: string, patch: Partial<AssetAccount>): void {
    this._assets.update((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    this.persist();
  }

  delete(id: string): void {
    this._assets.update((list) => list.filter((a) => a.id !== id));
    this.persist();
  }

  // ─────────────── Depreciation engine ───────────────
  /** Year-by-year schedule; empty for Land / non-depreciable assets. */
  schedule(asset: AssetAccount): DepYearRow[] {
    if (asset.method === 'None' || asset.type === 'Land' || asset.usefulLife <= 0) {
      return [];
    }
    const rows: DepYearRow[] = [];
    let opening = asset.cost;
    const residual = asset.residualValue || 0;

    for (let year = 1; year <= asset.usefulLife; year++) {
      let dep =
        asset.method === 'SLM'
          ? (asset.cost - residual) / asset.usefulLife
          : (opening * asset.rate) / 100;

      if (opening - dep < residual) {
        dep = Math.max(0, opening - residual); // never depreciate below residual
      }
      const closing = opening - dep;
      rows.push({ year, opening, depreciation: dep, closing });
      opening = closing;
    }
    return rows;
  }

  /** Depreciation accumulated through the entries already posted. */
  accumulatedDepreciation(asset: AssetAccount): number {
    return this.schedule(asset)
      .slice(0, asset.postedYears)
      .reduce((sum, r) => sum + r.depreciation, 0);
  }

  bookValue(asset: AssetAccount): number {
    return asset.cost - this.accumulatedDepreciation(asset);
  }

  /** Depreciation for the next un-posted year (0 if none / fully posted). */
  nextYearDepreciation(asset: AssetAccount): number {
    return this.schedule(asset)[asset.postedYears]?.depreciation ?? 0;
  }

  /** Effective annual rate shown in the register. */
  effectiveRate(asset: AssetAccount): number {
    if (asset.method === 'WDV') {
      return asset.rate;
    }
    if (asset.method === 'SLM' && asset.usefulLife > 0) {
      const base = asset.cost - (asset.residualValue || 0);
      return base > 0 ? (((asset.cost - (asset.residualValue || 0)) / asset.usefulLife) / base) * 100 : 0;
    }
    return 0;
  }

  // ─────────────── Posting journal entries ───────────────
  /** Post the next year's depreciation as a Journal voucher. Returns the voucher, or null. */
  postDepreciation(assetId: string): Voucher | null {
    const asset = this.getById(assetId);
    if (!asset || asset.status !== 'Active') {
      return null;
    }
    const sched = this.schedule(asset);
    if (asset.postedYears >= sched.length) {
      return null; // fully depreciated or non-depreciable
    }
    const row = sched[asset.postedYears];
    const amount = Math.round(row.depreciation * 100) / 100;
    if (amount <= 0) {
      return null;
    }

    const lines: VoucherLine[] = [
      { ledgerId: '', ledgerName: 'Depreciation', type: 'Dr', amount },
      { ledgerId: '', ledgerName: asset.name, type: 'Cr', amount }
    ];
    const voucher = this.vouchers.create({
      voucherType: 'Journal',
      voucherNo: this.vouchers.nextVoucherNo('Journal'),
      date: new Date().toISOString(),
      narration: `Depreciation on ${asset.name} for year ${row.year} (${asset.method})`,
      lines,
      totalDebit: amount,
      totalCredit: amount
    });
    this.update(assetId, { postedYears: asset.postedYears + 1 });
    return voucher;
  }

  /** Record disposal (sale/scrap) and post the journal entry. Returns the voucher, or null. */
  dispose(assetId: string, input: DisposalInput): Voucher | null {
    const asset = this.getById(assetId);
    if (!asset || asset.status !== 'Active') {
      return null;
    }
    const book = Math.round(this.bookValue(asset) * 100) / 100;
    const proceeds = input.mode === 'Sold' ? Math.round(input.value * 100) / 100 : 0;
    const lines: VoucherLine[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    const addDr = (name: string, amount: number) => {
      if (amount > 0) {
        lines.push({ ledgerId: '', ledgerName: name, type: 'Dr', amount });
        totalDebit += amount;
      }
    };
    const addCr = (name: string, amount: number) => {
      if (amount > 0) {
        lines.push({ ledgerId: '', ledgerName: name, type: 'Cr', amount });
        totalCredit += amount;
      }
    };

    // Asset is credited at its book value (removed from the books)
    addCr(asset.name, book);

    if (input.mode === 'Sold') {
      addDr('Bank', proceeds);
      const diff = proceeds - book; // +profit / -loss
      if (diff > 0) {
        addCr('Profit on Sale of Asset', diff);
      } else if (diff < 0) {
        addDr('Loss on Sale of Asset', -diff);
      }
    } else {
      // Scrapped: entire book value is a loss
      addDr('Loss on Scrap of Asset', book);
    }

    const voucher = this.vouchers.create({
      voucherType: 'Journal',
      voucherNo: this.vouchers.nextVoucherNo('Journal'),
      date: new Date(input.date).toISOString(),
      narration: `${input.mode} ${asset.name} (book value ₹${book.toFixed(2)}${input.mode === 'Sold' ? `, proceeds ₹${proceeds.toFixed(2)}` : ''})`,
      lines,
      totalDebit,
      totalCredit
    });

    this.update(assetId, {
      status: input.mode,
      disposalDate: new Date(input.date).toISOString(),
      disposalValue: proceeds
    });
    return voucher;
  }

  private persist(): void {
    this.storage.set(this.key(), this._assets());
  }
}
