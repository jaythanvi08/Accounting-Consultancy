import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AssetService } from '../../core/services/asset.service';
import { UiService } from '../../core/services/ui.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { AssetAccount } from '../../core/models';

interface AssetRow {
  asset: AssetAccount;
  annualDep: number;
  accumulated: number;
  bookValue: number;
  rate: number;
  canDepreciate: boolean;
}

@Component({
  selector: 'app-asset-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, RouterLink, PageHeaderComponent, IndianNumberPipe],
  styles: [
    `
      .amt { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
      .status-Active { background: rgba(26, 122, 74, 0.12); color: var(--success); }
      .status-Sold { background: rgba(46, 95, 138, 0.12); color: var(--info); }
      .status-Scrapped { background: rgba(178, 34, 34, 0.12); color: var(--danger); }
      .modal-backdrop-c { position: fixed; inset: 0; background: rgba(15, 34, 56, 0.45); display: grid; place-items: center; z-index: 1060; padding: 1rem; }
      .modal-card { background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; max-width: 460px; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
      @media (max-width: 720px) { .summary { grid-template-columns: 1fr 1fr; } }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header title="Asset Register" subtitle="Fixed assets, depreciation & disposal" icon="bi-buildings">
        <a routerLink="/app/accounts/create" class="btn btn-primary btn-sm"><i class="bi bi-plus-lg me-1"></i>New Asset</a>
      </app-page-header>

      <!-- Summary -->
      <div class="summary">
        <div class="p-3 rounded bg-soft-primary"><div class="small text-secondary">Total Cost</div><div class="h6 mono mb-0">₹{{ totals().cost | indianNumber: 0 }}</div></div>
        <div class="p-3 rounded bg-soft-danger"><div class="small text-secondary">Accumulated Dep.</div><div class="h6 mono mb-0">₹{{ totals().acc | indianNumber: 0 }}</div></div>
        <div class="p-3 rounded bg-soft-success"><div class="small text-secondary">Net Book Value</div><div class="h6 mono mb-0">₹{{ totals().book | indianNumber: 0 }}</div></div>
        <div class="p-3 rounded bg-soft-accent"><div class="small text-secondary">Active Assets</div><div class="h6 mono mb-0">{{ totals().active }}</div></div>
      </div>

      <div class="card">
        <div class="card-body">
          @if (rows().length === 0) {
            <div class="text-center text-muted py-5">
              <i class="bi bi-buildings fs-1 d-block mb-2"></i>No asset accounts yet. Click <strong>New Asset</strong> to add one.
            </div>
          } @else {
            <div class="table-responsive">
              <table class="table table-hover table-bordered align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Asset Name</th><th>Type</th><th>Purchase Date</th><th class="text-end">Cost</th>
                    <th>Method</th><th class="text-end">Rate</th><th class="text-end">Annual Dep.</th>
                    <th class="text-end">Accum. Dep.</th><th class="text-end">Book Value</th><th class="text-center">Status</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of rows(); track r.asset.id) {
                    <tr>
                      <td class="fw-medium">{{ r.asset.name }}</td>
                      <td>{{ r.asset.type }}</td>
                      <td>{{ r.asset.purchaseDate | date: 'dd/MM/yyyy' }}</td>
                      <td class="amt">{{ r.asset.cost | indianNumber }}</td>
                      <td>{{ r.asset.method }}</td>
                      <td class="amt">{{ r.canDepreciate ? (r.rate | number: '1.0-2') + '%' : '—' }}</td>
                      <td class="amt">{{ r.canDepreciate ? (r.annualDep | indianNumber) : '—' }}</td>
                      <td class="amt">{{ r.accumulated | indianNumber }}</td>
                      <td class="amt fw-semibold">{{ r.bookValue | indianNumber }}</td>
                      <td class="text-center"><span class="badge status-{{ r.asset.status }}">{{ r.asset.status }}</span></td>
                      <td class="text-center text-nowrap">
                        @if (r.asset.status === 'Active') {
                          <button class="btn btn-sm btn-outline-success py-0" title="Calculate Depreciation"
                                  [disabled]="!r.canDepreciate" (click)="calcDep(r.asset)"><i class="bi bi-calculator"></i></button>
                          <button class="btn btn-sm btn-outline-warning py-0 ms-1" title="Dispose" (click)="openDisposal(r.asset)"><i class="bi bi-box-arrow-right"></i></button>
                          <button class="btn btn-sm btn-outline-primary py-0 ms-1" title="Edit" (click)="edit(r.asset)"><i class="bi bi-pencil"></i></button>
                        }
                        <button class="btn btn-sm btn-outline-danger py-0 ms-1" title="Delete" (click)="remove(r.asset)"><i class="bi bi-trash"></i></button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="small text-muted mt-2">
              <i class="bi bi-info-circle me-1"></i>
              <strong>Calculate Depreciation</strong> posts the next year's charge as a Journal voucher (Dr Depreciation · Cr Asset).
              Disabled when fully depreciated.
            </p>
          }
        </div>
      </div>
    </div>

    <!-- Disposal modal -->
    @if (disposing(); as a) {
      <div class="modal-backdrop-c" (click)="disposing.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span><i class="bi bi-box-arrow-right me-2 text-accent"></i>Dispose “{{ a.name }}”</span>
            <button class="btn-close" (click)="disposing.set(null)"></button>
          </div>
          <div class="card-body">
            <p class="small text-muted">Current book value: <strong class="mono">₹{{ assets.bookValue(a) | indianNumber }}</strong></p>
            <div class="mb-3">
              <label class="form-label d-block">Mode</label>
              <div class="d-flex gap-4 pt-1">
                <label class="d-inline-flex align-items-center gap-2">
                  <input class="form-check-input mt-0" type="radio" name="mode" value="Sold" [checked]="mode() === 'Sold'" (change)="mode.set('Sold')" /> Sold
                </label>
                <label class="d-inline-flex align-items-center gap-2">
                  <input class="form-check-input mt-0" type="radio" name="mode" value="Scrapped" [checked]="mode() === 'Scrapped'" (change)="mode.set('Scrapped')" /> Scrapped
                </label>
              </div>
            </div>
            <div class="row g-3">
              <div class="col-6">
                <label class="form-label">Date</label>
                <input type="date" class="form-control" [value]="disposalDate()" (change)="disposalDate.set($any($event.target).value)" />
              </div>
              @if (mode() === 'Sold') {
                <div class="col-6">
                  <label class="form-label">Sale Proceeds (₹)</label>
                  <input type="number" min="0" step="0.01" class="form-control mono" [value]="disposalValue()"
                         (input)="disposalValue.set(+$any($event.target).value)" />
                </div>
              }
            </div>
          </div>
          <div class="card-footer d-flex justify-content-end gap-2">
            <button class="btn btn-outline-secondary btn-sm" (click)="disposing.set(null)">Cancel</button>
            <button class="btn btn-primary btn-sm" (click)="confirmDisposal()"><i class="bi bi-check2 me-1"></i>Confirm &amp; Post Entry</button>
          </div>
        </div>
      </div>
    }
  `
})
export class AssetRegisterComponent {
  readonly assets = inject(AssetService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  readonly disposing = signal<AssetAccount | null>(null);
  readonly mode = signal<'Sold' | 'Scrapped'>('Sold');
  readonly disposalDate = signal(new Date().toISOString().slice(0, 10));
  readonly disposalValue = signal(0);

  readonly rows = computed<AssetRow[]>(() =>
    this.assets.assets().map((asset) => {
      const canDepreciate = asset.method !== 'None' && asset.type !== 'Land' && asset.usefulLife > 0;
      return {
        asset,
        annualDep: this.assets.nextYearDepreciation(asset),
        accumulated: this.assets.accumulatedDepreciation(asset),
        bookValue: this.assets.bookValue(asset),
        rate: this.assets.effectiveRate(asset),
        canDepreciate: canDepreciate && asset.postedYears < asset.usefulLife
      };
    })
  );

  readonly totals = computed(() =>
    this.assets.assets().reduce(
      (a, asset) => ({
        cost: a.cost + asset.cost,
        acc: a.acc + this.assets.accumulatedDepreciation(asset),
        book: a.book + (asset.status === 'Active' ? this.assets.bookValue(asset) : 0),
        active: a.active + (asset.status === 'Active' ? 1 : 0)
      }),
      { cost: 0, acc: 0, book: 0, active: 0 }
    )
  );

  constructor() {
    this.assets.sync();
  }

  calcDep(asset: AssetAccount): void {
    const voucher = this.assets.postDepreciation(asset.id);
    if (voucher) {
      this.ui.toast(`Depreciation posted — voucher ${voucher.voucherNo} (₹${voucher.totalDebit.toFixed(2)}).`, 'success');
    } else {
      this.ui.toast('Nothing to depreciate — asset is fully depreciated or non-depreciable.', 'info');
    }
  }

  openDisposal(asset: AssetAccount): void {
    this.disposing.set(asset);
    this.mode.set('Sold');
    this.disposalDate.set(new Date().toISOString().slice(0, 10));
    this.disposalValue.set(0);
  }

  confirmDisposal(): void {
    const asset = this.disposing();
    if (!asset) {
      return;
    }
    const voucher = this.assets.dispose(asset.id, {
      mode: this.mode(),
      date: this.disposalDate(),
      value: this.disposalValue()
    });
    if (voucher) {
      this.ui.toast(`${asset.name} marked ${this.mode()} — voucher ${voucher.voucherNo} posted.`, 'success');
    } else {
      this.ui.toast('Could not post disposal entry.', 'danger');
    }
    this.disposing.set(null);
  }

  edit(asset: AssetAccount): void {
    this.router.navigate(['/app/accounts/edit', asset.id]);
  }

  remove(asset: AssetAccount): void {
    if (!confirm(`Delete asset “${asset.name}”? This does not reverse posted vouchers.`)) {
      return;
    }
    this.assets.delete(asset.id);
    this.ui.toast(`Asset “${asset.name}” deleted.`, 'info');
  }
}
