import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { VoucherService } from '../../core/services/voucher.service';
import { CompanyService } from '../../core/services/company.service';
import { ExportService } from '../../core/services/export.service';
import { UiService } from '../../core/services/ui.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { DatePipe } from '@angular/common';
import { VOUCHER_META, VOUCHER_TYPES } from '../../core/constants/vouchers';
import { Voucher, VoucherType } from '../../core/models';

@Component({
  selector: 'app-voucher-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IndianNumberPipe, DatePipe],
  styles: [
    `
      .filter-bar { display: flex; flex-wrap: wrap; align-items: end; gap: 0.75rem; margin-bottom: 1rem; }
      .amt { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
      .modal-backdrop-c { position: fixed; inset: 0; background: rgba(15, 34, 56, 0.45); display: grid; place-items: center; z-index: 1060; padding: 1rem; }
      .modal-card { background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; max-width: 560px; }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header title="Vouchers" subtitle="All recorded vouchers" icon="bi-receipt">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-primary" (click)="newVoucher('Journal')"><i class="bi bi-plus-lg me-1"></i>New Journal</button>
          <button class="btn btn-outline-primary dropdown-toggle dropdown-toggle-split" (click)="showMenu.set(!showMenu())"></button>
        </div>
      </app-page-header>

      @if (showMenu()) {
        <div class="mb-3 d-flex flex-wrap gap-2">
          @for (t of types; track t) {
            <button class="btn btn-outline-secondary btn-sm" (click)="newVoucher(t)">
              <i class="bi {{ meta[t].icon }} me-1"></i>{{ meta[t].label }}
            </button>
          }
        </div>
      }

      <!-- Filters -->
      <div class="filter-bar no-print">
        <div>
          <label class="form-label mb-1">From</label>
          <input type="date" class="form-control form-control-sm" [value]="from()" (change)="from.set($any($event.target).value)" />
        </div>
        <div>
          <label class="form-label mb-1">To</label>
          <input type="date" class="form-control form-control-sm" [value]="to()" (change)="to.set($any($event.target).value)" />
        </div>
        <div>
          <label class="form-label mb-1">Type</label>
          <select class="form-select form-select-sm" [value]="typeFilter()" (change)="typeFilter.set($any($event.target).value)">
            <option value="All">All Types</option>
            @for (t of types; track t) {<option [value]="t">{{ t }}</option>}
          </select>
        </div>
        @if (from() || to() || typeFilter() !== 'All') {
          <button class="btn btn-outline-secondary btn-sm" (click)="clear()">Clear</button>
        }
      </div>

      <div class="card">
        <div class="card-body">
          @if (rows().length === 0) {
            <div class="text-center text-muted py-5">
              <i class="bi bi-inbox fs-1 d-block mb-2"></i>No vouchers match. Create one to get started.
            </div>
          } @else {
            <div class="table-responsive">
              <table class="table table-hover table-bordered align-middle">
                <thead class="table-light">
                  <tr>
                    <th>VNo.</th><th>Date</th><th>Type</th><th>Narration</th>
                    <th class="text-end">Debit</th><th class="text-end">Credit</th><th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (v of rows(); track v.id) {
                    <tr>
                      <td class="mono fw-semibold">{{ v.voucherNo }}</td>
                      <td>{{ v.date | date: 'dd/MM/yyyy' }}</td>
                      <td><span class="badge bg-soft-primary text-primary">{{ v.voucherType }}</span></td>
                      <td class="text-truncate" style="max-width:280px">{{ v.narration }}</td>
                      <td class="amt">{{ v.totalDebit | indianNumber }}</td>
                      <td class="amt">{{ v.totalCredit | indianNumber }}</td>
                      <td class="text-center text-nowrap">
                        <button class="btn btn-sm btn-outline-secondary py-0" title="View" (click)="view(v)"><i class="bi bi-eye"></i></button>
                        <button class="btn btn-sm btn-outline-primary py-0 ms-1" title="Edit" (click)="edit(v)"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-info py-0 ms-1" title="Print" (click)="print(v)"><i class="bi bi-printer"></i></button>
                        <button class="btn btn-sm btn-outline-danger py-0 ms-1" title="Delete" (click)="remove(v)"><i class="bi bi-trash"></i></button>
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="fw-bold" style="background: var(--surface)">
                    <td colspan="4" class="text-end">Total ({{ rows().length }} vouchers)</td>
                    <td class="amt">{{ totals().dr | indianNumber }}</td>
                    <td class="amt">{{ totals().cr | indianNumber }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Preview / print modal -->
    @if (active(); as v) {
      <div class="modal-backdrop-c" (click)="active.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span><i class="bi {{ meta[v.voucherType].icon }} me-2 text-accent"></i>{{ meta[v.voucherType].label }} — {{ v.voucherNo }}</span>
            <button class="btn-close" (click)="active.set(null)"></button>
          </div>
          <div class="card-body">
            <div class="d-flex justify-content-between small text-muted mb-2">
              <span>{{ company() }}</span><span>Date: {{ v.date | date: 'dd/MM/yyyy' }}</span>
            </div>
            <table class="table table-sm mb-2">
              <thead class="table-light"><tr><th>Particulars</th><th class="text-end">Dr (₹)</th><th class="text-end">Cr (₹)</th></tr></thead>
              <tbody>
                @for (ln of sortedLines(v); track $index) {
                  <tr>
                    <td [style.padding-left.px]="ln.type === 'Cr' ? 28 : 8">{{ ln.type === 'Cr' ? 'To ' : '' }}{{ ln.ledgerName }} A/c{{ ln.type === 'Dr' ? ' Dr' : '' }}</td>
                    <td class="text-end mono">{{ ln.type === 'Dr' ? (ln.amount | indianNumber) : '' }}</td>
                    <td class="text-end mono">{{ ln.type === 'Cr' ? (ln.amount | indianNumber) : '' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot><tr class="fw-bold"><td class="text-end">Total</td>
                <td class="text-end mono">{{ v.totalDebit | indianNumber }}</td>
                <td class="text-end mono">{{ v.totalCredit | indianNumber }}</td></tr></tfoot>
            </table>
            <p class="small mb-0"><strong>Narration:</strong> {{ v.narration }}</p>
            @if (v.reference) {<p class="small mb-0"><strong>Reference:</strong> {{ v.reference }}</p>}
          </div>
          <div class="card-footer d-flex justify-content-end gap-2 no-print">
            <button class="btn btn-outline-secondary btn-sm" (click)="exp.print()"><i class="bi bi-printer me-1"></i>Print</button>
            <button class="btn btn-primary btn-sm" (click)="active.set(null)">Close</button>
          </div>
        </div>
      </div>
    }
  `
})
export class VoucherListComponent {
  readonly vouchers = inject(VoucherService);
  private readonly companies = inject(CompanyService);
  readonly exp = inject(ExportService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  readonly types = VOUCHER_TYPES;
  readonly meta = VOUCHER_META;

  readonly from = signal('');
  readonly to = signal('');
  readonly typeFilter = signal<'All' | VoucherType>('All');
  readonly showMenu = signal(false);
  readonly active = signal<Voucher | null>(null);

  readonly company = computed(() => this.companies.activeCompany()?.name ?? '');

  readonly rows = computed(() => {
    this.vouchers.vouchers(); // dependency
    return this.vouchers.filter(this.from(), this.to(), this.typeFilter());
  });

  readonly totals = computed(() =>
    this.rows().reduce((a, v) => ({ dr: a.dr + v.totalDebit, cr: a.cr + v.totalCredit }), { dr: 0, cr: 0 })
  );

  constructor() {
    this.vouchers.sync();
  }

  sortedLines(v: Voucher) {
    return [...v.lines].sort((a, b) => (a.type === b.type ? 0 : a.type === 'Dr' ? -1 : 1));
  }

  newVoucher(t: VoucherType): void {
    this.router.navigate(['/app/vouchers', t.toLowerCase()]);
  }
  view(v: Voucher): void {
    this.active.set(v);
  }
  print(v: Voucher): void {
    this.active.set(v);
    setTimeout(() => this.exp.print());
  }
  edit(v: Voucher): void {
    this.router.navigate(['/app/vouchers', v.voucherType.toLowerCase(), 'edit', v.id]);
  }
  remove(v: Voucher): void {
    if (!confirm(`Delete voucher ${v.voucherNo}?`)) {
      return;
    }
    this.vouchers.delete(v.id);
    this.ui.toast(`Voucher ${v.voucherNo} deleted.`, 'info');
  }
  clear(): void {
    this.from.set('');
    this.to.set('');
    this.typeFilter.set('All');
  }
}
