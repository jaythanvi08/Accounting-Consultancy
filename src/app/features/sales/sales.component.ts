import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SalesService } from '../../core/services/sales.service';
import { VoucherService } from '../../core/services/voucher.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { SaleFormComponent } from './sale-form.component';
import { SalesReturnComponent } from './sales-return.component';
import { TurnoverComponent } from './turnover.component';
import { CogsComponent } from './cogs.component';

type SalesTab = 'cash' | 'credit' | 'return' | 'turnover' | 'voucher' | 'cogs';

@Component({
  selector: 'app-sales',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    PageHeaderComponent,
    IndianNumberPipe,
    SaleFormComponent,
    SalesReturnComponent,
    TurnoverComponent,
    CogsComponent
  ],
  styles: [
    `
      .book-tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; border-bottom: 2px solid var(--border); margin-bottom: 1rem; }
      .book-tab { border: none; background: transparent; padding: 0.6rem 1.05rem; font-family: var(--font-heading); font-weight: 600; font-size: 0.9rem; color: var(--text-secondary); border-bottom: 3px solid transparent; margin-bottom: -2px; cursor: pointer; }
      .book-tab:hover { color: var(--primary); }
      .book-tab.active { color: var(--primary); border-bottom-color: var(--accent); }
      .amt { text-align: right; font-family: var(--font-mono); }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header title="Sales Management" subtitle="Cash & credit sales, returns, turnover and COGS" icon="bi-graph-up-arrow" />

      <div class="book-tabs">
        @for (t of tabs; track t.key) {
          <button class="book-tab" [class.active]="active() === t.key" (click)="active.set(t.key)">
            <i class="bi {{ t.icon }} me-1"></i>{{ t.label }}
          </button>
        }
      </div>

      @switch (active()) {
        @case ('cash') { <app-sale-form mode="Cash" /> }
        @case ('credit') { <app-sale-form mode="Credit" /> }
        @case ('return') { <app-sales-return /> }
        @case ('turnover') { <app-turnover /> }
        @case ('cogs') { <app-cogs /> }
        @case ('voucher') {
          <div class="card">
            <div class="card-body">
              <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                <p class="mb-0 text-secondary">Full GST sales-voucher entry lives in the Vouchers module.</p>
                <a routerLink="/app/vouchers/sales" class="btn btn-primary btn-sm"><i class="bi bi-bag-plus me-1"></i>New Sales Voucher</a>
              </div>
              <h3 class="h6 mb-2">Recent Sales Vouchers</h3>
              @if (salesVouchers().length === 0) {
                <p class="text-muted mb-0">No sales vouchers yet.</p>
              } @else {
                <div class="table-responsive">
                  <table class="table table-sm table-bordered align-middle mb-0">
                    <thead class="table-light"><tr><th>VNo.</th><th>Date</th><th>Narration</th><th class="text-end">Amount</th></tr></thead>
                    <tbody>
                      @for (v of salesVouchers(); track v.id) {
                        <tr>
                          <td class="mono">{{ v.voucherNo }}</td>
                          <td>{{ v.date | date: 'dd/MM/yyyy' }}</td>
                          <td>{{ v.narration }}</td>
                          <td class="amt">₹{{ v.totalCredit | indianNumber }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `
})
export class SalesComponent {
  private readonly sales = inject(SalesService);
  private readonly vouchers = inject(VoucherService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly tabs: ReadonlyArray<{ key: SalesTab; label: string; icon: string }> = [
    { key: 'cash', label: 'Cash Sales', icon: 'bi-cash' },
    { key: 'credit', label: 'Credit Sales', icon: 'bi-credit-card' },
    { key: 'return', label: 'Sales Return', icon: 'bi-arrow-return-left' },
    { key: 'turnover', label: 'Turnover', icon: 'bi-bar-chart' },
    { key: 'voucher', label: 'Sales Voucher', icon: 'bi-bag-plus' },
    { key: 'cogs', label: 'COGS', icon: 'bi-calculator' }
  ];

  readonly active = signal<SalesTab>('cash');

  readonly salesVouchers = computed(() => {
    this.vouchers.vouchers();
    return this.vouchers.filter('', '', 'Sales');
  });

  constructor() {
    this.sales.sync();
    this.vouchers.sync();
    const section = this.route.snapshot.paramMap.get('section') as SalesTab | null;
    if (section && this.tabs.some((t) => t.key === section)) {
      this.active.set(section);
    }
  }
}
