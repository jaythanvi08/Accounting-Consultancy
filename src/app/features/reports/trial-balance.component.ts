import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CompanyService } from '../../core/services/company.service';
import { ExportService } from '../../core/services/export.service';
import { LedgerService } from '../../core/services/ledger.service';
import { VoucherService } from '../../core/services/voucher.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { AccountType } from '../../core/models';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TBRow {
  ledgerId: string;
  name: string;
  group: string;
  type: AccountType;
  debit: number; // 0 when this ledger nets to a credit balance
  credit: number; // 0 when this ledger nets to a debit balance
}

interface TBSection {
  type: AccountType;
  label: string;
  rows: TBRow[];
  debit: number;
  credit: number;
}

interface TBModel {
  companyName: string;
  sections: TBSection[];
  flat: TBRow[];
  totalDebit: number;
  totalCredit: number;
  diff: number;
  balanced: boolean;
}

/** Canonical NCERT ordering of the five fundamental account types. */
const TYPE_ORDER: readonly { type: AccountType; label: string }[] = [
  { type: 'Asset', label: 'Assets' },
  { type: 'Liability', label: 'Liabilities' },
  { type: 'Capital', label: 'Capital' },
  { type: 'Income', label: 'Income' },
  { type: 'Expense', label: 'Expenses' }
];

/** Below this (in rupees) a balance is treated as nil / the report as balanced. */
const TOLERANCE = 0.01;

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-trial-balance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageHeaderComponent, IndianNumberPipe],
  styles: [
    `
      /* ── Toolbar ─────────────────────────────────────────────── */
      .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
      .mode-btn { padding: 0.3rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: transparent; cursor: pointer; font-size: 0.82rem; transition: all 0.15s; }
      .mode-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

      /* ── Table ───────────────────────────────────────────────── */
      .tb-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
      .tb-table th { padding: 0.5rem 0.75rem; border-bottom: 2px solid var(--primary); color: var(--text-secondary); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
      .tb-table td { padding: 0.34rem 0.75rem; border-top: 1px dashed var(--border); }
      .tb-table .num { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
      .tb-table .idx { color: var(--text-muted); width: 2.5rem; text-align: right; font-family: var(--font-mono); }

      tr.tb-section td { background: var(--surface); font-family: var(--font-heading); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-primary); border-top: 1px solid var(--border); }
      tr.tb-subtotal td { border-top: 2px solid var(--border); font-weight: 600; background: #fbfcfe; }
      tr.tb-grand td { background: #f0f4fa; border-top: 3px double var(--primary); border-bottom: 2px solid var(--primary); font-family: var(--font-heading); font-weight: 700; }

      .text-debit { color: var(--success); font-family: var(--font-mono); font-weight: 600; }
      .text-credit { color: var(--danger); font-family: var(--font-mono); font-weight: 600; }

      /* ── Balance-check banner ────────────────────────────────── */
      .balance-check { display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 1rem; border-radius: var(--radius-sm); font-family: var(--font-heading); font-weight: 600; font-size: 0.9rem; }
      .balance-check.ok { background: #e8f5ee; color: var(--success); border: 1px solid var(--success); }
      .balance-check.fail { background: #fdf0f0; color: var(--danger); border: 1px solid var(--danger); }
      .mono { font-family: var(--font-mono); }

      /* ── Print ───────────────────────────────────────────────── */
      @media print {
        .no-print { display: none !important; }
        .tb-table { font-size: 10pt; }
        tr.tb-grand td { background: #f0f4fa !important; -webkit-print-color-adjust: exact; }
        tr.tb-section td { background: #f4f7fb !important; -webkit-print-color-adjust: exact; }
        .print-area { padding: 0 !important; }
      }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header
        title="Trial Balance"
        subtitle="Closing balance of every ledger — total Debit must equal total Credit"
        icon="bi-list-columns"
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

        <div>
          <button class="mode-btn" [class.active]="grouped()" (click)="grouped.set(true)">
            <i class="bi bi-diagram-3 me-1"></i>Grouped
          </button>
          <button class="mode-btn" [class.active]="!grouped()" (click)="grouped.set(false)">
            <i class="bi bi-list-ul me-1"></i>Flat
          </button>
        </div>

        <div class="form-check form-switch mb-0 ms-1">
          <input
            class="form-check-input"
            type="checkbox"
            id="tb-show-nil"
            [ngModel]="showNil()"
            (ngModelChange)="showNil.set($event)"
          />
          <label class="form-check-label small text-secondary" for="tb-show-nil">Show nil balances</label>
        </div>
      </div>

      @if (isEmpty()) {
        <div class="card">
          <div class="card-body text-center text-muted py-5">
            <i class="bi bi-list-columns fs-1 d-block mb-2"></i>
            No balances yet. Add ledgers with opening balances or post vouchers to generate the Trial Balance.
          </div>
        </div>
      } @else {
        <div class="print-area" #printArea>
          <!-- Print header -->
          <div class="text-center mb-3" style="border-bottom: 2px solid var(--primary); padding-bottom: 0.75rem;">
            <div class="fw-bold" style="font-family: var(--font-heading); font-size: 1.15rem; color: var(--primary)">
              {{ model().companyName }}
            </div>
            <div class="text-secondary" style="font-size: 0.85rem; letter-spacing: 0.04em">
              TRIAL BALANCE as on {{ asOnDateFormatted() }}
            </div>
          </div>

          <!-- Balance-check banner -->
          <div class="balance-check mb-3" [class.ok]="model().balanced" [class.fail]="!model().balanced">
            <i class="bi fs-5" [class.bi-check-circle-fill]="model().balanced" [class.bi-exclamation-triangle-fill]="!model().balanced"></i>
            @if (model().balanced) {
              Trial Balance agrees &nbsp;—&nbsp;
              <span class="mono">₹{{ model().totalDebit | indianNumber }}</span>
              &nbsp;=&nbsp;
              <span class="mono">₹{{ model().totalCredit | indianNumber }}</span>
            } @else {
              Out of balance by
              <span class="mono">₹{{ model().diff | indianNumber }}</span>
              &nbsp;|&nbsp; Debit: <span class="mono">₹{{ model().totalDebit | indianNumber }}</span>
              &nbsp;|&nbsp; Credit: <span class="mono">₹{{ model().totalCredit | indianNumber }}</span>
            }
          </div>

          <div class="card">
            <div class="card-body p-0">
              <table class="tb-table">
                <thead>
                  <tr>
                    <th class="idx">#</th>
                    <th style="width: 42%">Ledger Account</th>
                    <th style="width: 28%">Group</th>
                    <th class="num" style="width: 14%">Debit (₹)</th>
                    <th class="num" style="width: 14%">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  @if (grouped()) {
                    @for (section of model().sections; track section.type) {
                      <tr class="tb-section">
                        <td></td>
                        <td colspan="2">{{ section.label }}</td>
                        <td class="num">@if (section.debit > 0) { {{ section.debit | indianNumber }} }</td>
                        <td class="num">@if (section.credit > 0) { {{ section.credit | indianNumber }} }</td>
                      </tr>
                      @for (row of section.rows; track row.ledgerId; let i = $index) {
                        <tr>
                          <td class="idx">{{ i + 1 }}</td>
                          <td>{{ row.name }}</td>
                          <td class="text-secondary small">{{ row.group }}</td>
                          <td class="num"><span class="text-debit">@if (row.debit > 0) { {{ row.debit | indianNumber }} }</span></td>
                          <td class="num"><span class="text-credit">@if (row.credit > 0) { {{ row.credit | indianNumber }} }</span></td>
                        </tr>
                      }
                    }
                  } @else {
                    @for (row of model().flat; track row.ledgerId; let i = $index) {
                      <tr>
                        <td class="idx">{{ i + 1 }}</td>
                        <td>{{ row.name }}</td>
                        <td class="text-secondary small">{{ row.group }}</td>
                        <td class="num"><span class="text-debit">@if (row.debit > 0) { {{ row.debit | indianNumber }} }</span></td>
                        <td class="num"><span class="text-credit">@if (row.credit > 0) { {{ row.credit | indianNumber }} }</span></td>
                      </tr>
                    }
                  }

                  <tr class="tb-grand">
                    <td></td>
                    <td colspan="2">Total</td>
                    <td class="num">{{ model().totalDebit | indianNumber }}</td>
                    <td class="num">{{ model().totalCredit | indianNumber }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p class="text-muted small mt-3">
            <i class="bi bi-info-circle me-1"></i>
            Balances reflect each ledger's opening balance plus all vouchers posted on or before the as-on date.
            Nil-balance ledgers are {{ showNil() ? 'shown' : 'hidden' }}.
          </p>
        </div><!-- /print-area -->
      }
    </div>
  `
})
export class TrialBalanceComponent {
  private readonly ledgerSvc = inject(LedgerService);
  private readonly voucherSvc = inject(VoucherService);
  private readonly companySvc = inject(CompanyService);
  private readonly exportSvc = inject(ExportService);

  private readonly printAreaRef = viewChild<ElementRef<HTMLElement>>('printArea');

  readonly asOnDate = signal<string>(new Date().toISOString().slice(0, 10));
  readonly grouped = signal(true);
  readonly showNil = signal(false);

  readonly model = computed<TBModel>(() =>
    this.buildModel(this.asOnDate(), this.showNil())
  );

  readonly isEmpty = computed(() => this.model().flat.length === 0);

  readonly asOnDateFormatted = computed(() =>
    new Date(this.asOnDate()).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  );

  constructor() {
    this.ledgerSvc.sync();
    this.voucherSvc.sync();
  }

  // ─── Exports ─────────────────────────────────────────────────────────────

  exportPdf(): void {
    const el = this.printAreaRef()?.nativeElement;
    if (el) void this.exportSvc.toPdf(el, 'trial-balance');
  }

  exportExcel(): void {
    this.exportSvc.toExcel(this.toFlatRows(), 'trial-balance', 'Trial Balance');
  }

  printReport(): void {
    this.exportSvc.print();
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  /**
   * Net signed balance per ledger (Dr +, Cr −): opening balance plus every
   * voucher line posted on or before {@link asOnDate}. Mirrors the Balance
   * Sheet's computation so the two reports always reconcile.
   */
  private computeBalances(asOnDate: string): Map<string, number> {
    const balances = new Map<string, number>();
    for (const l of this.ledgerSvc.ledgers()) {
      balances.set(l.id, l.openingNature === 'Dr' ? l.openingBalance : -l.openingBalance);
    }
    const cutoff = new Date(asOnDate).getTime() + 86_399_000; // end of day
    for (const v of this.voucherSvc.vouchers()) {
      if (new Date(v.date).getTime() > cutoff) {
        continue;
      }
      for (const ln of v.lines) {
        balances.set(
          ln.ledgerId,
          (balances.get(ln.ledgerId) ?? 0) + (ln.type === 'Dr' ? ln.amount : -ln.amount)
        );
      }
    }
    return balances;
  }

  private buildModel(asOnDate: string, showNil: boolean): TBModel {
    const bal = this.computeBalances(asOnDate);

    const rowsByType = new Map<AccountType, TBRow[]>();
    for (const { type } of TYPE_ORDER) {
      rowsByType.set(type, []);
    }

    for (const l of this.ledgerSvc.ledgers()) {
      const g = this.ledgerSvc.getGroup(l.groupId);
      if (!g) {
        continue;
      }
      const net = bal.get(l.id) ?? 0;
      const nil = Math.abs(net) < TOLERANCE;
      if (nil && !showNil) {
        continue;
      }
      rowsByType.get(g.type)?.push({
        ledgerId: l.id,
        name: l.name,
        group: g.name,
        type: g.type,
        debit: net > TOLERANCE ? net : 0,
        credit: net < -TOLERANCE ? -net : 0
      });
    }

    const sections: TBSection[] = [];
    const flat: TBRow[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const { type, label } of TYPE_ORDER) {
      const rows = (rowsByType.get(type) ?? []).sort((a, b) => a.name.localeCompare(b.name));
      if (rows.length === 0) {
        continue;
      }
      const debit = rows.reduce((s, r) => s + r.debit, 0);
      const credit = rows.reduce((s, r) => s + r.credit, 0);
      sections.push({ type, label, rows, debit, credit });
      flat.push(...rows);
      totalDebit += debit;
      totalCredit += credit;
    }

    return {
      companyName: this.companySvc.activeCompany()?.name ?? 'Company',
      sections,
      flat,
      totalDebit,
      totalCredit,
      diff: Math.abs(totalDebit - totalCredit),
      balanced: Math.abs(totalDebit - totalCredit) < TOLERANCE
    };
  }

  private toFlatRows(): Record<string, string | number>[] {
    const m = this.model();
    const out: Record<string, string | number>[] = m.flat.map((r) => ({
      'Ledger Account': r.name,
      Group: r.group,
      Type: r.type,
      Debit: r.debit > 0 ? r.debit : '',
      Credit: r.credit > 0 ? r.credit : ''
    }));
    out.push({
      'Ledger Account': 'TOTAL',
      Group: '',
      Type: '',
      Debit: m.totalDebit,
      Credit: m.totalCredit
    });
    return out;
  }
}
