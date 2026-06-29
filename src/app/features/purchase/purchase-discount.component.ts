import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PurchaseService } from '../../core/services/purchase.service';
import { LedgerService } from '../../core/services/ledger.service';
import { UiService } from '../../core/services/ui.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';

type DiscountKind = 'Trade' | 'Cash';

@Component({
  selector: 'app-purchase-discount',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IndianNumberPipe],
  styles: [
    `
      .calc-line { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed var(--border); }
      .calc-line .mono { font-family: var(--font-mono); }
      .result { font-size: 1.3rem; font-weight: 700; font-family: var(--font-mono); color: var(--accent); }
    `
  ],
  template: `
    <div class="card" style="max-width: 640px">
      <div class="card-header"><i class="bi bi-percent me-2 text-accent"></i>Purchase Discount</div>
      <div class="card-body">
        <div class="mb-3">
          <label class="form-label d-block">Discount Type</label>
          <div class="d-flex gap-4 pt-1">
            <label class="d-inline-flex align-items-center gap-2">
              <input class="form-check-input mt-0" type="radio" name="kind" [checked]="kind() === 'Trade'" (change)="kind.set('Trade')" /> Trade Discount
            </label>
            <label class="d-inline-flex align-items-center gap-2">
              <input class="form-check-input mt-0" type="radio" name="kind" [checked]="kind() === 'Cash'" (change)="kind.set('Cash')" /> Cash Discount
            </label>
          </div>
        </div>

        <div class="alert {{ kind() === 'Trade' ? 'alert-info' : 'alert-success' }} py-2 small">
          @if (kind() === 'Trade') {
            <i class="bi bi-info-circle me-1"></i><strong>Trade discount</strong> is deducted on the invoice itself and is <em>not</em> recorded in the books.
          } @else {
            <i class="bi bi-info-circle me-1"></i><strong>Cash discount</strong> is an income — recorded as <em>Discount Received A/c Cr</em> when settling the creditor.
          }
        </div>

        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Invoice Amount (₹)</label>
            <input type="number" min="0" step="0.01" class="form-control mono" [value]="amount()" (input)="amount.set(+$any($event.target).value)" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Discount %</label>
            <input type="number" min="0" max="100" step="0.01" class="form-control mono" [value]="pct()" (input)="pct.set(+$any($event.target).value)" />
          </div>
          @if (kind() === 'Cash') {
            <div class="col-12">
              <label class="form-label">Creditor Ledger</label>
              <input class="form-control" list="discCreditors" [value]="creditor()" (input)="creditor.set($any($event.target).value)" placeholder="Search ledger…" />
              <datalist id="discCreditors">@for (l of ledgers.ledgers(); track l.id) {<option [value]="l.name"></option>}</datalist>
            </div>
          }
        </div>

        <div class="mt-3">
          <div class="calc-line"><span>Discount Amount</span><span class="mono">₹{{ discount() | indianNumber }}</span></div>
          <div class="calc-line"><span class="fw-semibold">Net Amount</span><span class="result">₹{{ net() | indianNumber }}</span></div>
        </div>

        @if (kind() === 'Cash') {
          <button class="btn btn-primary btn-sm mt-3" [disabled]="discount() <= 0" (click)="post()">
            <i class="bi bi-journal-check me-1"></i>Record Cash Discount Entry
          </button>
          <p class="small text-muted mt-2 mb-0">
            Posts: {{ creditor() || 'Creditor' }} A/c Dr ₹{{ amount() | indianNumber }} · To Bank ₹{{ net() | indianNumber }} · To Discount Received ₹{{ discount() | indianNumber }}
          </p>
        }
      </div>
    </div>
  `
})
export class PurchaseDiscountComponent {
  private readonly purchases = inject(PurchaseService);
  readonly ledgers = inject(LedgerService);
  private readonly ui = inject(UiService);

  readonly kind = signal<DiscountKind>('Trade');
  readonly amount = signal(0);
  readonly pct = signal(0);
  readonly creditor = signal('');

  readonly discount = computed(() => (this.amount() * this.pct()) / 100);
  readonly net = computed(() => this.amount() - this.discount());

  constructor() {
    this.purchases.sync();
    this.ledgers.sync();
  }

  post(): void {
    const voucher = this.purchases.recordCashDiscount(
      this.creditor(),
      this.amount(),
      this.discount(),
      new Date().toISOString()
    );
    if (voucher) {
      this.ui.toast(`Cash discount recorded — voucher ${voucher.voucherNo}.`, 'success');
    }
  }
}
