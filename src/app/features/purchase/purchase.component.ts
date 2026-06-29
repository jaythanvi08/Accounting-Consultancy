import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PurchaseService } from '../../core/services/purchase.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PurchaseFormComponent } from './purchase-form.component';
import { PurchaseReturnComponent } from './purchase-return.component';
import { PurchaseDiscountComponent } from './purchase-discount.component';

type PurchaseTab = 'cash' | 'credit' | 'discount' | 'return';

@Component({
  selector: 'app-purchase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, PurchaseFormComponent, PurchaseReturnComponent, PurchaseDiscountComponent],
  styles: [
    `
      .book-tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; border-bottom: 2px solid var(--border); margin-bottom: 1rem; }
      .book-tab { border: none; background: transparent; padding: 0.6rem 1.05rem; font-family: var(--font-heading); font-weight: 600; font-size: 0.9rem; color: var(--text-secondary); border-bottom: 3px solid transparent; margin-bottom: -2px; cursor: pointer; }
      .book-tab:hover { color: var(--primary); }
      .book-tab.active { color: var(--primary); border-bottom-color: var(--accent); }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header title="Purchase Management" subtitle="Cash & credit purchases, discounts and returns" icon="bi-cart3" />

      <div class="book-tabs">
        @for (t of tabs; track t.key) {
          <button class="book-tab" [class.active]="active() === t.key" (click)="active.set(t.key)">
            <i class="bi {{ t.icon }} me-1"></i>{{ t.label }}
          </button>
        }
      </div>

      @switch (active()) {
        @case ('cash') { <app-purchase-form mode="Cash" /> }
        @case ('credit') { <app-purchase-form mode="Credit" /> }
        @case ('discount') { <app-purchase-discount /> }
        @case ('return') { <app-purchase-return /> }
      }
    </div>
  `
})
export class PurchaseComponent {
  private readonly purchases = inject(PurchaseService);
  private readonly route = inject(ActivatedRoute);

  readonly tabs: ReadonlyArray<{ key: PurchaseTab; label: string; icon: string }> = [
    { key: 'cash', label: 'Cash Purchase', icon: 'bi-cash' },
    { key: 'credit', label: 'Credit Purchase', icon: 'bi-credit-card' },
    { key: 'discount', label: 'Purchase Discount', icon: 'bi-percent' },
    { key: 'return', label: 'Purchase Return', icon: 'bi-arrow-return-right' }
  ];

  readonly active = signal<PurchaseTab>('cash');

  constructor() {
    this.purchases.sync();
    const section = this.route.snapshot.paramMap.get('section') as PurchaseTab | null;
    if (section && this.tabs.some((t) => t.key === section)) {
      this.active.set(section);
    }
  }
}
