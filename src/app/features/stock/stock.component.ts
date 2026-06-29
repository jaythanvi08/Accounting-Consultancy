import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { StockService } from '../../core/services/stock.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StockItemsComponent } from './stock-items.component';
import { StockTransactionsComponent } from './stock-transactions.component';
import { StockRegisterComponent } from './stock-register.component';
import { StockSummaryComponent } from './stock-summary.component';

type StockTab = 'items' | 'transactions' | 'register' | 'summary';

@Component({
  selector: 'app-stock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    StockItemsComponent,
    StockTransactionsComponent,
    StockRegisterComponent,
    StockSummaryComponent
  ],
  styles: [
    `
      .book-tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; border-bottom: 2px solid var(--border); margin-bottom: 1rem; }
      .book-tab { border: none; background: transparent; padding: 0.6rem 1.05rem; font-family: var(--font-heading); font-weight: 600; font-size: 0.9rem; color: var(--text-secondary); border-bottom: 3px solid transparent; margin-bottom: -2px; cursor: pointer; }
      .book-tab:hover { color: var(--primary); }
      .book-tab.active { color: var(--primary); border-bottom-color: var(--accent); }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header title="Stock Management" subtitle="Inventory items, movements, register & valuation" icon="bi-box-seam">
        @if (stock.inventoryEnabled()) {
          <div class="d-flex align-items-center gap-2">
            <label class="form-label mb-0 small">Valuation:</label>
            <select class="form-select form-select-sm" style="width:auto" [value]="stock.method()"
                    (change)="stock.setMethod($any($event.target).value)">
              <option value="FIFO">FIFO</option>
              <option value="LIFO">LIFO</option>
              <option value="WAC">Weighted Avg</option>
            </select>
          </div>
        }
      </app-page-header>

      @if (!stock.inventoryEnabled()) {
        <div class="card"><div class="card-body text-center py-5">
          <i class="bi bi-box-seam fs-1 d-block mb-2 text-muted"></i>
          <h2 class="h6">Inventory Tracking is turned off</h2>
          <p class="text-muted">This company maintains <strong>Accounts Only</strong>. Enable
            <strong>“Accounts with Inventory”</strong> in Company Settings to use Stock Management.</p>
          <a routerLink="/app/company/settings" class="btn btn-primary btn-sm"><i class="bi bi-gear me-1"></i>Company Settings</a>
        </div></div>
      } @else {
        <div class="book-tabs">
          @for (t of tabs; track t.key) {
            <button class="book-tab" [class.active]="active() === t.key" (click)="active.set(t.key)">
              <i class="bi {{ t.icon }} me-1"></i>{{ t.label }}
            </button>
          }
        </div>

        @switch (active()) {
          @case ('items') { <app-stock-items /> }
          @case ('transactions') { <app-stock-transactions /> }
          @case ('register') { <app-stock-register /> }
          @case ('summary') { <app-stock-summary /> }
        }
      }
    </div>
  `
})
export class StockComponent {
  readonly stock = inject(StockService);
  private readonly route = inject(ActivatedRoute);

  readonly tabs: ReadonlyArray<{ key: StockTab; label: string; icon: string }> = [
    { key: 'items', label: 'Items', icon: 'bi-box' },
    { key: 'transactions', label: 'Transactions', icon: 'bi-arrow-left-right' },
    { key: 'register', label: 'Stock Register', icon: 'bi-card-list' },
    { key: 'summary', label: 'Summary', icon: 'bi-clipboard-data' }
  ];

  readonly active = signal<StockTab>('items');

  constructor() {
    this.stock.sync();
    const section = this.route.snapshot.paramMap.get('section') as StockTab | null;
    if (section && this.tabs.some((t) => t.key === section)) {
      this.active.set(section);
    }
  }
}
