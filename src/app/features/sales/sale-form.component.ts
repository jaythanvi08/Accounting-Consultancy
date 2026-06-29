import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { SalesService } from '../../core/services/sales.service';
import { LedgerService } from '../../core/services/ledger.service';
import { UiService } from '../../core/services/ui.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { PaymentMode, SaleItem, SaleType } from '../../core/models';

interface ItemRow {
  name: FormControl<string>;
  qty: FormControl<number>;
  rate: FormControl<number>;
  gstRate: FormControl<number>;
}

@Component({
  selector: 'app-sale-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IndianNumberPipe],
  styles: [
    `
      .amt { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
      input.amt { text-align: right; }
      .totals { max-width: 320px; margin-left: auto; }
      .totals .row-line { display: flex; justify-content: space-between; padding: 0.25rem 0; }
      .totals .grand { border-top: 2px solid var(--primary); font-weight: 700; font-size: 1.05rem; padding-top: 0.4rem; }
    `
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <section class="card mb-3">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-3">
              <label class="form-label">Invoice No.</label>
              <input class="form-control mono" [value]="invoiceNo()" readonly />
            </div>
            <div class="col-md-3">
              <label class="form-label">Date<span class="required-mark">*</span></label>
              <input type="date" class="form-control" formControlName="date" />
            </div>
            <div class="col-md-6">
              <label class="form-label">Customer Name<span class="required-mark">*</span></label>
              <input class="form-control" formControlName="customerName" placeholder="Customer / party name"
                     [class.is-invalid]="invalid('customerName')" />
              @if (invalid('customerName')) {<div class="invalid-feedback d-block">Customer name is required.</div>}
            </div>

            @if (mode() === 'Cash') {
              <div class="col-md-3">
                <label class="form-label">Payment Mode</label>
                <select class="form-select" formControlName="paymentMode">
                  <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Card">Card</option>
                </select>
              </div>
            } @else {
              <div class="col-md-4">
                <label class="form-label">Debtor Ledger<span class="required-mark">*</span></label>
                <input class="form-control" formControlName="debtorLedger" list="debtorLedgers" placeholder="Search ledger…"
                       [class.is-invalid]="invalid('debtorLedger')" />
                <datalist id="debtorLedgers">@for (l of ledgers.ledgers(); track l.id) {<option [value]="l.name"></option>}</datalist>
                @if (invalid('debtorLedger')) {<div class="invalid-feedback d-block">Select the debtor ledger.</div>}
              </div>
              <div class="col-md-3">
                <label class="form-label">Credit Period (days)</label>
                <input type="number" min="0" class="form-control" formControlName="creditPeriodDays" />
              </div>
              <div class="col-md-3">
                <label class="form-label">Due Date</label>
                <input class="form-control" [value]="dueDate()" readonly />
              </div>
            }
          </div>
        </div>
      </section>

      <section class="card mb-3">
        <div class="card-header"><i class="bi bi-box-seam me-2 text-accent"></i>Items Sold</div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-bordered table-sm align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width:30%">Item</th><th class="text-end">Qty</th><th class="text-end">Rate</th>
                  <th class="text-end">Amount</th><th class="text-end">GST%</th><th class="text-end">GST Amt</th>
                  <th class="text-end">Total</th><th></th>
                </tr>
              </thead>
              <tbody formArrayName="items">
                @for (row of items.controls; track $index) {
                  <tr [formGroupName]="$index">
                    <td><input class="form-control form-control-sm" formControlName="name" placeholder="Item name" /></td>
                    <td><input type="number" min="0" class="form-control form-control-sm amt" formControlName="qty" /></td>
                    <td><input type="number" min="0" step="0.01" class="form-control form-control-sm amt" formControlName="rate" /></td>
                    <td class="amt">{{ amount(row) | indianNumber }}</td>
                    <td><input type="number" min="0" step="0.01" class="form-control form-control-sm amt" formControlName="gstRate" /></td>
                    <td class="amt">{{ gst(row) | indianNumber }}</td>
                    <td class="amt fw-semibold">{{ (amount(row) + gst(row)) | indianNumber }}</td>
                    <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger py-0"
                          [disabled]="items.length <= 1" (click)="removeItem($index)"><i class="bi bi-x-lg"></i></button></td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr><td colspan="8"><button type="button" class="btn btn-sm btn-outline-primary" (click)="addItem()">
                  <i class="bi bi-plus-lg me-1"></i>Add Item</button></td></tr>
              </tfoot>
            </table>
          </div>

          <div class="row mt-3">
            <div class="col-md-7">
              <label class="form-label">Narration</label>
              <input class="form-control" formControlName="narration" placeholder="Being goods sold…" />
            </div>
            <div class="col-md-5">
              <div class="totals">
                <div class="row-line"><span>Total Amount</span><span class="mono">₹{{ totals().subTotal | indianNumber }}</span></div>
                <div class="row-line"><span>GST Total</span><span class="mono">₹{{ totals().gstTotal | indianNumber }}</span></div>
                <div class="row-line grand"><span>Grand Total</span><span class="mono">₹{{ totals().grandTotal | indianNumber }}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary px-4"><i class="bi bi-check2-circle me-1"></i>Save {{ mode() }} Sale</button>
        <button type="button" class="btn btn-outline-secondary" (click)="reset()">Clear</button>
      </div>
    </form>
  `
})
export class SaleFormComponent {
  readonly mode = input.required<SaleType>();

  private readonly fb = inject(FormBuilder);
  private readonly sales = inject(SalesService);
  readonly ledgers = inject(LedgerService);
  private readonly ui = inject(UiService);

  readonly form = this.fb.nonNullable.group({
    date: [new Date().toISOString().slice(0, 10), [Validators.required]],
    customerName: ['', [Validators.required]],
    paymentMode: ['Cash' as PaymentMode],
    debtorLedger: [''],
    creditPeriodDays: [30],
    narration: [''],
    items: this.fb.nonNullable.array<FormGroup<ItemRow>>([this.newItem()])
  });

  private readonly fv = toSignal(this.form.valueChanges);

  readonly invoiceNo = computed(() => {
    this.sales.sales(); // recompute after a save
    return this.sales.nextInvoiceNo(this.mode());
  });

  readonly totals = computed(() => {
    this.fv();
    return this.sales.totals(this.readItems());
  });

  readonly dueDate = computed(() => {
    this.fv();
    const base = this.form.controls.date.value;
    const days = this.form.controls.creditPeriodDays.value || 0;
    if (!base) {
      return '';
    }
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-IN');
  });

  constructor() {
    this.sales.sync();
    this.ledgers.sync();
  }

  private newItem(name = '', qty = 1, rate = 0, gstRate = 18): FormGroup<ItemRow> {
    return this.fb.nonNullable.group({
      name: [name],
      qty: [qty],
      rate: [rate],
      gstRate: [gstRate]
    });
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

  submit(): void {
    const credit = this.mode() === 'Credit';
    this.form.controls.debtorLedger.setValidators(credit ? [Validators.required] : []);
    this.form.controls.debtorLedger.updateValueAndValidity();

    if (this.form.controls.customerName.invalid || this.form.controls.date.invalid || (credit && this.form.controls.debtorLedger.invalid)) {
      this.form.markAllAsTouched();
      this.ui.toast('Please complete the required fields.', 'warning');
      return;
    }

    const items = this.readItems().filter((it) => it.name.trim() && it.qty > 0 && it.rate > 0);
    if (items.length === 0) {
      this.ui.toast('Add at least one item with quantity and rate.', 'warning');
      return;
    }

    const v = this.form.getRawValue();
    const dueIso = credit
      ? (() => {
          const d = new Date(v.date);
          d.setDate(d.getDate() + (v.creditPeriodDays || 0));
          return d.toISOString();
        })()
      : undefined;

    const invoice = this.sales.createSale({
      invoiceNo: this.invoiceNo(),
      date: new Date(v.date).toISOString(),
      customerName: v.customerName.trim(),
      type: this.mode(),
      items,
      paymentMode: this.mode() === 'Cash' ? v.paymentMode : undefined,
      debtorLedger: credit ? v.debtorLedger : undefined,
      creditPeriodDays: credit ? v.creditPeriodDays : undefined,
      dueDate: dueIso,
      narration: v.narration || undefined
    });

    this.ui.toast(`Invoice ${invoice.invoiceNo} saved (₹${invoice.grandTotal.toFixed(2)}).`, 'success');
    this.reset();
  }

  reset(): void {
    this.items.clear();
    this.items.push(this.newItem());
    this.form.reset({
      date: new Date().toISOString().slice(0, 10),
      customerName: '',
      paymentMode: 'Cash',
      debtorLedger: '',
      creditPeriodDays: 30,
      narration: ''
    });
  }
}
