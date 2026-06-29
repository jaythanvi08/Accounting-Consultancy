import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BooksService } from '../../core/services/books.service';
import { CompanyService } from '../../core/services/company.service';
import { ExportService } from '../../core/services/export.service';
import { UiService } from '../../core/services/ui.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { CashEntry, EmiRow, Loan, PurchaseEntry, SalesEntry } from '../../core/models';

type BookTab = 'purchase' | 'sales' | 'cash' | 'finance';

interface PurchaseRow extends PurchaseEntry {
  net: number;
  running: number;
}
interface SalesRow extends SalesEntry {
  net: number;
  running: number;
}
interface CashTotals {
  discount: number;
  cash: number;
  bank: number;
}
interface FinanceSummary {
  emi: number;
  totalInterest: number;
  totalPayable: number;
  outstanding: number;
  interestAccrued: number;
  paid: number;
}

const TABS: ReadonlyArray<{ key: BookTab; label: string; icon: string }> = [
  { key: 'purchase', label: 'Purchase Book', icon: 'bi-cart' },
  { key: 'sales', label: 'Sales Book', icon: 'bi-bag' },
  { key: 'cash', label: 'Cash Book', icon: 'bi-cash-stack' },
  { key: 'finance', label: 'Finance Book', icon: 'bi-bank' }
];

@Component({
  selector: 'app-books',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, PageHeaderComponent, IndianNumberPipe],
  styles: [
    `
      .book-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        border-bottom: 2px solid var(--border);
        margin-bottom: 1rem;
      }
      .book-tab {
        border: none;
        background: transparent;
        padding: 0.6rem 1.1rem;
        font-family: var(--font-heading);
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--text-secondary);
        border-bottom: 3px solid transparent;
        margin-bottom: -2px;
        cursor: pointer;
        transition: color var(--transition), border-color var(--transition);
      }
      .book-tab:hover { color: var(--primary); }
      .book-tab.active { color: var(--primary); border-bottom-color: var(--accent); }
      .filter-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .amt { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
      .total-row td { font-weight: 700; background: var(--surface); border-top: 2px solid var(--primary); }

      /* Cash Book — classic double-column T-format via CSS Grid */
      .cashbook {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border: 2px solid var(--primary);
        border-radius: var(--radius-sm);
        overflow: hidden;
      }
      .cashbook__side:last-child { border-left: 2px solid var(--primary); }
      .cashbook__head {
        background: var(--primary);
        color: #fff;
        text-align: center;
        font-family: var(--font-heading);
        font-weight: 600;
        padding: 0.5rem;
      }
      .cashbook__head.cr { background: var(--danger); }
      .cashbook table { margin: 0; font-size: 0.82rem; }
      @media (max-width: 800px) {
        .cashbook { grid-template-columns: 1fr; }
        .cashbook__side:last-child { border-left: none; border-top: 2px solid var(--primary); }
      }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header
        title="Books of Account"
        subtitle="Subsidiary books — Purchase, Sales, Cash & Finance"
        icon="bi-book"
      />

      <!-- Tabs -->
      <div class="book-tabs no-print">
        @for (t of tabs; track t.key) {
          <button class="book-tab" [class.active]="active() === t.key" (click)="active.set(t.key)">
            <i class="bi {{ t.icon }} me-1"></i>{{ t.label }}
          </button>
        }
      </div>

      <!-- Filter + export bar -->
      <div class="filter-bar no-print">
        <div>
          <label class="form-label mb-1">From</label>
          <input type="date" class="form-control form-control-sm" [value]="from()"
                 (change)="from.set($any($event.target).value)" />
        </div>
        <div>
          <label class="form-label mb-1">To</label>
          <input type="date" class="form-control form-control-sm" [value]="to()"
                 (change)="to.set($any($event.target).value)" />
        </div>
        @if (from() || to()) {
          <button class="btn btn-outline-secondary btn-sm" (click)="from.set(''); to.set('')">Clear</button>
        }
        <div class="ms-auto d-flex gap-2">
          <button class="btn btn-outline-danger btn-sm" (click)="exportPdf()"><i class="bi bi-file-pdf me-1"></i>PDF</button>
          <button class="btn btn-outline-success btn-sm" (click)="exportExcel()"><i class="bi bi-file-excel me-1"></i>Excel</button>
          <button class="btn btn-outline-secondary btn-sm" (click)="exp.print()"><i class="bi bi-printer me-1"></i>Print</button>
        </div>
      </div>

      <div #exportArea class="card">
        <div class="card-body">
          @switch (active()) {
            <!-- ═══════════ PURCHASE BOOK ═══════════ -->
            @case ('purchase') {
              <h2 class="h6 display mb-3">Purchase Book <span class="text-muted small fw-normal">· {{ company() }}</span></h2>
              <div class="table-responsive">
                <table class="table table-bordered table-sm align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>Date</th><th>Invoice No.</th><th>Supplier Name</th><th>Ledger</th><th>Inward No.</th>
                      <th class="text-end">Amount (Dr)</th><th class="text-end">GST</th>
                      <th class="text-end">Net Amount</th><th class="text-end">Running Bal.</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of purchaseRows(); track r.id) {
                      <tr>
                        <td>{{ r.date | date: 'dd/MM/yyyy' }}</td>
                        <td>{{ r.invoiceNo }}</td>
                        <td>{{ r.supplierName }}</td>
                        <td>{{ r.ledgerName }}</td>
                        <td>{{ r.inwardNo }}</td>
                        <td class="amt">{{ r.amount | indianNumber }}</td>
                        <td class="amt">{{ r.gst | indianNumber }}</td>
                        <td class="amt">{{ r.net | indianNumber }}</td>
                        <td class="amt">{{ r.running | indianNumber }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="9" class="text-center text-muted py-4">No purchase entries in this period.</td></tr>
                    }
                  </tbody>
                  @if (purchaseRows().length) {
                    <tfoot>
                      <tr class="total-row">
                        <td colspan="5" class="text-end">Total</td>
                        <td class="amt">{{ purchaseTotals().amount | indianNumber }}</td>
                        <td class="amt">{{ purchaseTotals().gst | indianNumber }}</td>
                        <td class="amt" colspan="2">{{ purchaseTotals().net | indianNumber }}</td>
                      </tr>
                    </tfoot>
                  }
                </table>
              </div>
            }

            <!-- ═══════════ SALES BOOK ═══════════ -->
            @case ('sales') {
              <h2 class="h6 display mb-3">Sales Book <span class="text-muted small fw-normal">· {{ company() }}</span></h2>
              <div class="table-responsive">
                <table class="table table-bordered table-sm align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>Date</th><th>Invoice No.</th><th>Customer Name</th><th>Ledger</th><th>Outward No.</th>
                      <th class="text-end">Amount (Cr)</th><th class="text-end">GST</th>
                      <th class="text-end">Net Amount</th><th class="text-end">Running Bal.</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of salesRows(); track r.id) {
                      <tr>
                        <td>{{ r.date | date: 'dd/MM/yyyy' }}</td>
                        <td>{{ r.invoiceNo }}</td>
                        <td>{{ r.customerName }}</td>
                        <td>{{ r.ledgerName }}</td>
                        <td>{{ r.outwardNo }}</td>
                        <td class="amt">{{ r.amount | indianNumber }}</td>
                        <td class="amt">{{ r.gst | indianNumber }}</td>
                        <td class="amt">{{ r.net | indianNumber }}</td>
                        <td class="amt">{{ r.running | indianNumber }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="9" class="text-center text-muted py-4">No sales entries in this period.</td></tr>
                    }
                  </tbody>
                  @if (salesRows().length) {
                    <tfoot>
                      <tr class="total-row">
                        <td colspan="5" class="text-end">Total</td>
                        <td class="amt">{{ salesTotals().amount | indianNumber }}</td>
                        <td class="amt">{{ salesTotals().gst | indianNumber }}</td>
                        <td class="amt" colspan="2">{{ salesTotals().net | indianNumber }}</td>
                      </tr>
                    </tfoot>
                  }
                </table>
              </div>
            }

            <!-- ═══════════ CASH BOOK (double column) ═══════════ -->
            @case ('cash') {
              <h2 class="h6 display mb-3">Cash Book <span class="text-muted small fw-normal">· Double Column (Cash & Bank)</span></h2>
              <div class="cashbook">
                <!-- Receipts / Dr -->
                <div class="cashbook__side">
                  <div class="cashbook__head">Receipts (Dr)</div>
                  <table class="table table-bordered table-sm mb-0">
                    <thead class="table-light">
                      <tr><th>Date</th><th>Particulars</th><th>Folio</th><th class="text-end">Disc.</th><th class="text-end">Cash</th><th class="text-end">Bank</th></tr>
                    </thead>
                    <tbody>
                      @for (r of receipts(); track r.id) {
                        <tr>
                          <td>{{ r.date | date: 'dd/MM' }}</td><td>{{ r.particulars }}</td><td>{{ r.folio }}</td>
                          <td class="amt">{{ r.discount | indianNumber }}</td>
                          <td class="amt">{{ r.cash | indianNumber }}</td>
                          <td class="amt">{{ r.bank | indianNumber }}</td>
                        </tr>
                      } @empty {
                        <tr><td colspan="6" class="text-center text-muted py-3">No receipts.</td></tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr class="total-row">
                        <td colspan="3" class="text-end">Total</td>
                        <td class="amt">{{ receiptTotals().discount | indianNumber }}</td>
                        <td class="amt">{{ receiptTotals().cash | indianNumber }}</td>
                        <td class="amt">{{ receiptTotals().bank | indianNumber }}</td>
                      </tr>
                      <tr class="total-row">
                        <td colspan="3" class="text-end">Closing Balance c/d</td>
                        <td class="amt">—</td>
                        <td class="amt">{{ closing().cash | indianNumber }}</td>
                        <td class="amt">{{ closing().bank | indianNumber }}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <!-- Payments / Cr -->
                <div class="cashbook__side">
                  <div class="cashbook__head cr">Payments (Cr)</div>
                  <table class="table table-bordered table-sm mb-0">
                    <thead class="table-light">
                      <tr><th>Date</th><th>Particulars</th><th>Folio</th><th class="text-end">Disc.</th><th class="text-end">Cash</th><th class="text-end">Bank</th></tr>
                    </thead>
                    <tbody>
                      @for (r of payments(); track r.id) {
                        <tr>
                          <td>{{ r.date | date: 'dd/MM' }}</td><td>{{ r.particulars }}</td><td>{{ r.folio }}</td>
                          <td class="amt">{{ r.discount | indianNumber }}</td>
                          <td class="amt">{{ r.cash | indianNumber }}</td>
                          <td class="amt">{{ r.bank | indianNumber }}</td>
                        </tr>
                      } @empty {
                        <tr><td colspan="6" class="text-center text-muted py-3">No payments.</td></tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr class="total-row">
                        <td colspan="3" class="text-end">Total</td>
                        <td class="amt">{{ paymentTotals().discount | indianNumber }}</td>
                        <td class="amt">{{ paymentTotals().cash | indianNumber }}</td>
                        <td class="amt">{{ paymentTotals().bank | indianNumber }}</td>
                      </tr>
                      <tr class="total-row"><td colspan="6" class="text-center text-muted">&nbsp;</td></tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <p class="small text-muted mt-2">
                Closing balance = Receipts − Payments &nbsp;·&nbsp;
                Cash {{ closing().cash | indianNumber }} &nbsp;|&nbsp; Bank {{ closing().bank | indianNumber }}
              </p>
            }

            <!-- ═══════════ FINANCE BOOK ═══════════ -->
            @case ('finance') {
              @if (loan(); as ln) {
                <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                  <h2 class="h6 display mb-0">Finance Book</h2>
                  @if (books.loans().length > 1) {
                    <select class="form-select form-select-sm ms-2" style="width:auto"
                            [value]="selectedLoanId()" (change)="selectedLoanId.set($any($event.target).value)">
                      @for (l of books.loans(); track l.id) {<option [value]="l.id">{{ l.lender }}</option>}
                    </select>
                  }
                </div>

                <!-- Summary cards -->
                <div class="row g-3 mb-4">
                  <div class="col-6 col-lg-3">
                    <div class="p-3 rounded bg-soft-primary h-100">
                      <div class="small text-secondary">Loan Principal</div>
                      <div class="h5 mono mb-0">₹{{ ln.principal | indianNumber: 0 }}</div>
                      <div class="small text-muted">{{ ln.annualRate }}% p.a. · {{ ln.tenureMonths }} months</div>
                    </div>
                  </div>
                  <div class="col-6 col-lg-3">
                    <div class="p-3 rounded bg-soft-accent h-100">
                      <div class="small text-secondary">Monthly EMI</div>
                      <div class="h5 mono mb-0">₹{{ summary().emi | indianNumber }}</div>
                    </div>
                  </div>
                  <div class="col-6 col-lg-3">
                    <div class="p-3 rounded bg-soft-danger h-100">
                      <div class="small text-secondary">Outstanding Balance</div>
                      <div class="h5 mono mb-0">₹{{ summary().outstanding | indianNumber }}</div>
                      <div class="small text-muted">{{ summary().paid }} / {{ ln.tenureMonths }} EMIs paid</div>
                    </div>
                  </div>
                  <div class="col-6 col-lg-3">
                    <div class="p-3 rounded bg-soft-success h-100">
                      <div class="small text-secondary">Interest Accrued</div>
                      <div class="h5 mono mb-0">₹{{ summary().interestAccrued | indianNumber }}</div>
                      <div class="small text-muted">Total interest ₹{{ summary().totalInterest | indianNumber: 0 }}</div>
                    </div>
                  </div>
                </div>

                <h3 class="h6 mb-2">Repayment Schedule (EMI)</h3>
                <div class="table-responsive">
                  <table class="table table-bordered table-sm align-middle">
                    <thead class="table-light">
                      <tr>
                        <th>#</th><th>Due Date</th><th class="text-end">Opening Bal.</th><th class="text-end">EMI</th>
                        <th class="text-end">Interest</th><th class="text-end">Principal</th><th class="text-end">Closing Bal.</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of schedule(); track row.no) {
                        <tr [class.table-active]="row.no <= summary().paid">
                          <td>{{ row.no }}</td>
                          <td>{{ row.dueDate | date: 'dd/MM/yyyy' }}</td>
                          <td class="amt">{{ row.openingBalance | indianNumber }}</td>
                          <td class="amt">{{ row.emi | indianNumber }}</td>
                          <td class="amt">{{ row.interest | indianNumber }}</td>
                          <td class="amt">{{ row.principal | indianNumber }}</td>
                          <td class="amt">{{ row.closingBalance | indianNumber }}</td>
                        </tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr class="total-row">
                        <td colspan="3" class="text-end">Total</td>
                        <td class="amt">{{ summary().totalPayable | indianNumber }}</td>
                        <td class="amt">{{ summary().totalInterest | indianNumber }}</td>
                        <td class="amt" colspan="2">{{ ln.principal | indianNumber }}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              } @else {
                <div class="text-center text-muted py-5">
                  <i class="bi bi-bank fs-1 d-block mb-2"></i>No loan accounts recorded.
                </div>
              }
            }
          }
        </div>
      </div>
    </div>
  `
})
export class BooksComponent {
  readonly books = inject(BooksService);
  readonly exp = inject(ExportService);
  private readonly companies = inject(CompanyService);
  private readonly ui = inject(UiService);
  private readonly route = inject(ActivatedRoute);

  readonly tabs = TABS;
  readonly active = signal<BookTab>('purchase');
  readonly from = signal('');
  readonly to = signal('');
  readonly selectedLoanId = signal<string>('');

  @ViewChild('exportArea') exportArea?: ElementRef<HTMLElement>;

  readonly company = computed(() => this.companies.activeCompany()?.name ?? '');

  // ── Purchase ──
  readonly purchaseRows = computed<PurchaseRow[]>(() => {
    let running = 0;
    return this.books.filterPurchases(this.from(), this.to()).map((e) => {
      const net = e.amount + e.gst;
      running += net;
      return { ...e, net, running };
    });
  });
  readonly purchaseTotals = computed(() =>
    this.purchaseRows().reduce(
      (a, r) => ({ amount: a.amount + r.amount, gst: a.gst + r.gst, net: a.net + r.net }),
      { amount: 0, gst: 0, net: 0 }
    )
  );

  // ── Sales ──
  readonly salesRows = computed<SalesRow[]>(() => {
    let running = 0;
    return this.books.filterSales(this.from(), this.to()).map((e) => {
      const net = e.amount + e.gst;
      running += net;
      return { ...e, net, running };
    });
  });
  readonly salesTotals = computed(() =>
    this.salesRows().reduce(
      (a, r) => ({ amount: a.amount + r.amount, gst: a.gst + r.gst, net: a.net + r.net }),
      { amount: 0, gst: 0, net: 0 }
    )
  );

  // ── Cash ──
  private readonly cashRows = computed(() => this.books.filterCash(this.from(), this.to()));
  readonly receipts = computed(() => this.cashRows().filter((r) => r.side === 'Receipt'));
  readonly payments = computed(() => this.cashRows().filter((r) => r.side === 'Payment'));
  readonly receiptTotals = computed(() => this.sumCash(this.receipts()));
  readonly paymentTotals = computed(() => this.sumCash(this.payments()));
  readonly closing = computed(() => ({
    cash: this.receiptTotals().cash - this.paymentTotals().cash,
    bank: this.receiptTotals().bank - this.paymentTotals().bank
  }));

  // ── Finance ──
  readonly loan = computed<Loan | undefined>(() => {
    const list = this.books.loans();
    return list.find((l) => l.id === this.selectedLoanId()) ?? list[0];
  });
  readonly schedule = computed<EmiRow[]>(() => {
    const ln = this.loan();
    return ln ? this.books.schedule(ln) : [];
  });
  readonly summary = computed<FinanceSummary>(() => {
    const ln = this.loan();
    const rows = this.schedule();
    if (!ln || rows.length === 0) {
      return { emi: 0, totalInterest: 0, totalPayable: 0, outstanding: 0, interestAccrued: 0, paid: 0 };
    }
    const paid = this.books.elapsedCount(ln);
    const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
    const interestAccrued = rows.slice(0, paid).reduce((s, r) => s + r.interest, 0);
    const outstanding = paid > 0 ? rows[Math.min(paid, rows.length) - 1].closingBalance : ln.principal;
    return {
      emi: this.books.emiOf(ln),
      totalInterest,
      totalPayable: ln.principal + totalInterest,
      outstanding,
      interestAccrued,
      paid
    };
  });

  constructor() {
    this.books.sync();
    const book = this.route.snapshot.paramMap.get('book') as BookTab | null;
    if (book && TABS.some((t) => t.key === book)) {
      this.active.set(book);
    }
    this.selectedLoanId.set(this.books.loans()[0]?.id ?? '');
  }

  private sumCash(rows: CashEntry[]): CashTotals {
    return rows.reduce(
      (a, r) => ({ discount: a.discount + r.discount, cash: a.cash + r.cash, bank: a.bank + r.bank }),
      { discount: 0, cash: 0, bank: 0 }
    );
  }

  // ── Exports ──
  private fileName(): string {
    return `${this.company() || 'ledgerai'}-${this.active()}-book`.replace(/\s+/g, '_');
  }

  async exportPdf(): Promise<void> {
    if (this.exportArea) {
      await this.exp.toPdf(this.exportArea.nativeElement, this.fileName());
      this.ui.toast('PDF downloaded.', 'success');
    }
  }

  exportExcel(): void {
    let rows: Record<string, unknown>[] = [];
    switch (this.active()) {
      case 'purchase':
        rows = this.purchaseRows().map((r) => ({
          Date: this.short(r.date), 'Invoice No': r.invoiceNo, Supplier: r.supplierName,
          Ledger: r.ledgerName, 'Inward No': r.inwardNo, 'Amount (Dr)': r.amount, GST: r.gst, 'Net Amount': r.net
        }));
        break;
      case 'sales':
        rows = this.salesRows().map((r) => ({
          Date: this.short(r.date), 'Invoice No': r.invoiceNo, Customer: r.customerName,
          Ledger: r.ledgerName, 'Outward No': r.outwardNo, 'Amount (Cr)': r.amount, GST: r.gst, 'Net Amount': r.net
        }));
        break;
      case 'cash':
        rows = this.cashRows().map((r) => ({
          Date: this.short(r.date), Type: r.side, Particulars: r.particulars, Folio: r.folio,
          Discount: r.discount, Cash: r.cash, Bank: r.bank
        }));
        break;
      case 'finance':
        rows = this.schedule().map((r) => ({
          'EMI No': r.no, 'Due Date': this.short(r.dueDate), 'Opening Balance': Math.round(r.openingBalance),
          EMI: Math.round(r.emi), Interest: Math.round(r.interest), Principal: Math.round(r.principal),
          'Closing Balance': Math.round(r.closingBalance)
        }));
        break;
    }
    if (rows.length === 0) {
      this.ui.toast('Nothing to export for this view.', 'warning');
      return;
    }
    this.exp.toExcel(rows, this.fileName(), this.active());
    this.ui.toast('Excel downloaded.', 'success');
  }

  private short(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
}
