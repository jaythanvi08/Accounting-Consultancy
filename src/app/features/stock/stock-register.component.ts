import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { StockService } from '../../core/services/stock.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';

@Component({
  selector: 'app-stock-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IndianNumberPipe],
  styles: [
    `
      .amt { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
      .grp-in { background: rgba(26, 122, 74, 0.06); }
      .grp-out { background: rgba(178, 34, 34, 0.06); }
      th.grp { text-align: center; }
    `
  ],
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <label class="form-label mb-0">Item:</label>
      <select class="form-select form-select-sm" style="max-width: 320px" [value]="itemId()" (change)="itemId.set($any($event.target).value)">
        @for (i of stock.items(); track i.id) {<option [value]="i.id">{{ i.name }}</option>}
      </select>
      <span class="badge bg-soft-primary text-primary ms-auto">Valuation: {{ stock.method() }}</span>
    </div>

    @if (rows().length === 0) {
      <div class="card"><div class="card-body text-center text-muted py-5">
        <i class="bi bi-card-list fs-1 d-block mb-2"></i>No movements for this item.
      </div></div>
    } @else {
      <div class="card">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-bordered table-sm align-middle text-center">
              <thead class="table-light">
                <tr>
                  <th rowspan="2" class="align-middle">Date</th>
                  <th rowspan="2" class="align-middle text-start">Particulars</th>
                  <th colspan="3" class="grp">Stock In</th>
                  <th colspan="3" class="grp">Stock Out</th>
                  <th colspan="3" class="grp">Balance</th>
                </tr>
                <tr>
                  <th>Qty</th><th>Rate</th><th>Value</th>
                  <th>Qty</th><th>Rate</th><th>Value</th>
                  <th>Qty</th><th>Rate</th><th>Value</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track $index) {
                  <tr>
                    <td>{{ r.date | date: 'dd/MM/yy' }}</td>
                    <td class="text-start">{{ r.particulars }}</td>
                    <td class="amt grp-in">{{ r.inQty ? (r.inQty | indianNumber: 0) : '' }}</td>
                    <td class="amt grp-in">{{ r.inQty ? (r.inRate | indianNumber) : '' }}</td>
                    <td class="amt grp-in">{{ r.inQty ? (r.inValue | indianNumber) : '' }}</td>
                    <td class="amt grp-out">{{ r.outQty ? (r.outQty | indianNumber: 0) : '' }}</td>
                    <td class="amt grp-out">{{ r.outQty ? (r.outRate | indianNumber) : '' }}</td>
                    <td class="amt grp-out">{{ r.outQty ? (r.outValue | indianNumber) : '' }}</td>
                    <td class="amt fw-semibold">{{ r.balQty | indianNumber: 0 }}</td>
                    <td class="amt">{{ r.balRate | indianNumber }}</td>
                    <td class="amt fw-semibold">{{ r.balValue | indianNumber }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="small text-muted mt-2 mb-0">
            <i class="bi bi-info-circle me-1"></i>Closing stock value:
            <strong>₹{{ rows()[rows().length - 1].balValue | indianNumber }}</strong> ({{ stock.method() }} basis)
          </p>
        </div>
      </div>
    }
  `
})
export class StockRegisterComponent {
  readonly stock = inject(StockService);
  readonly itemId = signal('');

  readonly rows = computed(() => {
    this.stock.txns();
    this.stock.method();
    const id = this.itemId() || this.stock.items()[0]?.id;
    return id ? this.stock.register(id) : [];
  });

  constructor() {
    this.stock.sync();
    this.itemId.set(this.stock.items()[0]?.id ?? '');
  }
}
