import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SalesService } from '../../core/services/sales.service';
import { BooksService } from '../../core/services/books.service';
import { UiService } from '../../core/services/ui.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';

@Component({
  selector: 'app-cogs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IndianNumberPipe],
  styles: [
    `
      .formula { font-family: var(--font-heading); font-weight: 600; }
      .cogs-line { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed var(--border); }
      .cogs-line .mono { font-family: var(--font-mono); }
      .cogs-result { font-size: 1.4rem; font-weight: 700; font-family: var(--font-mono); color: var(--accent); }
    `
  ],
  template: `
    <div class="card" style="max-width: 640px">
      <div class="card-header"><i class="bi bi-calculator me-2 text-accent"></i>Cost of Goods Sold (COGS)</div>
      <div class="card-body">
        <p class="formula text-secondary mb-3">COGS = Opening Stock + Purchases − Closing Stock</p>

        <div class="cogs-line">
          <label class="mb-0">Opening Stock</label>
          <input type="number" min="0" step="0.01" class="form-control form-control-sm text-end mono" style="max-width:200px"
                 [value]="opening()" (input)="opening.set(+$any($event.target).value)" />
        </div>
        <div class="cogs-line">
          <span>Add: Purchases <small class="text-muted">(live from Purchase Book)</small></span>
          <span class="mono">+ ₹{{ purchases() | indianNumber }}</span>
        </div>
        <div class="cogs-line">
          <label class="mb-0">Less: Closing Stock</label>
          <input type="number" min="0" step="0.01" class="form-control form-control-sm text-end mono" style="max-width:200px"
                 [value]="closing()" (input)="closing.set(+$any($event.target).value)" />
        </div>

        <div class="d-flex justify-content-between align-items-center mt-3">
          <span class="formula">Cost of Goods Sold</span>
          <span class="cogs-result">₹{{ cogs() | indianNumber }}</span>
        </div>

        <button class="btn btn-outline-primary btn-sm mt-3" (click)="saveStock()">
          <i class="bi bi-save me-1"></i>Save Stock Figures
        </button>
        <p class="small text-muted mt-2 mb-0">
          <i class="bi bi-info-circle me-1"></i>Purchases are summed live from the Purchase Book; opening &amp; closing stock are entered here (until the Stock module is wired in).
        </p>
      </div>
    </div>
  `
})
export class CogsComponent {
  private readonly sales = inject(SalesService);
  private readonly books = inject(BooksService);
  private readonly ui = inject(UiService);

  readonly opening = signal(0);
  readonly closing = signal(0);

  /** Taxable purchases summed live from the Purchase Book. */
  readonly purchases = computed(() => {
    this.books.purchases();
    return this.books.filterPurchases('', '').reduce((s, p) => s + p.amount, 0);
  });

  readonly cogs = computed(() => this.opening() + this.purchases() - this.closing());

  constructor() {
    this.sales.sync();
    this.books.sync();
    this.opening.set(this.sales.stock().opening);
    this.closing.set(this.sales.stock().closing);
  }

  saveStock(): void {
    this.sales.setStock({ opening: this.opening(), closing: this.closing() });
    this.ui.toast('Stock figures saved.', 'success');
  }
}
