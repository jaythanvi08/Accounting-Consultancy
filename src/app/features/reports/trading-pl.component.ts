import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';

import { AssetService } from '../../core/services/asset.service';
import { CompanyService } from '../../core/services/company.service';
import { ExportService } from '../../core/services/export.service';
import { LedgerService } from '../../core/services/ledger.service';
import { VoucherService } from '../../core/services/voucher.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';

Chart.register(...registerables);

// ─── Types ───────────────────────────────────────────────────────────────────

interface TRow {
  label: string;
  amount: number | null;
  kind: 'header' | 'item' | 'subtotal' | 'total' | 'spacer';
  indent?: number;
}

interface Section {
  dr: TRow[];
  cr: TRow[];
}

interface TPLModel {
  company: string;
  periodLabel: string;
  trading: Section;
  pl: Section;
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  netLoss: number;
  grossProfitPct: number;
  netProfitPct: number;
  operatingRatio: number;
  prevGrossProfit: number;
  prevNetProfit: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-trading-pl',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageHeaderComponent, IndianNumberPipe],
  styles: [
    `
      /* ── T-account table ────────────────────────────────────────── */
      .t-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: #fff; }
      .t-table thead th { padding: 0.5rem 0.75rem; border-bottom: 2px solid var(--primary); color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; }
      .t-table td { padding: 0.35rem 0.75rem; }

      tr.t-header td { background: var(--primary); color: #fff; font-family: var(--font-heading); font-weight: 700; font-size: 0.8rem; letter-spacing: 0.03em; padding: 0.45rem 0.75rem; }
      tr.t-item td { border-top: 1px dashed var(--border); color: var(--text-primary); }
      tr.t-subtotal td { border-top: 2px solid var(--border); font-weight: 600; background: var(--surface); }
      tr.t-total td { border-top: 3px double var(--primary); border-bottom: 2px solid var(--primary); background: #f0f4fa; font-family: var(--font-heading); font-weight: 700; }
      tr.t-spacer td { height: 10px; border: none; background: #fafbfc; }

      .t-label { text-align: left; }
      .t-label.indent-1 { padding-left: 1.6rem; }
      .t-label.indent-2 { padding-left: 2.4rem; }
      .t-amount { text-align: right; font-family: var(--font-mono); }
      .t-amount-neg { color: var(--danger); }

      /* ── Layout ─────────────────────────────────────────────────── */
      .t-section-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
      @media (max-width: 900px) { .t-section-pair { grid-template-columns: 1fr; } }

      .t-section { }
      .t-section-title { font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--primary); margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary); }

      /* ── KPI cards ────────────────────────────────────────────── */
      .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
      .kpi-card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 1rem; text-align: center; }
      .kpi-card__label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 0.25rem; font-family: var(--font-heading); font-weight: 600; }
      .kpi-card__value { font-size: 1.5rem; font-family: var(--font-mono); font-weight: 700; color: var(--primary); }
      .kpi-card__value.neg { color: var(--danger); }
      .kpi-card__unit { font-size: 0.7rem; color: var(--text-muted); margin-left: 0.25rem; }

      /* ── Toolbar ────────────────────────────────────────────── */
      .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
      .period-btn { padding: 0.35rem 0.8rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: #fff; cursor: pointer; font-size: 0.85rem; transition: all 0.15s; }
      .period-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

      .custom-dates { display: flex; gap: 0.5rem; align-items: center; }
      .custom-dates input { width: 120px; }

      /* ── Comparison chart ──────────────────────────────────── */
      .chart-wrap { max-height: 300px; }

      /* ── Empty state ────────────────────────────────────────── */
      .empty-msg { text-align: center; padding: 3rem 1rem; color: var(--text-muted); }

      /* ── Print ──────────────────────────────────────────────── */
      @media print {
        .no-print { display: none !important; }
        .t-table { font-size: 9pt; }
        tr.t-header td { background: #1b3a5c !important; -webkit-print-color-adjust: exact; }
        tr.t-total td { background: #f0f4fa !important; -webkit-print-color-adjust: exact; }
        .print-area { padding: 0 !important; }
      }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header
        title="Trading & Profit &amp; Loss Account"
        subtitle="NCERT-format two-section statement of earnings"
        icon="bi-cash-coin"
      >
        <div class="d-flex gap-2 no-print">
          <button class="btn btn-sm btn-outline-danger" (click)="exportPdf()" title="Export PDF">
            <i class="bi bi-file-pdf me-1"></i>PDF
          </button>
          <button class="btn btn-sm btn-outline-success" (click)="exportExcel()" title="Export Excel">
            <i class="bi bi-file-earmark-spreadsheet me-1"></i>Excel
          </button>
          <button class="btn btn-sm btn-outline-secondary" (click)="printReport()" title="Print">
            <i class="bi bi-printer me-1"></i>Print
          </button>
        </div>
      </app-page-header>

      <!-- ── Toolbar ────────────────────────────────────────────── -->
      <div class="toolbar no-print">
        <div class="d-flex gap-2">
          <button class="period-btn" [class.active]="period() === 'this-year'" (click)="period.set('this-year')">
            <i class="bi bi-calendar3 me-1"></i>This Year
          </button>
          <button class="period-btn" [class.active]="period() === 'last-year'" (click)="period.set('last-year')">
            <i class="bi bi-calendar me-1"></i>Last Year
          </button>
          <button class="period-btn" [class.active]="period() === 'custom'" (click)="period.set('custom')">
            <i class="bi bi-calendar-range me-1"></i>Custom
          </button>
        </div>

        @if (period() === 'custom') {
          <div class="custom-dates">
            <label class="text-secondary small mb-0">From:</label>
            <input type="date" class="form-control form-control-sm" [ngModel]="customFrom()" (ngModelChange)="customFrom.set($event)" />
            <label class="text-secondary small mb-0">To:</label>
            <input type="date" class="form-control form-control-sm" [ngModel]="customTo()" (ngModelChange)="customTo.set($event)" />
          </div>
        }
      </div>

      @if (isEmpty()) {
        <div class="card">
          <div class="card-body empty-msg">
            <i class="bi bi-cash-coin fs-1 d-block mb-2"></i>
            No sales or purchase transactions found for this period. Create vouchers to generate the report.
          </div>
        </div>
      } @else {
        <div class="print-area" #printArea>
          <!-- Header -->
          <div class="text-center mb-3" style="border-bottom: 2px solid var(--primary); padding-bottom: 0.75rem;">
            <div class="fw-bold" style="font-family: var(--font-heading); font-size: 1.15rem; color: var(--primary)">
              {{ model().company }}
            </div>
            <div class="text-secondary" style="font-size: 0.85rem; letter-spacing: 0.04em">
              TRADING & PROFIT AND LOSS ACCOUNT for {{ model().periodLabel }}
            </div>
          </div>

          <!-- ── TRADING ACCOUNT (Section A) ────────────────────── -->
          <div class="card mb-4">
            <div class="card-body">
              <div class="t-section">
                <div class="t-section-title">Section A — Trading Account</div>
                <table class="t-table">
                  <thead>
                    <tr>
                      <th style="width: 60%">Dr SIDE</th>
                      <th class="text-end" style="width: 20%">₹</th>
                      <th style="width: 20%"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of model().trading.dr; track $index) {
                      @switch (row.kind) {
                        @case ('header') {
                          <tr class="t-header"><td colspan="3">{{ row.label }}</td></tr>
                        }
                        @case ('item') {
                          <tr class="t-item">
                            <td class="t-label" [class.indent-1]="row.indent === 1" [class.indent-2]="row.indent === 2">{{ row.label }}</td>
                            <td class="t-amount">@if (row.amount !== null) { {{ row.amount | indianNumber }} }</td>
                            <td></td>
                          </tr>
                        }
                        @case ('subtotal') {
                          <tr class="t-subtotal">
                            <td class="t-label">{{ row.label }}</td>
                            <td class="t-amount">@if (row.amount !== null) { ({{ row.amount | indianNumber }}) }</td>
                            <td></td>
                          </tr>
                        }
                        @case ('total') {
                          <tr class="t-total">
                            <td class="t-label">{{ row.label }}</td>
                            <td></td>
                            <td class="t-amount">@if (row.amount !== null) { {{ row.amount | indianNumber }} }</td>
                          </tr>
                        }
                        @case ('spacer') {
                          <tr class="t-spacer"><td colspan="3"></td></tr>
                        }
                      }
                    }
                  </tbody>
                </table>
              </div>

              <!-- Cr side -->
              <table class="t-table mt-4">
                <thead>
                  <tr>
                    <th style="width: 60%">Cr SIDE</th>
                    <th class="text-end" style="width: 20%">₹</th>
                    <th style="width: 20%"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of model().trading.cr; track $index) {
                    @switch (row.kind) {
                      @case ('header') {
                        <tr class="t-header"><td colspan="3">{{ row.label }}</td></tr>
                      }
                      @case ('item') {
                        <tr class="t-item">
                          <td class="t-label" [class.indent-1]="row.indent === 1" [class.indent-2]="row.indent === 2">{{ row.label }}</td>
                          <td class="t-amount">@if (row.amount !== null) { {{ row.amount | indianNumber }} }</td>
                          <td></td>
                        </tr>
                      }
                      @case ('subtotal') {
                        <tr class="t-subtotal">
                          <td class="t-label">{{ row.label }}</td>
                          <td class="t-amount">@if (row.amount !== null) { ({{ row.amount | indianNumber }}) }</td>
                          <td></td>
                        </tr>
                      }
                      @case ('total') {
                        <tr class="t-total">
                          <td class="t-label">{{ row.label }}</td>
                          <td></td>
                          <td class="t-amount">@if (row.amount !== null) { {{ row.amount | indianNumber }} }</td>
                        </tr>
                      }
                      @case ('spacer') {
                        <tr class="t-spacer"><td colspan="3"></td></tr>
                      }
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- ── PROFIT & LOSS ACCOUNT (Section B) ───────────────── -->
          <div class="card mb-4">
            <div class="card-body">
              <div class="t-section">
                <div class="t-section-title">Section B — Profit &amp; Loss Account</div>
                <table class="t-table">
                  <thead>
                    <tr>
                      <th style="width: 60%">Dr SIDE</th>
                      <th class="text-end" style="width: 20%">₹</th>
                      <th style="width: 20%"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of model().pl.dr; track $index) {
                      @switch (row.kind) {
                        @case ('header') {
                          <tr class="t-header"><td colspan="3">{{ row.label }}</td></tr>
                        }
                        @case ('item') {
                          <tr class="t-item">
                            <td class="t-label" [class.indent-1]="row.indent === 1">{{ row.label }}</td>
                            <td class="t-amount">@if (row.amount !== null) { {{ row.amount | indianNumber }} }</td>
                            <td></td>
                          </tr>
                        }
                        @case ('subtotal') {
                          <tr class="t-subtotal">
                            <td class="t-label">{{ row.label }}</td>
                            <td class="t-amount">@if (row.amount !== null) { ({{ row.amount | indianNumber }}) }</td>
                            <td></td>
                          </tr>
                        }
                        @case ('total') {
                          <tr class="t-total">
                            <td class="t-label">{{ row.label }}</td>
                            <td></td>
                            <td class="t-amount">@if (row.amount !== null) { {{ row.amount | indianNumber }} }</td>
                          </tr>
                        }
                        @case ('spacer') {
                          <tr class="t-spacer"><td colspan="3"></td></tr>
                        }
                      }
                    }
                  </tbody>
                </table>
              </div>

              <!-- Cr side -->
              <table class="t-table mt-4">
                <thead>
                  <tr>
                    <th style="width: 60%">Cr SIDE</th>
                    <th class="text-end" style="width: 20%">₹</th>
                    <th style="width: 20%"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of model().pl.cr; track $index) {
                    @switch (row.kind) {
                      @case ('header') {
                        <tr class="t-header"><td colspan="3">{{ row.label }}</td></tr>
                      }
                      @case ('item') {
                        <tr class="t-item">
                          <td class="t-label" [class.indent-1]="row.indent === 1">{{ row.label }}</td>
                          <td class="t-amount">@if (row.amount !== null) { {{ row.amount | indianNumber }} }</td>
                          <td></td>
                        </tr>
                      }
                      @case ('subtotal') {
                        <tr class="t-subtotal">
                          <td class="t-label">{{ row.label }}</td>
                          <td class="t-amount">@if (row.amount !== null) { ({{ row.amount | indianNumber }}) }</td>
                          <td></td>
                        </tr>
                      }
                      @case ('total') {
                        <tr class="t-total">
                          <td class="t-label">{{ row.label }}</td>
                          <td></td>
                          <td class="t-amount">@if (row.amount !== null) { {{ row.amount | indianNumber }} }</td>
                        </tr>
                      }
                      @case ('spacer') {
                        <tr class="t-spacer"><td colspan="3"></td></tr>
                      }
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div><!-- /print-area -->

        <!-- ── KPI Cards ──────────────────────────────────────── -->
        <div class="card mb-4 no-print">
          <div class="card-header">
            <i class="bi bi-graph-up-arrow me-2 text-accent"></i>Key Performance Indicators
          </div>
          <div class="card-body">
            <div class="kpi-grid">
              <div class="kpi-card" [style.border-left]="'4px solid ' + (model().grossProfit >= 0 ? 'var(--success)' : 'var(--danger)')">
                <div class="kpi-card__label">Gross Profit</div>
                <div class="kpi-card__value" [class.neg]="model().grossProfit < 0">
                  @if (model().grossProfit >= 0) {
                    ₹{{ model().grossProfit | indianNumber }}
                  } @else {
                    Loss ₹{{ Math.abs(model().grossLoss) | indianNumber }}
                  }
                </div>
              </div>

              <div class="kpi-card" [style.border-left]="'4px solid ' + (model().grossProfitPct >= 0 ? 'var(--success)' : 'var(--danger)')">
                <div class="kpi-card__label">Gross Profit %</div>
                <div class="kpi-card__value" [class.neg]="model().grossProfitPct < 0">
                  {{ model().grossProfitPct | indianNumber: 1 }}<span class="kpi-card__unit">%</span>
                </div>
              </div>

              <div class="kpi-card" [style.border-left]="'4px solid ' + (model().netProfit >= 0 ? 'var(--success)' : 'var(--danger)')">
                <div class="kpi-card__label">Net Profit</div>
                <div class="kpi-card__value" [class.neg]="model().netProfit < 0">
                  @if (model().netProfit >= 0) {
                    ₹{{ model().netProfit | indianNumber }}
                  } @else {
                    Loss ₹{{ Math.abs(model().netLoss) | indianNumber }}
                  }
                </div>
              </div>

              <div class="kpi-card" [style.border-left]="'4px solid ' + (model().netProfitPct >= 0 ? 'var(--success)' : 'var(--danger)')">
                <div class="kpi-card__label">Net Profit %</div>
                <div class="kpi-card__value" [class.neg]="model().netProfitPct < 0">
                  {{ model().netProfitPct | indianNumber: 1 }}<span class="kpi-card__unit">%</span>
                </div>
              </div>

              <div class="kpi-card">
                <div class="kpi-card__label">Operating Ratio</div>
                <div class="kpi-card__value">{{ model().operatingRatio | indianNumber: 2 }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Comparison Chart ──────────────────────────────── -->
        <div class="card no-print">
          <div class="card-header">
            <i class="bi bi-bar-chart-line me-2 text-accent"></i>Profit Trend
            <span class="text-muted small ms-2">(current vs. previous period)</span>
          </div>
          <div class="card-body">
            <div class="chart-wrap"><canvas #chartCanvas></canvas></div>
          </div>
        </div>
      }
    </div>
  `
})
export class TradingPLComponent implements AfterViewInit, OnDestroy {
  private readonly ledger = inject(LedgerService);
  private readonly assets = inject(AssetService);
  private readonly vouchers = inject(VoucherService);
  private readonly company = inject(CompanyService);
  private readonly export = inject(ExportService);

  private readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private readonly printArea = viewChild<ElementRef<HTMLElement>>('printArea');
  private chart: Chart | null = null;

  readonly period = signal<'this-year' | 'last-year' | 'custom'>('this-year');
  readonly customFrom = signal<string>(this.getFinYearStart());
  readonly customTo = signal<string>(this.getFinYearEnd());

  readonly model = computed<TPLModel>(() => this.build());
  readonly isEmpty = computed(() => {
    const m = this.model();
    return m.trading.dr.every((r) => r.amount === null || r.amount === 0) &&
           m.trading.cr.every((r) => r.amount === null || r.amount === 0);
  });

  readonly Math = Math;

  constructor() {
    this.ledger.sync();
    this.assets.sync();
    this.vouchers.sync();

    effect(() => {
      this.model();
      Promise.resolve().then(() => this.renderChart());
    });
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  exportPdf(): void {
    const el = this.printArea()?.nativeElement;
    if (el) void this.export.toPdf(el, 'trading-pl-account');
  }

  exportExcel(): void {
    const rows = this.toFlatRows();
    this.export.toExcel(rows, 'trading-pl-account', 'Trading & P&L');
  }

  printReport(): void {
    this.export.print();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getFinYearStart(): string {
    const today = new Date();
    const fy = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return `${fy}-04-01`;
  }

  private getFinYearEnd(): string {
    const today = new Date();
    const fy = today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear();
    return `${fy}-03-31`;
  }

  private getDateRange(): [from: string, to: string] {
    if (this.period() === 'this-year') {
      return [this.getFinYearStart(), this.getFinYearEnd()];
    }
    if (this.period() === 'last-year') {
      const [from, to] = [this.getFinYearStart(), this.getFinYearEnd()];
      const pf = new Date(from);
      pf.setFullYear(pf.getFullYear() - 1);
      const pt = new Date(to);
      pt.setFullYear(pt.getFullYear() - 1);
      return [pf.toISOString().slice(0, 10), pt.toISOString().slice(0, 10)];
    }
    return [this.customFrom(), this.customTo()];
  }

  private voucherAmountInRange(voucherDate: string, from: string, to: string): boolean {
    const t = new Date(voucherDate).getTime();
    const f = new Date(from).getTime();
    const te = new Date(to).getTime() + 86_399_000;
    return t >= f && t <= te;
  }

  private gatherLedgerNamesOfType(type: string): Set<string> {
    const names = new Set<string>();
    const lc = type.toLowerCase();
    for (const l of this.ledger.ledgers()) {
      if (l.name.toLowerCase().includes(lc)) names.add(l.id);
    }
    return names;
  }

  private sumVouchersForLedgers(ledgerIds: Set<string>, from: string, to: string): [debit: number, credit: number] {
    let dr = 0;
    let cr = 0;
    for (const v of this.vouchers.vouchers()) {
      if (!this.voucherAmountInRange(v.date, from, to)) continue;
      for (const ln of v.lines) {
        if (ledgerIds.has(ln.ledgerId)) {
          if (ln.type === 'Dr') dr += ln.amount;
          else cr += ln.amount;
        }
      }
    }
    return [dr, cr];
  }

  private sumByGroupType(type: string, from: string, to: string): [debit: number, credit: number] {
    let dr = 0;
    let cr = 0;
    for (const l of this.ledger.ledgers()) {
      const g = this.ledger.getGroup(l.groupId);
      if (!g || g.type !== type) continue;

      const bal = this.getSignedBalance(l.id, from, to);
      if (g.nature === 'Dr') {
        dr += bal;
      } else {
        cr += -bal;
      }
    }
    return [dr, cr];
  }

  private getSignedBalance(ledgerId: string, from: string, to: string): number {
    const l = this.ledger.getLedger(ledgerId);
    if (!l) return 0;

    let bal = l.openingNature === 'Dr' ? l.openingBalance : -l.openingBalance;
    for (const v of this.vouchers.vouchers()) {
      if (!this.voucherAmountInRange(v.date, from, to)) continue;
      for (const ln of v.lines) {
        if (ln.ledgerId === ledgerId) {
          bal += ln.type === 'Dr' ? ln.amount : -ln.amount;
        }
      }
    }
    return bal;
  }

  private build(): TPLModel {
    const [from, to] = this.getDateRange();
    const [prevFrom, prevTo] = (() => {
      const pf = new Date(from);
      pf.setFullYear(pf.getFullYear() - 1);
      const pt = new Date(to);
      pt.setFullYear(pt.getFullYear() - 1);
      return [pf.toISOString().slice(0, 10), pt.toISOString().slice(0, 10)];
    })();

    // Gathering ledger IDs for common accounts
    const sales = this.gatherLedgerNamesOfType('sale');
    const salesReturn = this.gatherLedgerNamesOfType('return');
    const purchases = this.gatherLedgerNamesOfType('purchase');
    const purchaseReturn = this.gatherLedgerNamesOfType('return');
    const carriage = this.gatherLedgerNamesOfType('carriage');
    const wages = this.gatherLedgerNamesOfType('wage');
    const salaries = this.gatherLedgerNamesOfType('salarif');
    const rent = this.gatherLedgerNamesOfType('rent');
    const depreciation = this.gatherLedgerNamesOfType('depreciation');
    const interest = this.gatherLedgerNamesOfType('interest');
    const badDebts = this.gatherLedgerNamesOfType('bad');
    const commission = this.gatherLedgerNamesOfType('commission');
    const discount = this.gatherLedgerNamesOfType('discount');
    const printing = this.gatherLedgerNamesOfType('printing');

    const [salesDr, salesCr] = this.sumVouchersForLedgers(sales, from, to);
    const [saleRetDr, saleRetCr] = this.sumVouchersForLedgers(salesReturn, from, to);
    const [purDr, purCr] = this.sumVouchersForLedgers(purchases, from, to);
    const [purRetDr, purRetCr] = this.sumVouchersForLedgers(purchaseReturn, from, to);
    const [carriageDr, carriageCr] = this.sumVouchersForLedgers(carriage, from, to);
    const [wagesDr, wagesCr] = this.sumVouchersForLedgers(wages, from, to);
    const [salariesDr, salariesCr] = this.sumVouchersForLedgers(salaries, from, to);
    const [rentDr, rentCr] = this.sumVouchersForLedgers(rent, from, to);
    const [depDr, depCr] = this.sumVouchersForLedgers(depreciation, from, to);
    const [intDr, intCr] = this.sumVouchersForLedgers(interest, from, to);
    const [badDr, badCr] = this.sumVouchersForLedgers(badDebts, from, to);
    const [commDr, commCr] = this.sumVouchersForLedgers(commission, from, to);
    const [discDr, discCr] = this.sumVouchersForLedgers(discount, from, to);
    const [printDr, printCr] = this.sumVouchersForLedgers(printing, from, to);

    // Derived: Closing Stock assumption (from inventory ledgers, if any)
    const closingStock = this.calculateClosingStock();

    // TRADING ACCOUNT
    const netSales = Math.max(0, salesCr - saleRetCr);
    const netPurchases = Math.max(0, purDr - purRetCr);
    const directExp = carriageDr + wagesDr;

    const grossProfit = netSales > 0 ? netSales - (netPurchases + directExp) : 0;
    const grossLoss = grossProfit < 0 ? -grossProfit : 0;

    const tradingDr: TRow[] = [
      { label: 'Opening Stock', amount: 0, kind: 'item' },
      { label: 'Purchases', amount: netPurchases, kind: 'item' },
      { label: 'Less: Purchase Return', amount: purRetCr, kind: 'subtotal' },
      { label: 'Carriage Inwards', amount: carriageDr, kind: 'item' },
      { label: 'Wages', amount: wagesDr, kind: 'item' }
    ];
    if (grossProfit > 0) {
      tradingDr.push({ label: 'Gross Profit c/d', amount: grossProfit, kind: 'total' });
    } else {
      tradingDr.push({ label: 'Gross Loss c/d', amount: grossLoss, kind: 'total' });
    }

    const tradingCr: TRow[] = [
      { label: 'Sales', amount: salesCr, kind: 'item' },
      { label: 'Less: Sales Return', amount: saleRetCr, kind: 'subtotal' },
      { label: 'Net Sales', amount: netSales, kind: 'item' },
      { label: 'Closing Stock', amount: closingStock, kind: 'item' },
      { label: 'Total', amount: netSales + closingStock, kind: 'total' }
    ];

    // P&L ACCOUNT
    const totalExp = salariesCr + rentDr + depDr + (intDr - intCr) + badDr + printDr + commDr;
    const totalInc = grossProfit + discCr + commCr + intCr;

    const netProfit = totalInc - totalExp;
    const netLoss = netProfit < 0 ? -netProfit : 0;

    const plDr: TRow[] = [];
    if (grossLoss > 0) {
      plDr.push({ label: 'Gross Loss b/d', amount: grossLoss, kind: 'item' });
    }
    plDr.push(
      { label: 'Salaries & Wages', amount: salariesCr, kind: 'item' },
      { label: 'Rent Paid', amount: rentDr, kind: 'item' },
      { label: 'Depreciation', amount: depDr, kind: 'item' },
      { label: 'Interest on Loan', amount: intDr - intCr, kind: 'item' },
      { label: 'Bad Debts', amount: badDr, kind: 'item' },
      { label: 'Printing & Stationery', amount: printDr, kind: 'item' },
      { label: 'Commission Paid', amount: commDr, kind: 'item' }
    );
    if (netProfit > 0) {
      plDr.push({ label: 'Net Profit c/d', amount: netProfit, kind: 'total' });
    } else {
      plDr.push({ label: 'Net Loss c/d', amount: netLoss, kind: 'total' });
    }

    const plCr: TRow[] = [
      { label: 'Gross Profit b/d', amount: grossProfit, kind: 'item' },
      { label: 'Discount Received', amount: discCr, kind: 'item' },
      { label: 'Commission Received', amount: commCr, kind: 'item' },
      { label: 'Interest Received', amount: intCr, kind: 'item' },
      { label: 'Total', amount: totalInc, kind: 'total' }
    ];

    // KPIs
    const grossProfitPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const netProfitPct = netSales > 0 ? (netProfit / netSales) * 100 : 0;
    const costOfGoodsSold = netPurchases + directExp;
    const operatingRatio = netSales > 0 ? (costOfGoodsSold / netSales) : 0;

    // Previous period
    const [prevSalesDr, prevSalesCr] = this.sumVouchersForLedgers(sales, prevFrom, prevTo);
    const [prevSalRetDr, prevSalRetCr] = this.sumVouchersForLedgers(salesReturn, prevFrom, prevTo);
    const [prevPurDr, prevPurCr] = this.sumVouchersForLedgers(purchases, prevFrom, prevTo);
    const [prevPurRetDr, prevPurRetCr] = this.sumVouchersForLedgers(purchaseReturn, prevFrom, prevTo);
    const prevNetSales = Math.max(0, prevSalesCr - prevSalRetCr);
    const prevNetPur = Math.max(0, prevPurDr - prevPurRetCr);
    const [prevCarrDr] = this.sumVouchersForLedgers(carriage, prevFrom, prevTo);
    const [prevWagesDr] = this.sumVouchersForLedgers(wages, prevFrom, prevTo);
    const prevGrossProfit = prevNetSales - (prevNetPur + prevCarrDr + prevWagesDr);
    const prevNetProfit = prevGrossProfit - totalExp; // Simplified

    return {
      company: this.company.activeCompany()?.name ?? 'Company',
      periodLabel: this.getPeriodLabel(),
      trading: { dr: tradingDr, cr: tradingCr },
      pl: { dr: plDr, cr: plCr },
      grossProfit,
      grossLoss,
      netProfit,
      netLoss,
      grossProfitPct,
      netProfitPct,
      operatingRatio,
      prevGrossProfit,
      prevNetProfit
    };
  }

  private getPeriodLabel(): string {
    if (this.period() === 'this-year') {
      const from = this.getFinYearStart();
      const to = this.getFinYearEnd();
      return `${new Date(from).getFullYear()}-${String(new Date(to).getFullYear()).slice(-2)}`;
    }
    if (this.period() === 'last-year') {
      const from = this.getFinYearStart();
      const fy = new Date(from).getFullYear() - 1;
      return `${fy}-${fy + 1}`;
    }
    return `${this.customFrom()} to ${this.customTo()}`;
  }

  private calculateClosingStock(): number {
    // Placeholder: get from inventory ledgers or stock register
    // For now, return 0
    return 0;
  }

  private renderChart(): void {
    const el = this.chartCanvas()?.nativeElement;
    if (!el) return;

    this.chart?.destroy();
    const m = this.model();

    this.chart = new Chart(el, {
      type: 'bar',
      data: {
        labels: ['Gross Profit', 'Net Profit'],
        datasets: [
          {
            label: `${this.getPeriodLabel()}`,
            data: [Math.max(0, m.grossProfit), Math.max(0, m.netProfit)],
            backgroundColor: 'rgba(27,58,92,0.82)',
            borderColor: '#1B3A5C',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Previous Period',
            data: [Math.max(0, m.prevGrossProfit), Math.max(0, m.prevNetProfit)],
            backgroundColor: 'rgba(200,134,10,0.6)',
            borderColor: '#C8860A',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ₹${new Intl.NumberFormat('en-IN').format(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => `₹${new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(Number(v))}`
            }
          }
        }
      }
    });
  }

  private toFlatRows(): Record<string, string>[] {
    const out: Record<string, string>[] = [];
    const m = this.model();

    out.push({ Section: 'Trading Account', Particulars: `Period: ${this.getPeriodLabel()}`, Amount: '' });
    out.push({ Section: '', Particulars: '', Amount: '' });

    for (const r of m.trading.dr) {
      out.push({
        Section: 'Dr',
        Particulars: r.label,
        Amount: r.amount !== null ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(r.amount) : ''
      });
    }

    out.push({ Section: '', Particulars: '', Amount: '' });

    for (const r of m.trading.cr) {
      out.push({
        Section: 'Cr',
        Particulars: r.label,
        Amount: r.amount !== null ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(r.amount) : ''
      });
    }

    out.push({ Section: '', Particulars: '', Amount: '' });
    out.push({ Section: 'Profit & Loss Account', Particulars: '', Amount: '' });
    out.push({ Section: '', Particulars: '', Amount: '' });

    for (const r of m.pl.dr) {
      out.push({
        Section: 'Dr',
        Particulars: r.label,
        Amount: r.amount !== null ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(r.amount) : ''
      });
    }

    out.push({ Section: '', Particulars: '', Amount: '' });

    for (const r of m.pl.cr) {
      out.push({
        Section: 'Cr',
        Particulars: r.label,
        Amount: r.amount !== null ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(r.amount) : ''
      });
    }

    return out;
  }
}
