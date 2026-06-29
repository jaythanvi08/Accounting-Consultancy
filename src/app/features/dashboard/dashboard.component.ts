import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  viewChild
} from '@angular/core';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { CompanyService } from '../../core/services/company.service';
import { AuthService } from '../../core/services/auth.service';
import { LedgerService } from '../../core/services/ledger.service';
import { VoucherService } from '../../core/services/voucher.service';
import { AssetService } from '../../core/services/asset.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';

Chart.register(...registerables);

interface Kpi {
  label: string;
  value: number;
  icon: string;
  tone: 'primary' | 'success' | 'danger' | 'accent';
}

interface RecentTx {
  id: string;
  voucherNo: string;
  date: string;
  narration: string;
  debit: number;
  credit: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IndianNumberPipe, DateFormatPipe],
  styles: [
    `
      .kpi-card {
        background: #fff;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 1.2rem;
        transition: all 0.2s;
      }
      .kpi-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      .kpi-card__label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.03em; margin-bottom: 0.3rem; }
      .kpi-card__value { font-size: 1.5rem; font-family: var(--font-mono); font-weight: 700; color: var(--primary); }
      .kpi-card__icon { width: 60px; height: 60px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; }

      .eqn-bar { display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; align-items: center; padding: 1rem; background: var(--surface); border-radius: var(--radius-sm); }
      .eqn-chip { font-family: var(--font-mono); font-weight: 700; padding: 0.4rem 0.8rem; background: #fff; border-radius: 4px; border: 1px solid var(--border); }
      .eqn-ok { color: var(--success); }
      .eqn-fail { color: var(--danger); }

      .recent-tx { max-height: 400px; overflow-y: auto; }
      .tx-row { display: flex; justify-content: space-between; align-items: center; padding: 0.7rem 0; border-bottom: 1px dashed var(--border); font-size: 0.9rem; }
      .tx-row:last-child { border-bottom: none; }
      .tx-label { flex: 1; }
      .tx-detail { font-size: 0.8rem; color: var(--text-secondary); }
      .tx-amt { font-family: var(--font-mono); font-weight: 600; text-align: right; min-width: 100px; }
      .tx-debit { color: var(--success); }
      .tx-credit { color: var(--danger); }

      .quick-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; }
      .quick-btn { padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: #fff; cursor: pointer; transition: all 0.2s; font-size: 0.85rem; font-weight: 600; }
      .quick-btn:hover { background: var(--surface); border-color: var(--accent); color: var(--accent); }

      .chart-box { position: relative; height: 280px; }

      @media (max-width: 768px) {
        .kpi-card { padding: 0.9rem; }
        .kpi-card__value { font-size: 1.2rem; }
        .kpi-card__icon { width: 50px; height: 50px; font-size: 1.4rem; }
        .chart-box { height: 220px; }
      }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header
        [title]="greeting()"
        [subtitle]="company.activeCompany()?.name ?? 'No company selected'"
        icon="bi-speedometer2"
      />

      <!-- KPI Cards -->
      <div class="row g-3 mb-4">
        @for (k of model().kpis; track k.label) {
          <div class="col-6 col-xl-3">
            <div class="kpi-card d-flex align-items-center justify-content-between">
              <div style="flex: 1;">
                <div class="kpi-card__label">{{ k.label }}</div>
                <div class="kpi-card__value">₹{{ k.value | indianNumber }}</div>
              </div>
              <div class="kpi-card__icon" [class]="iconBg(k.tone)">
                <i class="bi {{ k.icon }}"></i>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Quick Actions -->
      <div class="card mb-4">
        <div class="card-body">
          <div class="quick-actions">
            <button class="quick-btn" (click)="navigate('/app/vouchers/journal')">
              <i class="bi bi-plus-circle me-2"></i>New Voucher
            </button>
            <button class="quick-btn" (click)="navigate('/app/ledger/create')">
              <i class="bi bi-plus-circle me-2"></i>New Ledger
            </button>
            <button class="quick-btn" (click)="navigate('/app/sales/cash')">
              <i class="bi bi-receipt me-2"></i>Create Invoice
            </button>
            <button class="quick-btn" (click)="navigate('/app/reports/balance-sheet')">
              <i class="bi bi-file-earmark me-2"></i>View Reports
            </button>
          </div>
        </div>
      </div>

      <!-- Charts Row 1 -->
      <div class="row g-3 mb-3">
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header"><i class="bi bi-bar-chart-line me-2 text-accent"></i>Sales vs Purchase (6 months)</div>
            <div class="card-body p-2"><div class="chart-box"><canvas #barChart></canvas></div></div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header"><i class="bi bi-graph-up me-2 text-accent"></i>P&amp;L Trend (6 months)</div>
            <div class="card-body p-2"><div class="chart-box"><canvas #lineChart></canvas></div></div>
          </div>
        </div>
      </div>
      <!-- Charts Row 2 -->
      <div class="row g-3 mb-4">
        <div class="col-lg-6 mx-auto">
          <div class="card">
            <div class="card-header"><i class="bi bi-pie-chart me-2 text-accent"></i>Assets Composition</div>
            <div class="card-body p-2"><div class="chart-box"><canvas #pieChart></canvas></div></div>
          </div>
        </div>
      </div>

      <!-- Accounting Equation -->
      <div class="card mb-4">
        <div class="card-body">
          <div class="eqn-bar">
            <span class="eqn-chip">
              <i class="bi bi-box-seam me-2"></i>A = ₹{{ model().totalAssets | indianNumber }}
            </span>
            <span style="font-size: 1.5rem; color: var(--text-secondary);">=</span>
            <span class="eqn-chip">
              <i class="bi bi-bank me-2"></i>L = ₹{{ model().totalLiab | indianNumber }}
            </span>
            <span style="font-size: 1.5rem; color: var(--text-secondary);">+</span>
            <span class="eqn-chip">
              <i class="bi bi-person-badge me-2"></i>C = ₹{{ model().totalCap | indianNumber }}
            </span>
            <span [class]="model().balanced ? 'eqn-ok' : 'eqn-fail'" style="font-size: 1.3rem;">
              <i [class]="model().balanced ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'"></i>
            </span>
          </div>
          @if (!model().balanced) {
            <p class="text-danger text-center mt-2 mb-0">
              <small>Out of balance by ₹{{ model().diff | indianNumber }}</small>
            </p>
          }
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="card">
        <div class="card-header"><i class="bi bi-list me-2 text-accent"></i>Recent Transactions (Last 10)</div>
        <div class="card-body recent-tx">
          @if (model().recent.length === 0) {
            <p class="text-muted text-center py-3 mb-0">No transactions yet.</p>
          } @else {
            @for (tx of model().recent; track tx.id) {
              <div class="tx-row">
                <div class="tx-label">
                  <div class="fw-semibold">{{ tx.voucherNo }}</div>
                  <div class="tx-detail">{{ tx.narration }}</div>
                </div>
                <div style="text-align: center; min-width: 100px;">
                  <div class="tx-detail">{{ tx.date | dateFormat:'short' }}</div>
                </div>
                @if (tx.debit > 0) {
                  <div class="tx-amt tx-debit">Dr ₹{{ tx.debit | indianNumber }}</div>
                } @else {
                  <div class="tx-amt tx-credit">Cr ₹{{ tx.credit | indianNumber }}</div>
                }
              </div>
            }
          }
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  readonly company = inject(CompanyService);
  private readonly auth = inject(AuthService);
  private readonly ledger = inject(LedgerService);
  private readonly voucher = inject(VoucherService);
  private readonly assets = inject(AssetService);
  private readonly router = inject(Router);

  private readonly barChartEl = viewChild<ElementRef<HTMLCanvasElement>>('barChart');
  private readonly lineChartEl = viewChild<ElementRef<HTMLCanvasElement>>('lineChart');
  private readonly pieChartEl = viewChild<ElementRef<HTMLCanvasElement>>('pieChart');

  private bar?: Chart<'bar', number[], string>;
  private line?: Chart<'line', number[], string>;
  private pie?: Chart<'doughnut', number[], string>;

  readonly greeting = computed(() => {
    const name = this.auth.currentUser()?.firstName ?? 'there';
    const hour = new Date().getHours();
    const salute = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    return `${salute}, ${name} 🙏`;
  });

  readonly model = computed(() => {
    this.ledger.sync();
    this.voucher.sync();
    this.assets.sync();

    const ledgers = this.ledger.ledgers();
    const vouchers = this.voucher.vouchers();

    // Build last-6-months buckets
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('default', { month: 'short' }) };
    });
    const monthlyLabels = buckets.map((b) => b.label);
    const salesArr = new Array<number>(6).fill(0);
    const purchaseArr = new Array<number>(6).fill(0);
    const pnlArr = new Array<number>(6).fill(0);

    for (const v of vouchers) {
      const vd = new Date(v.date);
      const bi = buckets.findIndex((b) => b.year === vd.getFullYear() && b.month === vd.getMonth());
      if (bi === -1) continue;
      if (v.voucherType === 'Sales') salesArr[bi] += v.totalCredit;
      if (v.voucherType === 'Purchase') purchaseArr[bi] += v.totalDebit;
      // P&L: sum income lines - expense lines
      for (const ln of v.lines) {
        const g = this.ledger.getGroup(this.ledger.ledgers().find((l) => l.id === ln.ledgerId)?.groupId ?? '');
        if (!g) continue;
        const amt = ln.amount;
        if (g.type === 'Income') pnlArr[bi] += ln.type === 'Cr' ? amt : -amt;
        if (g.type === 'Expense') pnlArr[bi] -= ln.type === 'Dr' ? amt : -amt;
      }
    }

    // Compute balances + asset group composition
    let totalAssets = 0;
    let totalLiab = 0;
    let totalCap = 0;
    let income = 0;
    let expense = 0;
    let cash = 0;
    const assetByGroup = new Map<string, number>();

    for (const l of ledgers) {
      const g = this.ledger.getGroup(l.groupId);
      if (!g) continue;

      const signed = l.openingNature === 'Dr' ? l.openingBalance : -l.openingBalance;
      const voucheredDelta = vouchers
        .flatMap((v) => v.lines)
        .filter((ln) => ln.ledgerId === l.id)
        .reduce((s, ln) => s + (ln.type === 'Dr' ? ln.amount : -ln.amount), 0);
      const balance = signed + voucheredDelta;

      switch (g.type) {
        case 'Asset':
          totalAssets += Math.abs(balance);
          assetByGroup.set(g.name, (assetByGroup.get(g.name) ?? 0) + Math.abs(balance));
          if (l.name.toLowerCase().includes('cash') || l.name.toLowerCase().includes('bank')) {
            cash += balance;
          }
          break;
        case 'Liability':
          totalLiab += Math.abs(balance);
          break;
        case 'Capital':
          totalCap += Math.abs(balance);
          break;
        case 'Income':
          income += Math.abs(balance);
          break;
        case 'Expense':
          expense += Math.abs(balance);
          break;
      }
    }

    const netProfit = income - expense;
    totalCap += netProfit;

    // Asset composition (drop zero-value buckets)
    const compEntries = [...assetByGroup.entries()].filter(([, v]) => v > 0);
    const composition = {
      labels: compEntries.map(([k]) => k),
      values: compEntries.map(([, v]) => v)
    };

    const kpis: Kpi[] = [
      { label: 'Total Assets', value: totalAssets, icon: 'bi-box-seam', tone: 'primary' },
      { label: 'Total Liabilities', value: totalLiab, icon: 'bi-bank', tone: 'danger' },
      { label: 'Net Profit', value: netProfit, icon: 'bi-cash-coin', tone: netProfit >= 0 ? 'success' : 'danger' },
      { label: 'Cash & Bank', value: Math.max(0, cash), icon: 'bi-wallet2', tone: 'accent' }
    ];

    const recent = vouchers
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map((v) => ({
        id: v.id,
        voucherNo: v.voucherNo,
        date: v.date,
        narration: v.narration ?? 'Entry',
        debit: v.totalDebit,
        credit: v.totalCredit
      }));

    return {
      kpis,
      recent,
      totalAssets,
      totalLiab,
      totalCap,
      balanced: Math.abs(totalAssets - (totalLiab + totalCap)) < 1,
      diff: Math.abs(totalAssets - (totalLiab + totalCap)),
      monthly: { labels: monthlyLabels, sales: salesArr, purchase: purchaseArr, pnl: pnlArr },
      composition
    };
  });

  constructor() {
    this.ledger.sync();
    this.voucher.sync();
    this.assets.sync();

    // Reactively update charts whenever model data changes
    effect(() => {
      const { monthly, composition } = this.model();
      if (this.bar) {
        this.bar.data.labels = monthly.labels;
        this.bar.data.datasets[0].data = monthly.sales;
        this.bar.data.datasets[1].data = monthly.purchase;
        this.bar.update();
      }
      if (this.line) {
        this.line.data.labels = monthly.labels;
        this.line.data.datasets[0].data = monthly.pnl;
        this.line.update();
      }
      if (this.pie) {
        this.pie.data.labels = composition.labels;
        this.pie.data.datasets[0].data = composition.values;
        this.pie.update();
      }
    });
  }

  iconBg(tone: Kpi['tone']): string {
    return {
      primary: 'bg-soft-primary text-primary',
      success: 'bg-soft-success text-success',
      danger: 'bg-soft-danger text-danger',
      accent: 'bg-soft-accent text-accent'
    }[tone];
  }

  navigate(path: string): void {
    void this.router.navigateByUrl(path);
  }

  ngAfterViewInit(): void {
    const navy = '#1B3A5C';
    const gold = '#C8860A';
    const green = '#1A7A4A';
    const red = '#B22222';
    const blue2 = '#2E5F8A';
    const { monthly, composition } = this.model();
    const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const } } };

    const barEl = this.barChartEl()?.nativeElement;
    if (barEl) {
      this.bar = new Chart(barEl, {
        type: 'bar',
        data: {
          labels: monthly.labels,
          datasets: [
            { label: 'Sales', data: monthly.sales, backgroundColor: green },
            { label: 'Purchase', data: monthly.purchase, backgroundColor: red }
          ]
        },
        options: opts
      });
    }

    const lineEl = this.lineChartEl()?.nativeElement;
    if (lineEl) {
      this.line = new Chart(lineEl, {
        type: 'line',
        data: {
          labels: monthly.labels,
          datasets: [
            { label: 'Net P&L', data: monthly.pnl, borderColor: navy, backgroundColor: navy + '22', tension: 0.3, fill: true }
          ]
        },
        options: opts
      });
    }

    const pieEl = this.pieChartEl()?.nativeElement;
    if (pieEl) {
      this.pie = new Chart(pieEl, {
        type: 'doughnut',
        data: {
          labels: composition.labels.length ? composition.labels : ['No data'],
          datasets: [{ data: composition.values.length ? composition.values : [1], backgroundColor: [navy, gold, green, blue2, red] }]
        },
        options: opts
      });
    }
  }

  ngOnDestroy(): void {
    this.bar?.destroy();
    this.line?.destroy();
    this.pie?.destroy();
  }
}
