import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { PurchaseService } from '../../core/services/purchase.service';
import { UiService } from '../../core/services/ui.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { PurchaseItem } from '../../core/models';

interface ItemRow {
  name: FormControl<string>;
  qty: FormControl<number>;
  rate: FormControl<number>;
  discountPct: FormControl<number>;
  gstRate: FormControl<number>;
}

@Component({
  selector: 'app-purchase-return',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IndianNumberPipe],
  styles: [`.amt { text-align: right; font-family: var(--font-mono); } input.amt { text-align: right; }`],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <section class="card mb-3">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-3">
              <label class="form-label">Debit Note No.</label>
              <input class="form-control mono" [value]="purchases.nextDebitNoteNo()" readonly />
            </div>
            <div class="col-md-3">
              <label class="form-label">Date<span class="required-mark">*</span></label>
              <input type="date" class="form-control" formControlName="date" />
            </div>
            <div class="col-md-6">
              <label class="form-label">Original Purchase</label>
              <select class="form-select" formControlName="originalInvoiceNo" (change)="onInvoice()">
                <option value="">— Select invoice (optional) —</option>
                @for (p of purchases.purchases(); track p.id) {
                  <option [value]="p.invoiceNo">{{ p.invoiceNo }} · {{ p.supplierName }} · ₹{{ p.grandTotal | indianNumber }}</option>
                }
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">Supplier<span class="required-mark">*</span></label>
              <input class="form-control" formControlName="supplierName" [class.is-invalid]="invalid('supplierName')" />
              @if (invalid('supplierName')) {<div class="invalid-feedback d-block">Supplier is required.</div>}
            </div>
            <div class="col-md-6">
              <label class="form-label">Reason<span class="required-mark">*</span></label>
              <input class="form-control" formControlName="reason" placeholder="e.g. Defective goods returned"
                     [class.is-invalid]="invalid('reason')" />
              @if (invalid('reason')) {<div class="invalid-feedback d-block">Reason is required.</div>}
            </div>
          </div>
        </div>
      </section>

      <section class="card mb-3">
        <div class="card-header"><i class="bi bi-arrow-return-right me-2 text-accent"></i>Items Returned (Return Outward)</div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-bordered table-sm align-middle mb-0">
              <thead class="table-light">
                <tr><th style="width:30%">Item</th><th class="text-end">Qty</th><th class="text-end">Rate</th>
                  <th class="text-end">Disc%</th><th class="text-end">GST%</th><th class="text-end">Total</th><th></th></tr>
              </thead>
              <tbody formArrayName="items">
                @for (row of items.controls; track $index) {
                  <tr [formGroupName]="$index">
                    <td><input class="form-control form-control-sm" formControlName="name" /></td>
                    <td><input type="number" min="0" class="form-control form-control-sm amt" formControlName="qty" /></td>
                    <td><input type="number" min="0" step="0.01" class="form-control form-control-sm amt" formControlName="rate" /></td>
                    <td><input type="number" min="0" max="100" step="0.01" class="form-control form-control-sm amt" formControlName="discountPct" /></td>
                    <td><input type="number" min="0" step="0.01" class="form-control form-control-sm amt" formControlName="gstRate" /></td>
                    <td class="amt fw-semibold">{{ total(row) | indianNumber }}</td>
                    <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger py-0"
                          [disabled]="items.length <= 1" (click)="removeItem($index)"><i class="bi bi-x-lg"></i></button></td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr><td colspan="7"><button type="button" class="btn btn-sm btn-outline-primary" (click)="addItem()">
                  <i class="bi bi-plus-lg me-1"></i>Add Item</button></td></tr>
                <tr class="fw-bold" style="background:var(--surface)">
                  <td colspan="5" class="text-end">Total Return Value</td>
                  <td class="amt">₹{{ totals().grandTotal | indianNumber }}</td><td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p class="small text-muted mt-2 mb-0">
            <i class="bi bi-info-circle me-1"></i>Journal: {{ form.controls.supplierName.value || 'Creditor' }} A/c Dr · To Purchase Return A/c · To GST Input Tax A/c
          </p>
        </div>
      </section>

      <button type="submit" class="btn btn-primary px-4"><i class="bi bi-check2-circle me-1"></i>Raise Debit Note</button>
    </form>
  `
})
export class PurchaseReturnComponent {
  private readonly fb = inject(FormBuilder);
  readonly purchases = inject(PurchaseService);
  private readonly ui = inject(UiService);

  readonly form = this.fb.nonNullable.group({
    date: [new Date().toISOString().slice(0, 10), [Validators.required]],
    originalInvoiceNo: [''],
    supplierName: ['', [Validators.required]],
    reason: ['', [Validators.required]],
    items: this.fb.nonNullable.array<FormGroup<ItemRow>>([this.newItem()])
  });

  private readonly fv = toSignal(this.form.valueChanges);
  readonly totals = computed(() => {
    this.fv();
    return this.purchases.totals(this.readItems());
  });

  constructor() {
    this.purchases.sync();
  }

  private newItem(name = '', qty = 1, rate = 0, discountPct = 0, gstRate = 18): FormGroup<ItemRow> {
    return this.fb.nonNullable.group({ name: [name], qty: [qty], rate: [rate], discountPct: [discountPct], gstRate: [gstRate] });
  }
  get items(): FormArray<FormGroup<ItemRow>> {
    return this.form.controls.items;
  }
  addItem(): void {
    this.items.push(this.newItem());
  }
  removeItem(i: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(i);
    }
  }
  total(row: FormGroup<ItemRow>): number {
    const base = (row.controls.qty.value || 0) * (row.controls.rate.value || 0) * (1 - (row.controls.discountPct.value || 0) / 100);
    return base * (1 + (row.controls.gstRate.value || 0) / 100);
  }
  private readItems(): PurchaseItem[] {
    return this.items.controls.map((c) => ({
      name: c.controls.name.value,
      qty: c.controls.qty.value || 0,
      rate: c.controls.rate.value || 0,
      discountPct: c.controls.discountPct.value || 0,
      gstRate: c.controls.gstRate.value || 0
    }));
  }
  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  onInvoice(): void {
    const inv = this.purchases.purchases().find((p) => p.invoiceNo === this.form.controls.originalInvoiceNo.value);
    if (!inv) {
      return;
    }
    this.form.controls.supplierName.setValue(inv.supplierName);
    this.items.clear();
    for (const it of inv.items) {
      this.items.push(this.newItem(it.name, it.qty, it.rate, it.discountPct, it.gstRate));
    }
  }

  submit(): void {
    if (this.form.controls.supplierName.invalid || this.form.controls.reason.invalid) {
      this.form.markAllAsTouched();
      this.ui.toast('Supplier and reason are required.', 'warning');
      return;
    }
    const items = this.readItems().filter((it) => it.name.trim() && it.qty > 0 && it.rate > 0);
    if (items.length === 0) {
      this.ui.toast('Add at least one returned item.', 'warning');
      return;
    }
    const v = this.form.getRawValue();
    const ret = this.purchases.createReturn({
      debitNoteNo: this.purchases.nextDebitNoteNo(),
      date: new Date(v.date).toISOString(),
      originalInvoiceNo: v.originalInvoiceNo || '—',
      supplierName: v.supplierName.trim(),
      items,
      reason: v.reason.trim()
    });
    this.ui.toast(`Debit note ${ret.debitNoteNo} raised (₹${ret.grandTotal.toFixed(2)}).`, 'success');
    this.items.clear();
    this.items.push(this.newItem());
    this.form.reset({ date: new Date().toISOString().slice(0, 10), originalInvoiceNo: '', supplierName: '', reason: '' });
  }
}
