import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  viewChild
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { SalesService } from '../../core/services/sales.service';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';

Chart.register(...registerables);

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

@Component({
  selector: 'app-turnover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IndianNumberPipe],
  styles: [
    `
      .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
      @media (max-width: 820px) { .kpis { grid-template-columns: 1fr 1fr; } }
      .kpi { padding: 0.9rem; border-radius: var(--radius); }
      .kpi .v { font-family: var(--font-mono); font-size: 1.2rem; font-weight: 700; }
      .chart-wrap { position: relative; height: 320px; }
    `
  ],
  template: `
    <div class="kpis">
      <div class="kpi bg-soft-primary"><div class="small text-secondary">Gross Sales</div><div class="v text-primary">₹{{ summary().gross | indianNumber: 0 }}</div></div>
      <div class="kpi bg-soft-accent"><div class="small text-secondary">Cash / Credit</div><div class="v text-accent">₹{{ summary().cash | indianNumber: 0 }} / ₹{{ summary().credit | indianNumber: 0 }}</div></div>
      <div class="kpi bg-soft-danger"><div class="small text-secondary">Sales Return</div><div class="v text-credit">₹{{ summary().returns | indianNumber: 0 }}</div></div>
      <div class="kpi bg-soft-success"><div class="small text-secondary">Net Sales</div><div class="v text-debit">₹{{ summary().net | indianNumber: 0 }}</div></div>
    </div>

    <div class="card mb-3">
      <div class="card-header"><i class="bi bi-bar-chart me-2 text-accent"></i>Monthly Turnover — Cash vs Credit</div>
      <div class="card-body"><div class="chart-wrap"><canvas #bar></canvas></div></div>
    </div>

    <div class="card">
      <div class="card-body">
        <h3 class="h6 mb-2">GST Collected</h3>
        <div class="d-flex justify-content-between"><span>Output GST on sales</span><span class="mono">₹{{ summary().gst | indianNumber }}</span></div>
        <hr />
        <div class="d-flex justify-content-between fw-bold">
          <span>Net Sales = Gross Sales − Sales Return</span>
          <span class="mono">₹{{ summary().gross | indianNumber }} − ₹{{ summary().returns | indianNumber }} = ₹{{ summary().net | indianNumber }}</span>
        </div>
      </div>
    </div>
  `
})
export class TurnoverComponent implements AfterViewInit, OnDestroy {
  readonly sales = inject(SalesService);
  private readonly barCanvas = viewChild<ElementRef<HTMLCanvasElement>>('bar');
  private chart: { destroy: () => void } | null = null;

  readonly summary = computed(() => {
    const list = this.sales.sales();
    const cash = list.filter((s) => s.type === 'Cash').reduce((a, s) => a + s.subTotal, 0);
    const credit = list.filter((s) => s.type === 'Credit').reduce((a, s) => a + s.subTotal, 0);
    const gst = list.reduce((a, s) => a + s.gstTotal, 0);
    const returns = this.sales.returns().reduce((a, r) => a + r.subTotal, 0);
    const gross = cash + credit;
    return { gross, cash, credit, gst, returns, net: gross - returns };
  });

  /** Gross (taxable) sales per financial-year month, split by type. */
  readonly monthly = computed(() => {
    const cash = new Array(12).fill(0);
    const credit = new Array(12).fill(0);
    for (const s of this.sales.sales()) {
      const idx = this.fyMonthIndex(new Date(s.date).getMonth());
      (s.type === 'Cash' ? cash : credit)[idx] += s.subTotal;
    }
    return { cash, credit };
  });

  /** Calendar month (0=Jan) → FY index (0=Apr … 11=Mar). */
  private fyMonthIndex(calMonth: number): number {
    return (calMonth - 3 + 12) % 12;
  }

  constructor() {
    this.sales.sync();
  }

  ngAfterViewInit(): void {
    const el = this.barCanvas()?.nativeElement;
    if (!el) {
      return;
    }
    const m = this.monthly();
    this.chart = new Chart(el, {
      type: 'bar',
      data: {
        labels: MONTHS,
        datasets: [
          { label: 'Cash Sales', data: m.cash, backgroundColor: '#1A7A4A' },
          { label: 'Credit Sales', data: m.credit, backgroundColor: '#2E5F8A' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { x: { stacked: false }, y: { beginAtZero: true } }
      }
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
