import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { StockService } from '../../core/services/stock.service';
import { UiService } from '../../core/services/ui.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { StockItem } from '../../core/models';

@Component({
  selector: 'app-stock-items',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IndianNumberPipe],
  styles: [
    `
      .amt { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
      .modal-backdrop-c { position: fixed; inset: 0; background: rgba(15, 34, 56, 0.45); display: grid; place-items: center; z-index: 1060; padding: 1rem; }
      .modal-card { background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; max-width: 600px; }
    `
  ],
  template: `
    <div class="d-flex justify-content-end mb-2">
      <button class="btn btn-primary btn-sm" (click)="open(null)"><i class="bi bi-plus-lg me-1"></i>New Item</button>
    </div>

    <div class="card">
      <div class="card-body">
        @if (stock.items().length === 0) {
          <div class="text-center text-muted py-5"><i class="bi bi-box-seam fs-1 d-block mb-2"></i>No stock items yet.</div>
        } @else {
          <div class="table-responsive">
            <table class="table table-hover table-bordered align-middle">
              <thead class="table-light">
                <tr><th>Item</th><th>Code</th><th>Category</th><th>Unit</th><th class="text-end">GST%</th>
                  <th class="text-end">Opening Qty</th><th class="text-end">Rate</th><th class="text-end">Value</th>
                  <th class="text-end">Reorder</th><th class="text-center">Actions</th></tr>
              </thead>
              <tbody>
                @for (i of stock.items(); track i.id) {
                  <tr>
                    <td class="fw-medium">{{ i.name }}</td>
                    <td class="mono">{{ i.code || '—' }}</td>
                    <td>{{ i.category || '—' }}</td>
                    <td>{{ i.unit }}</td>
                    <td class="amt">{{ i.gstRate }}%</td>
                    <td class="amt">{{ i.openingQty | indianNumber: 0 }}</td>
                    <td class="amt">{{ i.openingRate | indianNumber }}</td>
                    <td class="amt">{{ (i.openingQty * i.openingRate) | indianNumber }}</td>
                    <td class="amt">{{ i.reorderLevel ?? 0 | indianNumber: 0 }}</td>
                    <td class="text-center text-nowrap">
                      <button class="btn btn-sm btn-outline-primary py-0" (click)="open(i)"><i class="bi bi-pencil"></i></button>
                      <button class="btn btn-sm btn-outline-danger py-0 ms-1" (click)="remove(i)"><i class="bi bi-trash"></i></button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    @if (showModal()) {
      <div class="modal-backdrop-c" (click)="showModal.set(false)">
        <form class="modal-card" [formGroup]="form" (ngSubmit)="save()" (click)="$event.stopPropagation()">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span><i class="bi bi-box-seam me-2 text-accent"></i>{{ editId() ? 'Edit' : 'New' }} Stock Item</span>
            <button type="button" class="btn-close" (click)="showModal.set(false)"></button>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-7">
                <label class="form-label">Item Name<span class="required-mark">*</span></label>
                <input class="form-control" formControlName="name" [class.is-invalid]="invalid('name')" />
                @if (invalid('name')) {<div class="invalid-feedback d-block">Required.</div>}
              </div>
              <div class="col-md-5">
                <label class="form-label">Item Code</label>
                <input class="form-control" formControlName="code" />
              </div>
              <div class="col-md-5">
                <label class="form-label">Category</label>
                <input class="form-control" formControlName="category" placeholder="Raw Material, Finished Goods…" />
              </div>
              <div class="col-md-3">
                <label class="form-label">Unit<span class="required-mark">*</span></label>
                <input class="form-control" formControlName="unit" placeholder="Nos, Kg, Ltr" [class.is-invalid]="invalid('unit')" />
              </div>
              <div class="col-md-4">
                <label class="form-label">HSN Code</label>
                <input class="form-control" formControlName="hsnCode" />
              </div>
              <div class="col-md-4">
                <label class="form-label">GST Rate %</label>
                <input type="number" min="0" step="0.01" class="form-control mono" formControlName="gstRate" />
              </div>
              <div class="col-md-4">
                <label class="form-label">Opening Qty</label>
                <input type="number" min="0" step="0.01" class="form-control mono" formControlName="openingQty" />
              </div>
              <div class="col-md-4">
                <label class="form-label">Opening Rate</label>
                <input type="number" min="0" step="0.01" class="form-control mono" formControlName="openingRate" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Opening Value</label>
                <input class="form-control mono" [value]="openingValue() | indianNumber" readonly />
              </div>
              <div class="col-md-3">
                <label class="form-label">Reorder Level</label>
                <input type="number" min="0" class="form-control mono" formControlName="reorderLevel" />
              </div>
              <div class="col-md-3">
                <label class="form-label">Reorder Qty</label>
                <input type="number" min="0" class="form-control mono" formControlName="reorderQty" />
              </div>
            </div>
          </div>
          <div class="card-footer d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-outline-secondary" (click)="showModal.set(false)">Cancel</button>
            <button type="submit" class="btn btn-primary"><i class="bi bi-check2 me-1"></i>{{ editId() ? 'Update' : 'Create' }}</button>
          </div>
        </form>
      </div>
    }
  `
})
export class StockItemsComponent {
  readonly stock = inject(StockService);
  private readonly fb = inject(FormBuilder);
  private readonly ui = inject(UiService);

  readonly showModal = signal(false);
  readonly editId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    code: [''],
    category: [''],
    unit: ['Nos', [Validators.required]],
    hsnCode: [''],
    gstRate: [18],
    openingQty: [0],
    openingRate: [0],
    reorderLevel: [0],
    reorderQty: [0]
  });

  private readonly fv = toSignal(this.form.valueChanges);
  readonly openingValue = computed(() => {
    this.fv();
    return (this.form.controls.openingQty.value || 0) * (this.form.controls.openingRate.value || 0);
  });

  constructor() {
    this.stock.sync();
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  open(item: StockItem | null): void {
    this.editId.set(item?.id ?? null);
    this.form.reset({
      name: item?.name ?? '',
      code: item?.code ?? '',
      category: item?.category ?? '',
      unit: item?.unit ?? 'Nos',
      hsnCode: item?.hsnCode ?? '',
      gstRate: item?.gstRate ?? 18,
      openingQty: item?.openingQty ?? 0,
      openingRate: item?.openingRate ?? 0,
      reorderLevel: item?.reorderLevel ?? 0,
      reorderQty: item?.reorderQty ?? 0
    });
    this.showModal.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.ui.toast('Item name and unit are required.', 'warning');
      return;
    }
    const v = this.form.getRawValue();
    const payload = {
      name: v.name.trim(),
      code: v.code || undefined,
      category: v.category || undefined,
      unit: v.unit,
      hsnCode: v.hsnCode || undefined,
      gstRate: Number(v.gstRate) || 0,
      openingQty: Number(v.openingQty) || 0,
      openingRate: Number(v.openingRate) || 0,
      reorderLevel: Number(v.reorderLevel) || 0,
      reorderQty: Number(v.reorderQty) || 0
    };
    const id = this.editId();
    if (id) {
      this.stock.updateItem(id, payload);
      this.ui.toast(`Item “${payload.name}” updated.`, 'success');
    } else {
      this.stock.createItem(payload);
      this.ui.toast(`Item “${payload.name}” created.`, 'success');
    }
    this.showModal.set(false);
  }

  remove(item: StockItem): void {
    if (!confirm(`Delete “${item.name}” and its stock movements?`)) {
      return;
    }
    this.stock.deleteItem(item.id);
    this.ui.toast(`Item “${item.name}” deleted.`, 'info');
  }
}
