import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StockService } from '../../core/services/stock.service';
import { UiService } from '../../core/services/ui.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { StockDirection } from '../../core/models';

@Component({
  selector: 'app-stock-transactions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, IndianNumberPipe],
  styles: [`.amt { text-align: right; font-family: var(--font-mono); }`],
  template: `
    <div class="row g-3">
      <div class="col-lg-5">
        <form class="card" [formGroup]="form" (ngSubmit)="submit()">
          <div class="card-header"><i class="bi bi-arrow-left-right me-2 text-accent"></i>Record Stock Movement</div>
          <div class="card-body">
            <div class="mb-3">
              <label class="form-label d-block">Direction</label>
              <div class="d-flex gap-4 pt-1">
                <label class="d-inline-flex align-items-center gap-2">
                  <input class="form-check-input mt-0" type="radio" formControlName="direction" value="In" /> Stock In (Purchase/Production)
                </label>
                <label class="d-inline-flex align-items-center gap-2">
                  <input class="form-check-input mt-0" type="radio" formControlName="direction" value="Out" /> Stock Out (Sales/Consumption)
                </label>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Item<span class="required-mark">*</span></label>
              <select class="form-select" formControlName="itemId" [class.is-invalid]="invalid('itemId')">
                <option value="" disabled>Select item…</option>
                @for (i of stock.items(); track i.id) {<option [value]="i.id">{{ i.name }} ({{ i.unit }})</option>}
              </select>
              @if (invalid('itemId')) {<div class="invalid-feedback d-block">Select an item.</div>}
            </div>
            <div class="row g-3">
              <div class="col-6">
                <label class="form-label">Date<span class="required-mark">*</span></label>
                <input type="date" class="form-control" formControlName="date" />
              </div>
              <div class="col-6">
                <label class="form-label">Qty<span class="required-mark">*</span></label>
                <input type="number" min="0" step="0.01" class="form-control amt" formControlName="qty" [class.is-invalid]="invalid('qty')" />
              </div>
              @if (form.controls.direction.value === 'In') {
                <div class="col-6">
                  <label class="form-label">Rate</label>
                  <input type="number" min="0" step="0.01" class="form-control amt" formControlName="rate" />
                </div>
              } @else {
                <div class="col-6">
                  <label class="form-label">Rate</label>
                  <input class="form-control amt" value="(auto — valuation)" readonly />
                </div>
              }
              <div class="col-6">
                <label class="form-label">Particulars</label>
                <input class="form-control" formControlName="particulars" placeholder="Purchase, Sales…" />
              </div>
            </div>
          </div>
          <div class="card-footer">
            <button type="submit" class="btn btn-primary"><i class="bi bi-check2-circle me-1"></i>Post Movement</button>
          </div>
        </form>
      </div>

      <div class="col-lg-7">
        <div class="card">
          <div class="card-header"><i class="bi bi-clock-history me-2 text-accent"></i>Recent Movements</div>
          <div class="card-body">
            @if (recent().length === 0) {
              <p class="text-muted mb-0">No movements yet.</p>
            } @else {
              <div class="table-responsive">
                <table class="table table-sm table-bordered align-middle mb-0">
                  <thead class="table-light"><tr><th>Date</th><th>Item</th><th>Dir</th><th class="text-end">Qty</th><th class="text-end">Rate</th><th></th></tr></thead>
                  <tbody>
                    @for (t of recent(); track t.id) {
                      <tr>
                        <td>{{ t.date | date: 'dd/MM/yy' }}</td>
                        <td>{{ stock.getItem(t.itemId)?.name }}</td>
                        <td><span class="badge" [class.bg-soft-success]="t.direction === 'In'" [class.text-success]="t.direction === 'In'"
                              [class.bg-soft-danger]="t.direction === 'Out'" [class.text-danger]="t.direction === 'Out'">{{ t.direction }}</span></td>
                        <td class="amt">{{ t.qty | indianNumber: 0 }}</td>
                        <td class="amt">{{ t.direction === 'In' ? (t.rate | indianNumber) : 'auto' }}</td>
                        <td class="text-center"><button class="btn btn-sm btn-outline-danger py-0" (click)="del(t.id)"><i class="bi bi-x-lg"></i></button></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class StockTransactionsComponent {
  readonly stock = inject(StockService);
  private readonly fb = inject(FormBuilder);
  private readonly ui = inject(UiService);

  readonly form = this.fb.nonNullable.group({
    direction: ['In' as StockDirection, [Validators.required]],
    itemId: ['', [Validators.required]],
    date: [new Date().toISOString().slice(0, 10), [Validators.required]],
    qty: [0, [Validators.required, Validators.min(0.01)]],
    rate: [0],
    particulars: ['']
  });

  readonly recent = computed(() => {
    this.stock.txns();
    return [...this.stock.txns()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
  });

  constructor() {
    this.stock.sync();
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.ui.toast('Select an item and enter a quantity.', 'warning');
      return;
    }
    const v = this.form.getRawValue();
    this.stock.addTxn({
      itemId: v.itemId,
      date: new Date(v.date).toISOString(),
      direction: v.direction,
      qty: Number(v.qty),
      rate: v.direction === 'In' ? Number(v.rate) || 0 : 0,
      particulars: v.particulars || (v.direction === 'In' ? 'Stock In' : 'Stock Out')
    });
    const item = this.stock.getItem(v.itemId);
    this.ui.toast(`${v.direction === 'In' ? 'Stock added to' : 'Stock issued from'} ${item?.name ?? 'item'}.`, 'success');
    this.form.patchValue({ qty: 0, rate: 0, particulars: '' });
  }

  del(id: string): void {
    this.stock.deleteTxn(id);
    this.ui.toast('Movement removed.', 'info');
  }
}
