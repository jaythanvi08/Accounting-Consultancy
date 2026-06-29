import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { SalesService } from '../../core/services/sales.service';
import { UiService } from '../../core/services/ui.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { SaleItem } from '../../core/models';

interface ItemRow {
  name: FormControl<string>;
  qty: FormControl<number>;
  rate: FormControl<number>;
  gstRate: FormControl<number>;
}

@Component({
  selector: 'app-sales-return',
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
              <label class="form-label">Return No.</label>
              <input class="form-control mono" [value]="sales.nextReturnNo()" readonly />
            </div>
            <div class="col-md-3">
              <label class="form-label">Date<span class="required-mark">*</span></label>
              <input type="date" class="form-control" formControlName="date" />
            </div>
            <div class="col-md-6">
              <label class="form-label">Original Invoice</label>
              <select class="form-select" formControlName="originalInvoiceNo" (change)="onInvoice()">
                <option value="">— Select invoice (optional) —</option>
                @for (s of sales.sales(); track s.id) {
                  <option [value]="s.invoiceNo">{{ s.invoiceNo }} · {{ s.customerName }} · ₹{{ s.grandTotal | indianNumber }}</option>
                }
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">Customer<span class="required-mark">*</span></label>
              <input class="form-control" formControlName="customerName" [class.is-invalid]="invalid('customerName')" />
              @if (invalid('customerName')) {<div class="invalid-feedback d-block">Customer is required.</div>}
            </div>
            <div class="col-md-6">
              <label class="form-label">Reason<span class="required-mark">*</span></label>
              <input class="form-control" formControlName="reason" placeholder="e.g. Damaged goods, wrong item"
                     [class.is-invalid]="invalid('reason')" />
              @if (invalid('reason')) {<div class="invalid-feedback d-block">Reason is required.</div>}
            </div>
          </div>
        </div>
      </section>

      <section class="card mb-3">
        <div class="card-header"><i class="bi bi-arrow-return-left me-2 text-accent"></i>Items Returned</div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-bordered table-sm align-middle mb-0">
              <thead class="table-light">
                <tr><th style="width:34%">Item</th><th class="text-end">Qty</th><th class="text-end">Rate</th>
                  <th class="text-end">Amount</th><th class="text-end">GST%</th><th class="text-end">Total</th><th></th></tr>
              </thead>
              <tbody formArrayName="items">
                @for (row of items.controls; track $index) {
                  <tr [formGroupName]="$index">
                    <td><input class="form-control form-control-sm" formControlName="name" /></td>
                    <td><input type="number" min="0" class="form-control form-control-sm amt" formControlName="qty" /></td>
                    <td><input type="number" min="0" step="0.01" class="form-control form-control-sm amt" formControlName="rate" /></td>
                    <td class="amt">{{ amount(row) | indianNumber }}</td>
                    <td><input type="number" min="0" step="0.01" class="form-control form-control-sm amt" formControlName="gstRate" /></td>
                    <td class="amt fw-semibold">{{ (amount(row) + gst(row)) | indianNumber }}</td>
                    <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger py-0"
                          [disabled]="items.length <= 1" (click)="removeItem($index)"><i class="bi bi-x-lg"></i></button></td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr><td colspan="7"><button type="button" class="btn btn-sm btn-outline-primary" (click)="addItem()">
                  <i class="bi bi-plus-lg me-1"></i>Add Item</button></td></tr>
                <tr class="fw-bold" style="background:var(--surface)">
                  <td colspan="3" class="text-end">Total Return Value</td>
                  <td class="amt" colspan="3">₹{{ totals().grandTotal | indianNumber }}</td><td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p class="small text-muted mt-2 mb-0">
            <i class="bi bi-info-circle me-1"></i>Journal: Sales Return A/c Dr · GST Payable A/c Dr · To {{ form.controls.customerName.value || 'Customer' }} A/c
          </p>
        </div>
      </section>

      <button type="submit" class="btn btn-primary px-4"><i class="bi bi-check2-circle me-1"></i>Post Sales Return</button>
    </form>
  `
})
export class SalesReturnComponent {
  private readonly fb = inject(FormBuilder);
  readonly sales = inject(SalesService);
  private readonly ui = inject(UiService);

  readonly form = this.fb.nonNullable.group({
    date: [new Date().toISOString().slice(0, 10), [Validators.required]],
    originalInvoiceNo: [''],
    customerName: ['', [Validators.required]],
    reason: ['', [Validators.required]],
    items: this.fb.nonNullable.array<FormGroup<ItemRow>>([this.newItem()])
  });

  private readonly fv = toSignal(this.form.valueChanges);
  readonly totals = computed(() => {
    this.fv();
    return this.sales.totals(this.readItems());
  });

  constructor() {
    this.sales.sync();
  }

  private newItem(name = '', qty = 1, rate = 0, gstRate = 18): FormGroup<ItemRow> {
    return this.fb.nonNullable.group({ name: [name], qty: [qty], rate: [rate], gstRate: [gstRate] });
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
  amount(row: FormGroup<ItemRow>): number {
    return (row.controls.qty.value || 0) * (row.controls.rate.value || 0);
  }
  gst(row: FormGroup<ItemRow>): number {
    return (this.amount(row) * (row.controls.gstRate.value || 0)) / 100;
  }
  private readItems(): SaleItem[] {
    return this.items.controls.map((c) => ({
      name: c.controls.name.value,
      qty: c.controls.qty.value || 0,
      rate: c.controls.rate.value || 0,
      gstRate: c.controls.gstRate.value || 0
    }));
  }
  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  onInvoice(): void {
    const inv = this.sales.sales().find((s) => s.invoiceNo === this.form.controls.originalInvoiceNo.value);
    if (!inv) {
      return;
    }
    this.form.controls.customerName.setValue(inv.customerName);
    this.items.clear();
    for (const it of inv.items) {
      this.items.push(this.newItem(it.name, it.qty, it.rate, it.gstRate));
    }
  }

  submit(): void {
    if (this.form.controls.customerName.invalid || this.form.controls.reason.invalid) {
      this.form.markAllAsTouched();
      this.ui.toast('Customer and reason are required.', 'warning');
      return;
    }
    const items = this.readItems().filter((it) => it.name.trim() && it.qty > 0 && it.rate > 0);
    if (items.length === 0) {
      this.ui.toast('Add at least one returned item.', 'warning');
      return;
    }
    const v = this.form.getRawValue();
    const ret = this.sales.createReturn({
      returnNo: this.sales.nextReturnNo(),
      date: new Date(v.date).toISOString(),
      originalInvoiceNo: v.originalInvoiceNo || '—',
      customerName: v.customerName.trim(),
      items,
      reason: v.reason.trim()
    });
    this.ui.toast(`Sales return ${ret.returnNo} posted (₹${ret.grandTotal.toFixed(2)}).`, 'success');
    this.items.clear();
    this.items.push(this.newItem());
    this.form.reset({ date: new Date().toISOString().slice(0, 10), originalInvoiceNo: '', customerName: '', reason: '' });
  }
}
