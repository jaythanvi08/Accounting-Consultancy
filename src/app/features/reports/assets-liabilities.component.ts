import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { LedgerService } from '../../core/services/ledger.service';
import { AssetService } from '../../core/services/asset.service';
import { CompanyService } from '../../core/services/company.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';

Chart.register(...registerables);

interface LineItem {
  label: string;
  amount: number;
}
interface Section {
  key: string;
  title: string;
  icon: string;
  color: string;
  items: LineItem[];
  total: number;
}
interface BalanceModel {
  assets: Section[];
  equity: Section[];
  totalAssets: number;
  totalEquity: number;
  diff: number;
  balanced: boolean;
  donut: { labels: string[]; values: number[]; colors: string[] };
}

@Component({
  selector: 'app-assets-liabilities',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IndianNumberPipe],
  styles: [
    `
      .bs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      @media (max-width: 900px) { .bs-grid { grid-template-columns: 1fr; } }
      .sect { border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 0.75rem; overflow: hidden; }
      .sect__head { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.85rem; cursor: pointer; font-family: var(--font-heading); font-weight: 600; border-left: 4px solid var(--c); }
      .sect__total { margin-left: auto; font-family: var(--font-mono); }
      .line { display: flex; justify-content: space-between; padding: 0.4rem 0.85rem 0.4rem 1.6rem; border-top: 1px dashed var(--border); font-size: 0.9rem; }
      .line .amt { font-family: var(--font-mono); }
      .line-empty { padding: 0.4rem 0.85rem 0.4rem 1.6rem; border-top: 1px dashed var(--border); color: var(--text-muted); font-style: italic; font-size: 0.85rem; }
      .side-total { display: flex; justify-content: space-between; padding: 0.7rem 0.85rem; font-family: var(--font-heading); font-weight: 700; background: var(--surface); border-radius: var(--radius-sm); }
      .side-total .v { font-family: var(--font-mono); }
      .chev { transition: transform var(--transition); }
      .chev.open { transform: rotate(90deg); }
      .donut-wrap { max-width: 320px; margin: 0 auto; }
      .eqn-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.6rem; font-family: var(--font-heading); font-weight: 700; }
      .eqn-bar .chip { font-family: var(--font-mono); padding: 0.3rem 0.7rem; border-radius: var(--radius-sm); }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header
        title="Assets & Liabilities"
        subtitle="Live position from ledgers & the fixed-asset register"
        icon="bi-columns-gap"
      />

      @if (totalEmpty()) {
        <div class="card"><div class="card-body text-center text-muted py-5">
          <i class="bi bi-columns-gap fs-1 d-block mb-2"></i>
          No balances yet. Add ledgers (with opening balances) or asset accounts to see the position.
        </div></div>
      } @else {
        <div class="bs-grid">
          <!-- ASSETS (left) -->
          <div>
            <h2 class="h6 display text-uppercase text-secondary mb-2">Assets</h2>
            @for (s of model().assets; track s.key) {
              <div class="sect" [style.--c]="s.color">
                <div class="sect__head" (click)="toggle(s.key)">
                  <i class="bi bi-chevron-right chev" [class.open]="isOpen(s.key)"></i>
                  <i class="bi {{ s.icon }}" [style.color]="s.color"></i>{{ s.title }}
                  <span class="sect__total">₹{{ s.total | indianNumber }}</span>
                </div>
                @if (isOpen(s.key)) {
                  @for (it of s.items; track $index) {
                    <div class="line"><span>{{ it.label }}</span><span class="amt">₹{{ it.amount | indianNumber }}</span></div>
                  } @empty {
                    <div class="line-empty">No balances.</div>
                  }
                }
              </div>
            }
            <div class="side-total"><span>Total Assets</span><span class="v">₹{{ model().totalAssets | indianNumber }}</span></div>
          </div>

          <!-- LIABILITIES + CAPITAL (right) -->
          <div>
            <h2 class="h6 display text-uppercase text-secondary mb-2">Liabilities &amp; Capital</h2>
            @for (s of model().equity; track s.key) {
              <div class="sect" [style.--c]="s.color">
                <div class="sect__head" (click)="toggle(s.key)">
                  <i class="bi bi-chevron-right chev" [class.open]="isOpen(s.key)"></i>
                  <i class="bi {{ s.icon }}" [style.color]="s.color"></i>{{ s.title }}
                  <span class="sect__total">₹{{ s.total | indianNumber }}</span>
                </div>
                @if (isOpen(s.key)) {
                  @for (it of s.items; track $index) {
                    <div class="line"><span>{{ it.label }}</span><span class="amt">₹{{ it.amount | indianNumber }}</span></div>
                  } @empty {
                    <div class="line-empty">No balances.</div>
                  }
                }
              </div>
            }
            <div class="side-total"><span>Total Liabilities &amp; Capital</span><span class="v">₹{{ model().totalEquity | indianNumber }}</span></div>
          </div>
        </div>

        <!-- Equation verification -->
        <div class="card mt-3">
          <div class="card-body">
            <div class="eqn-bar mb-2">
              <span class="chip bg-soft-primary text-primary">Assets ₹{{ model().totalAssets | indianNumber }}</span>
              <span>=</span>
              <span class="chip bg-soft-danger text-credit">Liabilities + Capital ₹{{ model().totalEquity | indianNumber }}</span>
            </div>
            <p class="text-center mb-0" [class.text-success]="model().balanced" [class.text-danger]="!model().balanced">
              <i class="bi" [class.bi-check-circle-fill]="model().balanced" [class.bi-exclamation-triangle-fill]="!model().balanced"></i>
              @if (model().balanced) { Balance Sheet tallies — the accounting equation holds. }
              @else { Out of balance by ₹{{ model().diff | indianNumber }}. }
            </p>
          </div>
        </div>

        <!-- Asset composition donut -->
        @if (model().donut.values.length) {
          <div class="card mt-3">
            <div class="card-header"><i class="bi bi-pie-chart me-2 text-accent"></i>Asset Composition</div>
            <div class="card-body">
              <div class="donut-wrap"><canvas #donut></canvas></div>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class AssetsLiabilitiesComponent implements AfterViewInit, OnDestroy {
  private readonly ledgers = inject(LedgerService);
  private readonly assets = inject(AssetService);
  private readonly companies = inject(CompanyService);

  private readonly donutCanvas = viewChild<ElementRef<HTMLCanvasElement>>('donut');
  private chart: { destroy: () => void } | null = null;

  private readonly expanded = signal<Set<string>>(
    new Set(['fixed', 'investments', 'current', 'capital', 'long', 'currentLiab'])
  );

  readonly model = computed<BalanceModel>(() => this.build());
  readonly totalEmpty = computed(() => this.model().totalAssets === 0 && this.model().totalEquity === 0);

  constructor() {
    this.ledgers.sync();
    this.assets.sync();
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }
  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  isOpen(key: string): boolean {
    return this.expanded().has(key);
  }
  toggle(key: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  private rootGroupId(groupId: string): string {
    let g = this.ledgers.getGroup(groupId);
    while (g && g.parentId) {
      g = this.ledgers.getGroup(g.parentId);
    }
    return g?.id ?? groupId;
  }

  private build(): BalanceModel {
    const fixed: LineItem[] = [];
    const investments: LineItem[] = [];
    const current: LineItem[] = [];
    const longLiab: LineItem[] = [];
    const currentLiab: LineItem[] = [];
    const capital: LineItem[] = [];
    let income = 0;
    let expense = 0;

    for (const l of this.ledgers.ledgers()) {
      const g = this.ledgers.getGroup(l.groupId);
      if (!g) {
        continue;
      }
      const root = this.rootGroupId(l.groupId);
      const drPositive = this.ledgers.signedOpening(l); // Dr +, Cr −
      const crPositive = -drPositive; // Cr +, Dr −

      switch (g.type) {
        case 'Asset':
          if (root === 'investments') {
            investments.push({ label: l.name, amount: drPositive });
          } else if (root === 'fixed-assets') {
            fixed.push({ label: l.name, amount: drPositive });
          } else {
            current.push({ label: l.name, amount: drPositive });
          }
          break;
        case 'Liability':
          if (root === 'long-term-liabilities') {
            longLiab.push({ label: l.name, amount: crPositive });
          } else {
            currentLiab.push({ label: l.name, amount: crPositive });
          }
          break;
        case 'Capital':
          capital.push({ label: l.name, amount: crPositive });
          break;
        case 'Income':
          income += l.openingBalance;
          break;
        case 'Expense':
          expense += l.openingBalance;
          break;
      }
    }

    // Fixed assets from the register (net of depreciation), grouped by type
    const byType = new Map<string, number>();
    for (const a of this.assets.assets()) {
      if (a.status === 'Active') {
        byType.set(a.type, (byType.get(a.type) ?? 0) + this.assets.bookValue(a));
      }
    }
    for (const [type, val] of byType) {
      fixed.push({ label: `${type} (net of dep.)`, amount: val });
    }

    // Retained earnings (net of the period's income & expense ledgers)
    const retained = income - expense;
    if (Math.abs(retained) >= 0.005) {
      capital.push({ label: 'Retained Earnings (P&L)', amount: retained });
    }

    const sum = (items: LineItem[]): number => items.reduce((s, i) => s + i.amount, 0);

    const assetSections: Section[] = [
      { key: 'fixed', title: 'Fixed Assets', icon: 'bi-building', color: 'var(--info)', items: fixed, total: sum(fixed) },
      { key: 'investments', title: 'Investments', icon: 'bi-graph-up', color: 'var(--info)', items: investments, total: sum(investments) },
      { key: 'current', title: 'Current Assets', icon: 'bi-cash-coin', color: 'var(--info)', items: current, total: sum(current) }
    ];
    const equitySections: Section[] = [
      { key: 'capital', title: 'Capital', icon: 'bi-person-badge', color: 'var(--success)', items: capital, total: sum(capital) },
      { key: 'long', title: 'Long-term Liabilities', icon: 'bi-bank', color: 'var(--danger)', items: longLiab, total: sum(longLiab) },
      { key: 'currentLiab', title: 'Current Liabilities', icon: 'bi-receipt', color: 'var(--danger)', items: currentLiab, total: sum(currentLiab) }
    ];

    const totalAssets = assetSections.reduce((s, sec) => s + sec.total, 0);
    const totalEquity = equitySections.reduce((s, sec) => s + sec.total, 0);

    const donutSrc = assetSections.filter((s) => s.total > 0);
    const donut = {
      labels: donutSrc.map((s) => s.title),
      values: donutSrc.map((s) => Math.round(s.total)),
      colors: ['#1B3A5C', '#C8860A', '#2E5F8A', '#1A7A4A'].slice(0, donutSrc.length)
    };

    return {
      assets: assetSections,
      equity: equitySections,
      totalAssets,
      totalEquity,
      diff: Math.abs(totalAssets - totalEquity),
      balanced: Math.abs(totalAssets - totalEquity) < 1,
      donut
    };
  }

  private renderChart(): void {
    const el = this.donutCanvas()?.nativeElement;
    const d = this.model().donut;
    if (!el || d.values.length === 0) {
      return;
    }
    this.chart?.destroy();
    this.chart = new Chart(el, {
      type: 'doughnut',
      data: { labels: d.labels, datasets: [{ data: d.values, backgroundColor: d.colors }] },
      options: { responsive: true, cutout: '62%', plugins: { legend: { position: 'bottom' } } }
    });
  }
}
