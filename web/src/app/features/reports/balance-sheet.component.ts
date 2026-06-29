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

type RowKind = 'main-header' | 'sub-header' | 'item' | 'item-neg' | 'sub-total' | 'grand-total';

interface BSRow {
  kind: RowKind;
  label: string;
  col2: number | null; // inner amount
  col3: number | null; // outer / total amount
}

interface BSSide {
  rows: BSRow[];
  total: number;
  capital: number;
  longLiab: number;
  currLiab: number;
  fixedAssets: number;
  currentAssets: number;
}

interface BSModel {
  companyName: string;
  equity: BSSide;
  assets: BSSide;
  balanced: boolean;
  diff: number;
  prevEquityTotal: number;
  prevAssetsTotal: number;
  prevCapital: number;
  prevLongLiab: number;
  prevCurrLiab: number;
  prevFixedAssets: number;
  prevCurrentAssets: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-balance-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageHeaderComponent, IndianNumberPipe],
  styles: [
    `
      /* ── Table ─────────────────────────────────────────────── */
      .bs-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
      .bs-table th { padding: 0.5rem 0.75rem; border-bottom: 2px solid var(--primary); color: var(--text-secondary); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
      .bs-table td { padding: 0.32rem 0.75rem; }

      tr.bs-main td { background: var(--primary); color: #fff; font-family: var(--font-heading); font-weight: 700; font-size: 0.85rem; letter-spacing: 0.03em; padding: 0.55rem 0.75rem; }
      tr.bs-sub td { background: var(--surface); font-family: var(--font-heading); font-weight: 600; font-size: 0.82rem; color: var(--text-primary); border-top: 1px solid var(--border); padding: 0.42rem 0.75rem; }
      tr.bs-item td { border-top: 1px dashed var(--border); color: var(--text-primary); }
      tr.bs-item-neg td { border-top: 1px dashed var(--border); color: var(--danger); }
      tr.bs-subtotal td { border-top: 2px solid var(--border); }
      tr.bs-grand td { background: #f0f4fa; border-top: 3px double var(--primary); border-bottom: 2px solid var(--primary); font-family: var(--font-heading); font-weight: 700; }

      .mono { font-family: var(--font-mono); }

      /* ── Layout modes ───────────────────────────────────────── */
      .bs-horizontal { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
      @media (max-width: 900px) { .bs-horizontal { grid-template-columns: 1fr; } }

      /* ── Balance check banner ───────────────────────────────── */
      .balance-check { display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 1rem; border-radius: var(--radius-sm); font-family: var(--font-heading); font-weight: 600; font-size: 0.9rem; }
      .balance-check.ok { background: #e8f5ee; color: var(--success); border: 1px solid var(--success); }
      .balance-check.fail { background: #fdf0f0; color: var(--danger); border: 1px solid var(--danger); }

      /* ── Chart card ─────────────────────────────────────────── */
      .chart-wrap { max-height: 320px; }

      /* ── Toolbar ─────────────────────────────────────────────── */
      .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
      .mode-btn { padding: 0.3rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: transparent; cursor: pointer; font-size: 0.82rem; transition: all 0.15s; }
      .mode-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

      /* ── Print ───────────────────────────────────────────────── */
      @media print {
        .no-print { display: none !important; }
        .bs-table { font-size: 10pt; }
        tr.bs-main td { background: #1b3a5c !important; color: #fff !important; -webkit-print-color-adjust: exact; }
        tr.bs-grand td { background: #f0f4fa !important; -webkit-print-color-adjust: exact; }
        .print-area { padding: 0 !important; }
      }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header
        title="Balance Sheet"
        subtitle="NCERT-format statement of financial position"
        icon="bi-file-earmark-bar-graph"
      >
        <!-- Export actions projected into page-header slot -->
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

      <!-- ── Toolbar ─────────────────────────────────────────── -->
      <div class="toolbar no-print">
        <div class="d-flex align-items-center gap-2">
          <label class="text-secondary fw-semibold small mb-0">As on:</label>
          <input
            type="date"
            class="form-control form-control-sm"
            style="width:160px"
            [ngModel]="asOnDate()"
            (ngModelChange)="asOnDate.set($event)"
          />
        </div>

        <div class="ms-2">
          <button class="mode-btn" [class.active]="viewMode() === 'vertical'" (click)="viewMode.set('vertical')">
            <i class="bi bi-list-ul me-1"></i>Vertical
          </button>
          <button class="mode-btn" [class.active]="viewMode() === 'horizontal'" (click)="viewMode.set('horizontal')">
            <i class="bi bi-layout-split me-1"></i>Columnar
          </button>
        </div>
      </div>

      @if (isEmpty()) {
        <div class="card">
          <div class="card-body text-center text-muted py-5">
            <i class="bi bi-file-earmark-bar-graph fs-1 d-block mb-2"></i>
            No balances yet. Add ledgers with opening balances or post vouchers to generate the Balance Sheet.
          </div>
        </div>
      } @else {
        <!-- ── Print header ──────────────────────────────────── -->
        <div class="print-area" #printArea>
          <div class="text-center mb-3" style="border-bottom: 2px solid var(--primary); padding-bottom: 0.75rem;">
            <div class="fw-bold" style="font-family: var(--font-heading); font-size: 1.15rem; color: var(--primary)">
              {{ model().companyName }}
            </div>
            <div class="text-secondary" style="font-size: 0.85rem; letter-spacing: 0.04em">
              BALANCE SHEET as at {{ asOnDateFormatted() }}
            </div>
          </div>

          <!-- Balance check banner -->
          <div class="balance-check mb-3" [class.ok]="model().balanced" [class.fail]="!model().balanced">
            <i class="bi fs-5" [class.bi-check-circle-fill]="model().balanced" [class.bi-exclamation-triangle-fill]="!model().balanced"></i>
            @if (model().balanced) {
              Balance Sheet is BALANCED &nbsp;—&nbsp;
              <span class="mono">₹{{ model().equity.total | indianNumber }}</span>
              &nbsp;=&nbsp;
              <span class="mono">₹{{ model().assets.total | indianNumber }}</span>
            } @else {
              Out of balance by
              <span class="mono">₹{{ model().diff | indianNumber }}</span>
              &nbsp;|&nbsp; Equity: <span class="mono">₹{{ model().equity.total | indianNumber }}</span>
              &nbsp;|&nbsp; Assets: <span class="mono">₹{{ model().assets.total | indianNumber }}</span>
            }
          </div>

          <!-- ── VERTICAL layout ─────────────────────────────── -->
          @if (viewMode() === 'vertical') {
            <div class="card">
              <div class="card-body p-0">
                <table class="bs-table">
                  <thead>
                    <tr>
                      <th style="width: 55%">Particulars</th>
                      <th class="text-end" style="width: 22%">₹</th>
                      <th class="text-end" style="width: 23%">₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of model().equity.rows; track $index) {
                      @switch (row.kind) {
                        @case ('main-header') {
                          <tr class="bs-main"><td colspan="3">{{ row.label }}</td></tr>
                        }
                        @case ('sub-header') {
                          <tr class="bs-sub"><td colspan="3">{{ row.label }}</td></tr>
                        }
                        @case ('item') {
                          <tr class="bs-item">
                            <td>{{ row.label }}</td>
                            <td class="text-end mono">@if (row.col2 !== null) { {{ row.col2 | indianNumber }} }</td>
                            <td></td>
                          </tr>
                        }
                        @case ('item-neg') {
                          <tr class="bs-item-neg">
                            <td>{{ row.label }}</td>
                            <td class="text-end mono">@if (row.col2 !== null) { ({{ row.col2 | indianNumber }}) }</td>
                            <td></td>
                          </tr>
                        }
                        @case ('sub-total') {
                          <tr class="bs-subtotal">
                            <td>{{ row.label }}</td>
                            <td></td>
                            <td class="text-end mono fw-semibold">@if (row.col3 !== null) { {{ row.col3 | indianNumber }} }</td>
                          </tr>
                        }
                        @case ('grand-total') {
                          <tr class="bs-grand">
                            <td class="fw-bold">{{ row.label }}</td>
                            <td></td>
                            <td class="text-end mono fw-bold">@if (row.col3 !== null) { {{ row.col3 | indianNumber }} }</td>
                          </tr>
                        }
                      }
                    }
                    <tr><td colspan="3" style="height: 10px; border: none; background: var(--surface)"></td></tr>
                    @for (row of model().assets.rows; track $index) {
                      @switch (row.kind) {
                        @case ('main-header') {
                          <tr class="bs-main"><td colspan="3">{{ row.label }}</td></tr>
                        }
                        @case ('sub-header') {
                          <tr class="bs-sub"><td colspan="3">{{ row.label }}</td></tr>
                        }
                        @case ('item') {
                          <tr class="bs-item">
                            <td>{{ row.label }}</td>
                            <td class="text-end mono">@if (row.col2 !== null) { {{ row.col2 | indianNumber }} }</td>
                            <td></td>
                          </tr>
                        }
                        @case ('item-neg') {
                          <tr class="bs-item-neg">
                            <td>{{ row.label }}</td>
                            <td class="text-end mono">@if (row.col2 !== null) { ({{ row.col2 | indianNumber }}) }</td>
                            <td></td>
                          </tr>
                        }
                        @case ('sub-total') {
                          <tr class="bs-subtotal">
                            <td>{{ row.label }}</td>
                            <td></td>
                            <td class="text-end mono fw-semibold">@if (row.col3 !== null) { {{ row.col3 | indianNumber }} }</td>
                          </tr>
                        }
                        @case ('grand-total') {
                          <tr class="bs-grand">
                            <td class="fw-bold">{{ row.label }}</td>
                            <td></td>
                            <td class="text-end mono fw-bold">@if (row.col3 !== null) { {{ row.col3 | indianNumber }} }</td>
                          </tr>
                        }
                      }
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- ── HORIZONTAL (columnar) layout ────────────────── -->
          @if (viewMode() === 'horizontal') {
            <div class="bs-horizontal">
              <div class="card">
                <div class="card-header fw-bold" style="font-family: var(--font-heading)">
                  <i class="bi bi-bank me-2 text-danger"></i>Equity &amp; Liabilities
                </div>
                <div class="card-body p-0">
                  <table class="bs-table">
                    <thead>
                      <tr>
                        <th style="width:60%">Particulars</th>
                        <th class="text-end" style="width:20%">₹</th>
                        <th class="text-end" style="width:20%">₹</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of model().equity.rows; track $index) {
                        @switch (row.kind) {
                          @case ('main-header') {
                            <tr class="bs-main"><td colspan="3">{{ row.label }}</td></tr>
                          }
                          @case ('sub-header') {
                            <tr class="bs-sub"><td colspan="3">{{ row.label }}</td></tr>
                          }
                          @case ('item') {
                            <tr class="bs-item">
                              <td>{{ row.label }}</td>
                              <td class="text-end mono">@if (row.col2 !== null) { {{ row.col2 | indianNumber }} }</td>
                              <td></td>
                            </tr>
                          }
                          @case ('item-neg') {
                            <tr class="bs-item-neg">
                              <td>{{ row.label }}</td>
                              <td class="text-end mono">@if (row.col2 !== null) { ({{ row.col2 | indianNumber }}) }</td>
                              <td></td>
                            </tr>
                          }
                          @case ('sub-total') {
                            <tr class="bs-subtotal">
                              <td>{{ row.label }}</td>
                              <td></td>
                              <td class="text-end mono fw-semibold">@if (row.col3 !== null) { {{ row.col3 | indianNumber }} }</td>
                            </tr>
                          }
                          @case ('grand-total') {
                            <tr class="bs-grand">
                              <td class="fw-bold">{{ row.label }}</td>
                              <td></td>
                              <td class="text-end mono fw-bold">@if (row.col3 !== null) { {{ row.col3 | indianNumber }} }</td>
                            </tr>
                          }
                        }
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="card">
                <div class="card-header fw-bold" style="font-family: var(--font-heading)">
                  <i class="bi bi-box-seam me-2 text-primary"></i>Assets
                </div>
                <div class="card-body p-0">
                  <table class="bs-table">
                    <thead>
                      <tr>
                        <th style="width:60%">Particulars</th>
                        <th class="text-end" style="width:20%">₹</th>
                        <th class="text-end" style="width:20%">₹</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of model().assets.rows; track $index) {
                        @switch (row.kind) {
                          @case ('main-header') {
                            <tr class="bs-main"><td colspan="3">{{ row.label }}</td></tr>
                          }
                          @case ('sub-header') {
                            <tr class="bs-sub"><td colspan="3">{{ row.label }}</td></tr>
                          }
                          @case ('item') {
                            <tr class="bs-item">
                              <td>{{ row.label }}</td>
                              <td class="text-end mono">@if (row.col2 !== null) { {{ row.col2 | indianNumber }} }</td>
                              <td></td>
                            </tr>
                          }
                          @case ('item-neg') {
                            <tr class="bs-item-neg">
                              <td>{{ row.label }}</td>
                              <td class="text-end mono">@if (row.col2 !== null) { ({{ row.col2 | indianNumber }}) }</td>
                              <td></td>
                            </tr>
                          }
                          @case ('sub-total') {
                            <tr class="bs-subtotal">
                              <td>{{ row.label }}</td>
                              <td></td>
                              <td class="text-end mono fw-semibold">@if (row.col3 !== null) { {{ row.col3 | indianNumber }} }</td>
                            </tr>
                          }
                          @case ('grand-total') {
                            <tr class="bs-grand">
                              <td class="fw-bold">{{ row.label }}</td>
                              <td></td>
                              <td class="text-end mono fw-bold">@if (row.col3 !== null) { {{ row.col3 | indianNumber }} }</td>
                            </tr>
                          }
                        }
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          }
        </div><!-- /print-area -->

        <!-- ── Year-over-year chart ────────────────────────── -->
        <div class="card mt-3 no-print">
          <div class="card-header">
            <i class="bi bi-bar-chart-line me-2 text-accent"></i>
            Year-over-year Comparison
            <span class="text-muted small ms-2">(current vs. same date last year)</span>
          </div>
          <div class="card-body">
            <div class="chart-wrap"><canvas #barCanvas></canvas></div>
          </div>
        </div>
      }
    </div>

  `
})
export class BalanceSheetComponent implements AfterViewInit, OnDestroy {
  private readonly ledgerSvc = inject(LedgerService);
  private readonly assetSvc = inject(AssetService);
  private readonly voucherSvc = inject(VoucherService);
  private readonly companySvc = inject(CompanyService);
  private readonly exportSvc = inject(ExportService);

  private readonly barCanvas = viewChild<ElementRef<HTMLCanvasElement>>('barCanvas');
  private readonly printAreaRef = viewChild<ElementRef<HTMLElement>>('printArea');
  private chart: Chart | null = null;

  readonly asOnDate = signal<string>(new Date().toISOString().slice(0, 10));
  readonly viewMode = signal<'vertical' | 'horizontal'>('vertical');

  readonly model = computed<BSModel>(() => this.buildModel(this.asOnDate()));

  readonly isEmpty = computed(
    () => this.model().equity.total === 0 && this.model().assets.total === 0
  );

  readonly asOnDateFormatted = computed(() =>
    new Date(this.asOnDate()).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  );

  constructor() {
    this.ledgerSvc.sync();
    this.assetSvc.sync();
    this.voucherSvc.sync();

    effect(() => {
      // Re-render chart whenever model changes (e.g., date picker change)
      this.model(); // subscribe
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
    const el = this.printAreaRef()?.nativeElement;
    if (el) void this.exportSvc.toPdf(el, 'balance-sheet');
  }

  exportExcel(): void {
    this.exportSvc.toExcel(this.toFlatRows(), 'balance-sheet', 'Balance Sheet');
  }

  printReport(): void {
    this.exportSvc.print();
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  private computeBalances(asOnDate: string): Map<string, number> {
    const balances = new Map<string, number>();
    for (const l of this.ledgerSvc.ledgers()) {
      balances.set(l.id, l.openingNature === 'Dr' ? l.openingBalance : -l.openingBalance);
    }
    const cutoff = new Date(asOnDate).getTime() + 86_399_000; // end of day
    for (const v of this.voucherSvc.vouchers()) {
      if (new Date(v.date).getTime() > cutoff) continue;
      for (const ln of v.lines) {
        balances.set(ln.ledgerId, (balances.get(ln.ledgerId) ?? 0) + (ln.type === 'Dr' ? ln.amount : -ln.amount));
      }
    }
    return balances;
  }

  private rootOf(groupId: string): string {
    let gid = groupId;
    for (;;) {
      const g = this.ledgerSvc.getGroup(gid);
      if (!g?.parentId) return gid;
      gid = g.parentId;
    }
  }

  private buildBSData(asOnDate: string): { equity: BSSide; assets: BSSide } {
    const bal = this.computeBalances(asOnDate);

    interface LI { label: string; amount: number }

    const capitalItems: LI[] = [];
    const longLiab: LI[] = [];
    const currLiab: LI[] = [];
    const fixedItems: LI[] = [];
    const investItems: LI[] = [];
    const inventoryItems: LI[] = [];
    const receivableItems: LI[] = [];
    const cashItems: LI[] = [];
    const loanItems: LI[] = [];
    const prepaidItems: LI[] = [];
    const otherCurrentItems: LI[] = [];
    let netProfit = 0;

    for (const l of this.ledgerSvc.ledgers()) {
      const g = this.ledgerSvc.getGroup(l.groupId);
      if (!g) continue;
      const signed = bal.get(l.id) ?? 0;
      const root = this.rootOf(l.groupId);

      switch (g.type) {
        case 'Asset': {
          const amt = signed; // Dr positive for assets
          if (root === 'fixed-assets') {
            fixedItems.push({ label: l.name, amount: amt });
          } else if (root === 'investments') {
            investItems.push({ label: l.name, amount: amt });
          } else {
            const n = l.name.toLowerCase();
            if (/stock|inventor/i.test(n)) {
              inventoryItems.push({ label: l.name, amount: amt });
            } else if (/receiv|debtor|trade/i.test(n)) {
              receivableItems.push({ label: l.name, amount: amt });
            } else if (/cash|bank/i.test(n)) {
              cashItems.push({ label: l.name, amount: amt });
            } else if (/loan|advance/i.test(n)) {
              loanItems.push({ label: l.name, amount: amt });
            } else if (/prepaid/i.test(n)) {
              prepaidItems.push({ label: l.name, amount: amt });
            } else {
              otherCurrentItems.push({ label: l.name, amount: amt });
            }
          }
          break;
        }
        case 'Liability': {
          const amt = -signed; // Cr positive for liabilities
          if (root === 'long-term-liabilities') {
            longLiab.push({ label: l.name, amount: amt });
          } else {
            currLiab.push({ label: l.name, amount: amt });
          }
          break;
        }
        case 'Capital':
          capitalItems.push({ label: l.name, amount: -signed }); // Cr positive
          break;
        case 'Income':
          netProfit += -signed; // income: Cr → -signed gives positive
          break;
        case 'Expense':
          netProfit -= signed; // expense: Dr → reduces profit
          break;
      }
    }

    // Active fixed assets from the asset register (net book value)
    for (const a of this.assetSvc.assets()) {
      if (a.status === 'Active') {
        const bv = this.assetSvc.bookValue(a);
        if (bv > 0.005) fixedItems.push({ label: `${a.name} (Net of Dep.)`, amount: bv });
      }
    }

    const sum = (arr: LI[]): number => arr.reduce((s, i) => s + i.amount, 0);
    const rows = (kind: RowKind, label: string, col2: number | null, col3: number | null): BSRow =>
      ({ kind, label, col2, col3 });

    // ─── Equity & Liabilities rows ───────────────────────────────
    const eqRows: BSRow[] = [];
    eqRows.push(rows('main-header', 'I.  Equity & Liabilities', null, null));

    // (I) Shareholders' Funds / Capital
    eqRows.push(rows('sub-header', '  (I)  Shareholders\' Funds / Capital', null, null));
    for (const it of capitalItems) {
      eqRows.push(rows(it.amount < 0 ? 'item-neg' : 'item', `        ${it.label}`, Math.abs(it.amount), null));
    }
    if (Math.abs(netProfit) >= 0.005) {
      eqRows.push(rows(
        netProfit < 0 ? 'item-neg' : 'item',
        `        ${netProfit >= 0 ? 'Add: Net Profit' : 'Less: Net Loss'}`,
        Math.abs(netProfit),
        null
      ));
    }
    if (capitalItems.length === 0 && Math.abs(netProfit) < 0.005) {
      eqRows.push(rows('item', '        —', 0, null));
    }
    const capitalTotal = sum(capitalItems) + netProfit;
    eqRows.push(rows('sub-total', '', null, capitalTotal));

    // (II) Non-Current Liabilities
    eqRows.push(rows('sub-header', '  (II)  Non-Current Liabilities', null, null));
    if (longLiab.length === 0) eqRows.push(rows('item', '        —', 0, null));
    for (const it of longLiab) eqRows.push(rows('item', `        ${it.label}`, it.amount, null));
    const longTotal = sum(longLiab);
    eqRows.push(rows('sub-total', '', null, longTotal));

    // (III) Current Liabilities
    eqRows.push(rows('sub-header', '  (III)  Current Liabilities', null, null));
    if (currLiab.length === 0) eqRows.push(rows('item', '        —', 0, null));
    for (const it of currLiab) eqRows.push(rows('item', `        ${it.label}`, it.amount, null));
    const currLiabTotal = sum(currLiab);
    eqRows.push(rows('sub-total', '', null, currLiabTotal));

    const totalEquity = capitalTotal + longTotal + currLiabTotal;
    eqRows.push(rows('grand-total', 'Total Equity & Liabilities', null, totalEquity));

    // ─── Asset rows ──────────────────────────────────────────────
    const asRows: BSRow[] = [];
    asRows.push(rows('main-header', 'II.  Assets', null, null));

    // (I) Non-Current Assets
    asRows.push(rows('sub-header', '  (I)  Non-Current Assets', null, null));
    asRows.push(rows('sub-header', '      a.  Fixed Assets (Tangible & Intangible)', null, null));
    if (fixedItems.length === 0) asRows.push(rows('item', '           —', 0, null));
    for (const it of fixedItems) asRows.push(rows('item', `           ${it.label}`, it.amount, null));
    asRows.push(rows('sub-header', '      b.  Long-term Investments', null, null));
    if (investItems.length === 0) asRows.push(rows('item', '           —', 0, null));
    for (const it of investItems) asRows.push(rows('item', `           ${it.label}`, it.amount, null));
    const nonCurrTotal = sum(fixedItems) + sum(investItems);
    asRows.push(rows('sub-total', '', null, nonCurrTotal));

    // (II) Current Assets
    asRows.push(rows('sub-header', '  (II)  Current Assets', null, null));

    const addSubcat = (label: string, items: LI[]): void => {
      if (!items.length) return;
      asRows.push(rows('sub-header', `      ${label}`, null, null));
      for (const it of items) asRows.push(rows('item', `           ${it.label}`, it.amount, null));
    };

    addSubcat('a.  Inventories (Closing Stock)', inventoryItems);
    addSubcat('b.  Trade Receivables (Debtors)', receivableItems);
    addSubcat('c.  Cash & Cash Equivalents', cashItems);
    addSubcat('d.  Short-term Loans & Advances', loanItems);
    addSubcat('e.  Prepaid Expenses', prepaidItems);
    for (const it of otherCurrentItems) asRows.push(rows('item', `      ${it.label}`, it.amount, null));

    const allCurrent = [...inventoryItems, ...receivableItems, ...cashItems, ...loanItems, ...prepaidItems, ...otherCurrentItems];
    if (allCurrent.length === 0) asRows.push(rows('item', '      —', 0, null));

    const currentTotal = sum(allCurrent);
    asRows.push(rows('sub-total', '', null, currentTotal));

    const totalAssets = nonCurrTotal + currentTotal;
    asRows.push(rows('grand-total', 'Total Assets', null, totalAssets));

    return {
      equity: {
        rows: eqRows, total: totalEquity,
        capital: capitalTotal, longLiab: longTotal, currLiab: currLiabTotal,
        fixedAssets: 0, currentAssets: 0 // not used from equity side
      },
      assets: {
        rows: asRows, total: totalAssets,
        capital: 0, longLiab: 0, currLiab: 0, // not used from asset side
        fixedAssets: sum(fixedItems), currentAssets: currentTotal
      }
    };
  }

  private buildModel(asOnDate: string): BSModel {
    const { equity, assets } = this.buildBSData(asOnDate);

    // Previous year: same date minus 1 year
    const prevD = new Date(asOnDate);
    prevD.setFullYear(prevD.getFullYear() - 1);
    const prevDate = prevD.toISOString().slice(0, 10);
    const { equity: pe, assets: pa } = this.buildBSData(prevDate);

    return {
      companyName: this.companySvc.activeCompany()?.name ?? 'Company',
      equity,
      assets,
      balanced: Math.abs(equity.total - assets.total) < 1,
      diff: Math.abs(equity.total - assets.total),
      prevEquityTotal: pe.total,
      prevAssetsTotal: pa.total,
      prevCapital: pe.capital,
      prevLongLiab: pe.longLiab,
      prevCurrLiab: pe.currLiab,
      prevFixedAssets: pa.fixedAssets,
      prevCurrentAssets: pa.currentAssets
    };
  }

  private renderChart(): void {
    const el = this.barCanvas()?.nativeElement;
    if (!el) return;

    this.chart?.destroy();
    const m = this.model();

    const labels = ['Fixed Assets', 'Current Assets', 'Capital', 'Non-curr. Liab.', 'Curr. Liab.'];
    const current = [
      m.assets.fixedAssets, m.assets.currentAssets,
      m.equity.capital, m.equity.longLiab, m.equity.currLiab
    ];
    const previous = [
      m.prevFixedAssets, m.prevCurrentAssets,
      m.prevCapital, m.prevLongLiab, m.prevCurrLiab
    ];

    this.chart = new Chart(el, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: `As on ${this.asOnDate()}`,
            data: current,
            backgroundColor: 'rgba(27,58,92,0.82)',
            borderColor: '#1B3A5C',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Previous Year',
            data: previous,
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
    const fmt = (n: number | null): string =>
      n === null ? '' : new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n);

    out.push({ Particulars: `Balance Sheet as at ${this.asOnDateFormatted()}`, '': '', Amount: '' });
    out.push({ Particulars: '', '': '', Amount: '' });
    out.push({ Particulars: 'EQUITY & LIABILITIES', '': '', Amount: '' });

    for (const r of m.equity.rows) {
      if (r.kind === 'main-header' || r.kind === 'sub-header') {
        out.push({ Particulars: r.label.trim(), '': '', Amount: '' });
      } else if (r.kind === 'item' || r.kind === 'item-neg') {
        out.push({ Particulars: r.label.trim(), '': fmt(r.col2), Amount: '' });
      } else if (r.kind === 'sub-total' || r.kind === 'grand-total') {
        out.push({ Particulars: r.label.trim(), '': '', Amount: fmt(r.col3) });
      }
    }

    out.push({ Particulars: '', '': '', Amount: '' });
    out.push({ Particulars: 'ASSETS', '': '', Amount: '' });

    for (const r of m.assets.rows) {
      if (r.kind === 'main-header' || r.kind === 'sub-header') {
        out.push({ Particulars: r.label.trim(), '': '', Amount: '' });
      } else if (r.kind === 'item' || r.kind === 'item-neg') {
        out.push({ Particulars: r.label.trim(), '': fmt(r.col2), Amount: '' });
      } else if (r.kind === 'sub-total' || r.kind === 'grand-total') {
        out.push({ Particulars: r.label.trim(), '': '', Amount: fmt(r.col3) });
      }
    }

    return out;
  }
}
