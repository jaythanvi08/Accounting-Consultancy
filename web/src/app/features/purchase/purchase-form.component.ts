import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { PurchaseService } from '../../core/services/purchase.service';
import { LedgerService } from '../../core/services/ledger.service';
import { UiService } from '../../core/services/ui.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { PurchaseItem, PurchasePaymentMode, PurchaseType } from '../../core/models';

interface ItemRow {
  name: FormControl<string>;
  qty: FormControl<number>;
  rate: FormControl<number>;
  discountPct: FormControl<number>;
  gstRate: FormControl<number>;
}

@Component({
  selector: 'app-purchase-form',
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
              <label class="form-label">Supplier Name<span class="required-mark">*</span></label>
              <input class="form-control" formControlName="supplierName" placeholder="Supplier / vendor name"
                     [class.is-invalid]="invalid('supplierName')" />
              @if (invalid('supplierName')) {<div class="invalid-feedback d-block">Supplier name is required.</div>}
            </div>

            @if (mode() === 'Cash') {
              <div class="col-md-3">
                <label class="form-label">Payment Mode</label>
                <select class="form-select" formControlName="paymentMode">
                  <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Card">Card</option><option value="Cheque">Cheque</option>
                </select>
              </div>
            } @else {
              <div class="col-md-4">
                <label class="form-label">Creditor Ledger<span class="required-mark">*</span></label>
                <input class="form-control" formControlName="creditorLedger" list="creditorLedgers" placeholder="Search ledger…"
                       [class.is-invalid]="invalid('creditorLedger')" />
                <datalist id="creditorLedgers">@for (l of ledgers.ledgers(); track l.id) {<option [value]="l.name"></option>}</datalist>
                @if (invalid('creditorLedger')) {<div class="invalid-feedback d-block">Select the creditor ledger.</div>}
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
        <div class="card-header"><i class="bi bi-box-seam me-2 text-accent"></i>Items Purchased</div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-bordered table-sm align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width:26%">Item</th><th class="text-end">Qty</th><th class="text-end">Rate</th>
                  <th class="text-end">Disc%</th><th class="text-end">Taxable</th><th class="text-end">GST%</th>
                  <th class="text-end">GST</th><th class="text-end">Amount</th><th></th>
                </tr>
              </thead>
              <tbody formArrayName="items">
                @for (row of items.controls; track $index) {
                  <tr [formGroupName]="$index">
                    <td><input class="form-control form-control-sm" formControlName="name" placeholder="Item name" /></td>
                    <td><input type="number" min="0" class="form-control form-control-sm amt" formControlName="qty" /></td>
                    <td><input type="number" min="0" step="0.01" class="form-control form-control-sm amt" formControlName="rate" /></td>
                    <td><input type="number" min="0" max="100" step="0.01" class="form-control form-control-sm amt" formControlName="discountPct" /></td>
                    <td class="amt">{{ taxable(row) | indianNumber }}</td>
                    <td><input type="number" min="0" step="0.01" class="form-control form-control-sm amt" formControlName="gstRate" /></td>
                    <td class="amt">{{ gst(row) | indianNumber }}</td>
                    <td class="amt fw-semibold">{{ (taxable(row) + gst(row)) | indianNumber }}</td>
                    <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger py-0"
                          [disabled]="items.length <= 1" (click)="removeItem($index)"><i class="bi bi-x-lg"></i></button></td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr><td colspan="9"><button type="button" class="btn btn-sm btn-outline-primary" (click)="addItem()">
                  <i class="bi bi-plus-lg me-1"></i>Add Item</button></td></tr>
              </tfoot>
            </table>
          </div>

          <div class="row mt-3">
            <div class="col-md-7">
              <label class="form-label">Narration</label>
              <input class="form-control" formControlName="narration" placeholder="Being goods purchased…" />
              <p class="small text-muted mt-2 mb-0">
                <i class="bi bi-info-circle me-1"></i>Journal: Purchase A/c Dr · GST Input Tax Dr · To
                {{ mode() === 'Cash' ? 'Cash/Bank' : (form.controls.creditorLedger.value || 'Creditor') }} A/c
              </p>
            </div>
            <div class="col-md-5">
              <div class="totals">
                <div class="row-line"><span>Total (taxable)</span><span class="mono">₹{{ totals().subTotal | indianNumber }}</span></div>
                <div class="row-line"><span>GST Input</span><span class="mono">₹{{ totals().gstTotal | indianNumber }}</span></div>
                <div class="row-line grand"><span>Net Payable</span><span class="mono">₹{{ totals().grandTotal | indianNumber }}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary px-4"><i class="bi bi-check2-circle me-1"></i>Save {{ mode() }} Purchase</button>
        <button type="button" class="btn btn-outline-secondary" (click)="reset()">Clear</button>
      </div>
    </form>
  `
})
export class PurchaseFormComponent {
  readonly mode = input.required<PurchaseType>();

  private readonly fb = inject(FormBuilder);
  private readonly purchases = inject(PurchaseService);
  readonly ledgers = inject(LedgerService);
  private readonly ui = inject(UiService);

  readonly form = this.fb.nonNullable.group({
    date: [new Date().toISOString().slice(0, 10), [Validators.required]],
    supplierName: ['', [Validators.required]],
    paymentMode: ['Cash' as PurchasePaymentMode],
    creditorLedger: [''],
    creditPeriodDays: [30],
    narration: [''],
    items: this.fb.nonNullable.array<FormGroup<ItemRow>>([this.newItem()])
  });

  private readonly fv = toSignal(this.form.valueChanges);

  readonly invoiceNo = computed(() => {
    this.purchases.purchases();
    return this.purchases.nextInvoiceNo(this.mode());
  });
  readonly totals = computed(() => {
    this.fv();
    return this.purchases.totals(this.readItems());
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
    this.purchases.sync();
    this.ledgers.sync();
  }

  private newItem(name = '', qty = 1, rate = 0, discountPct = 0, gstRate = 18): FormGroup<ItemRow> {
    return this.fb.nonNullable.group({
      name: [name],
      qty: [qty],
      rate: [rate],
      discountPct: [discountPct],
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

  taxable(row: FormGroup<ItemRow>): number {
    const base = (row.controls.qty.value || 0) * (row.controls.rate.value || 0);
    return base * (1 - (row.controls.discountPct.value || 0) / 100);
  }
  gst(row: FormGroup<ItemRow>): number {
    return (this.taxable(row) * (row.controls.gstRate.value || 0)) / 100;
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

  submit(): void {
    const credit = this.mode() === 'Credit';
    this.form.controls.creditorLedger.setValidators(credit ? [Validators.required] : []);
    this.form.controls.creditorLedger.updateValueAndValidity();

    if (this.form.controls.supplierName.invalid || this.form.controls.date.invalid || (credit && this.form.controls.creditorLedger.invalid)) {
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

    const invoice = this.purchases.createPurchase({
      invoiceNo: this.invoiceNo(),
      date: new Date(v.date).toISOString(),
      supplierName: v.supplierName.trim(),
      type: this.mode(),
      items,
      paymentMode: this.mode() === 'Cash' ? v.paymentMode : undefined,
      creditorLedger: credit ? v.creditorLedger : undefined,
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
      supplierName: '',
      paymentMode: 'Cash',
      creditorLedger: '',
      creditPeriodDays: 30,
      narration: ''
    });
  }
}
