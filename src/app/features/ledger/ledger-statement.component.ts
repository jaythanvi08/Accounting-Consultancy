import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LedgerService } from '../../core/services/ledger.service';
import { CompanyService } from '../../core/services/company.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { Ledger } from '../../core/models';

interface TRow {
  date: string;
  particulars: string;
  amount: number;
  bold?: boolean;
}

@Component({
  selector: 'app-ledger-statement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, IndianNumberPipe],
  styles: [
    `
      .taccount {
        border: 2px solid var(--primary);
        border-radius: var(--radius-sm);
        overflow: hidden;
      }
      .taccount table { margin: 0; }
      .taccount .side-dr { border-right: 2px solid var(--primary); }
      .t-head th {
        background: var(--primary);
        color: #fff;
        text-align: center;
        font-family: var(--font-heading);
        font-weight: 600;
      }
      .t-sub th {
        background: var(--surface);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--text-secondary);
      }
      .t-total td { border-top: 2px solid var(--primary); font-weight: 700; background: var(--surface); }
      .amt { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
    `
  ],
  template: `
    <div class="fade-in">
      @if (ledger(); as l) {
        <app-page-header [title]="l.name" subtitle="Ledger Statement — T-Account format" icon="bi-file-earmark-text">
          <a routerLink="/app/ledger/list" class="btn btn-outline-secondary btn-sm me-2">
            <i class="bi bi-arrow-left me-1"></i>Back
          </a>
          <button class="btn btn-primary btn-sm no-print" (click)="print()">
            <i class="bi bi-printer me-1"></i>Print
          </button>
        </app-page-header>

        <div class="d-flex flex-wrap gap-4 mb-3 small text-secondary">
          <span><i class="bi bi-diagram-3 me-1 text-accent"></i>Group: <strong>{{ ledgers.groupName(l.groupId) }}</strong></span>
          <span><i class="bi bi-building me-1 text-accent"></i>{{ companyName() }}</span>
          @if (l.gstin) {<span><i class="bi bi-patch-check me-1 text-accent"></i>GSTIN: <strong>{{ l.gstin }}</strong></span>}
        </div>

        <div class="taccount">
          <table class="table table-bordered mb-0">
            <thead>
              <tr class="t-head">
                <th colspan="3" class="side-dr">Dr</th>
                <th colspan="3">Cr</th>
              </tr>
              <tr class="t-sub">
                <th>Date</th><th>Particulars</th><th class="text-end">Amount (₹)</th>
                <th>Date</th><th>Particulars</th><th class="text-end">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              @for (row of tRows(); track $index) {
                <tr>
                  @if (row.dr; as dr) {
                    <td class="side-dr">{{ dr.date }}</td>
                    <td class="side-dr">{{ dr.particulars }}</td>
                    <td class="side-dr amt">{{ dr.amount | indianNumber }}</td>
                  } @else {
                    <td class="side-dr"></td><td class="side-dr"></td><td class="side-dr"></td>
                  }
                  @if (row.cr; as cr) {
                    <td>{{ cr.date }}</td>
                    <td>{{ cr.particulars }}</td>
                    <td class="amt">{{ cr.amount | indianNumber }}</td>
                  } @else {
                    <td></td><td></td><td></td>
                  }
                </tr>
              }
              <tr class="t-total">
                <td class="side-dr" colspan="2">Total</td>
                <td class="side-dr amt">{{ total() | indianNumber }}</td>
                <td colspan="2">Total</td>
                <td class="amt">{{ total() | indianNumber }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="text-muted small mt-3">
          <i class="bi bi-info-circle me-1"></i>
          Only the opening balance is shown. Posted vouchers will appear here automatically once transactions are recorded.
        </p>
      } @else {
        <div class="card"><div class="card-body text-center text-muted py-5">
          <i class="bi bi-exclamation-triangle fs-1 d-block mb-2"></i>
          Ledger not found.
          <div class="mt-3"><a routerLink="/app/ledger/list" class="btn btn-primary btn-sm">Back to Ledgers</a></div>
        </div></div>
      }
    </div>
  `
})
export class LedgerStatementComponent {
  readonly ledgers = inject(LedgerService);
  private readonly companies = inject(CompanyService);
  private readonly route = inject(ActivatedRoute);

  readonly ledger = signal<Ledger | undefined>(undefined);

  readonly companyName = computed(() => this.companies.activeCompany()?.name ?? '');

  readonly drRows = computed<TRow[]>(() => {
    const l = this.ledger();
    if (!l) {
      return [];
    }
    const rows: TRow[] = [];
    const date = this.openingDate();
    if (l.openingNature === 'Dr') {
      rows.push({ date, particulars: 'To Opening Balance b/d', amount: l.openingBalance });
    } else {
      // closing balance carried down on the Dr side to balance a Cr opening
      rows.push({ date: this.closeDate(), particulars: 'To Balance c/d', amount: l.openingBalance, bold: true });
    }
    return rows;
  });

  readonly crRows = computed<TRow[]>(() => {
    const l = this.ledger();
    if (!l) {
      return [];
    }
    const rows: TRow[] = [];
    const date = this.openingDate();
    if (l.openingNature === 'Cr') {
      rows.push({ date, particulars: 'By Opening Balance b/d', amount: l.openingBalance });
    } else {
      rows.push({ date: this.closeDate(), particulars: 'By Balance c/d', amount: l.openingBalance, bold: true });
    }
    return rows;
  });

  readonly tRows = computed<{ dr?: TRow; cr?: TRow }[]>(() => {
    const dr = this.drRows();
    const cr = this.crRows();
    const n = Math.max(dr.length, cr.length);
    return Array.from({ length: n }, (_, i) => ({ dr: dr[i], cr: cr[i] }));
  });

  readonly total = computed(() => this.ledger()?.openingBalance ?? 0);

  constructor() {
    this.ledgers.sync();
    const id = this.route.snapshot.paramMap.get('id');
    this.ledger.set(id ? this.ledgers.getLedger(id) : undefined);
  }

  private openingDate(): string {
    const fy = this.companies.activeCompany()?.financialYearStart;
    return fy ? this.fmt(fy) : '01/04';
  }
  private closeDate(): string {
    return this.openingDate();
  }
  private fmt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  print(): void {
    window.print();
  }
}
