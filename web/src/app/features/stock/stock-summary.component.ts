import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { StockService } from '../../core/services/stock.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';

@Component({
  selector: 'app-stock-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IndianNumberPipe],
  styles: [
    `
      .amt { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
      .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
      @media (max-width: 720px) { .kpis { grid-template-columns: 1fr; } }
      .kpi { padding: 0.9rem; border-radius: var(--radius); }
      .kpi .v { font-family: var(--font-mono); font-size: 1.25rem; font-weight: 700; }
    `
  ],
  template: `
    <div class="kpis">
      <div class="kpi bg-soft-success"><div class="small text-secondary">Closing Stock Value</div><div class="v text-debit">₹{{ stock.totalValuation() | indianNumber }}</div><div class="small text-muted">{{ stock.method() }} basis · for Balance Sheet</div></div>
      <div class="kpi bg-soft-danger"><div class="small text-secondary">Low-stock Items</div><div class="v text-credit">{{ lowStock().length }}</div></div>
      <div class="kpi bg-soft-accent"><div class="small text-secondary">Slow / Dead Stock</div><div class="v text-accent">{{ slowMoving().length }}</div></div>
    </div>

    @if (lowStock().length) {
      <div class="alert alert-warning py-2">
        <i class="bi bi-exclamation-triangle-fill me-1"></i><strong>Reorder alert:</strong>
        @for (r of lowStock(); track r.item.id) {
          <span class="badge bg-soft-danger text-danger me-1">{{ r.item.name }} ({{ r.balQty | indianNumber: 0 }} {{ r.item.unit }})</span>
        }
      </div>
    }

    <div class="card">
      <div class="card-header"><i class="bi bi-clipboard-data me-2 text-accent"></i>Item-wise Stock Report</div>
      <div class="card-body">
        @if (rows().length === 0) {
          <p class="text-muted mb-0">No stock items.</p>
        } @else {
          <div class="table-responsive">
            <table class="table table-bordered table-hover align-middle">
              <thead class="table-light">
                <tr><th>Item</th><th>Category</th><th class="text-end">Closing Qty</th><th class="text-end">Rate</th>
                  <th class="text-end">Value</th><th class="text-end">Reorder</th><th>Last Movement</th><th class="text-center">Status</th></tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.item.id) {
                  <tr>
                    <td class="fw-medium">{{ r.item.name }}</td>
                    <td>{{ r.item.category || '—' }}</td>
                    <td class="amt">{{ r.balQty | indianNumber: 0 }} {{ r.item.unit }}</td>
                    <td class="amt">{{ r.balRate | indianNumber }}</td>
                    <td class="amt fw-semibold">{{ r.balValue | indianNumber }}</td>
                    <td class="amt">{{ r.reorderLevel | indianNumber: 0 }}</td>
                    <td>{{ r.lastMovement ? (r.lastMovement | date: 'dd/MM/yyyy') : '—' }}</td>
                    <td class="text-center">
                      @if (r.lowStock) {<span class="badge bg-soft-danger text-danger">Low</span>}
                      @else if (r.slowMoving) {<span class="badge bg-soft-accent text-accent">Slow</span>}
                      @else {<span class="badge bg-soft-success text-success">OK</span>}
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="fw-bold" style="background: var(--surface)">
                  <td colspan="4" class="text-end">Total Closing Stock Value</td>
                  <td class="amt">₹{{ stock.totalValuation() | indianNumber }}</td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      </div>
    </div>
  `
})
export class StockSummaryComponent {
  readonly stock = inject(StockService);

  readonly rows = computed(() => {
    this.stock.txns();
    this.stock.items();
    this.stock.method();
    return this.stock.summary();
  });
  readonly lowStock = computed(() => this.rows().filter((r) => r.lowStock));
  readonly slowMoving = computed(() => this.rows().filter((r) => r.slowMoving));

  constructor() {
    this.stock.sync();
  }
}
