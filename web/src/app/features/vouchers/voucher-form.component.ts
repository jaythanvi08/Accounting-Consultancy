import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CompanyService } from '../../core/services/company.service';
import { LedgerService } from '../../core/services/ledger.service';
import { VoucherService } from '../../core/services/voucher.service';
import { ExportService } from '../../core/services/export.service';
import { UiService } from '../../core/services/ui.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import {
  AccountNature,
  GOLDEN_RULES,
  VOUCHER_META,
  VOUCHER_TYPES,
  accountNatureOf
} from '../../core/constants/vouchers';
import { VoucherLine, VoucherType } from '../../core/models';

interface RowGroup {
  ledgerName: FormControl<string>;
  debit: FormControl<number>;
  credit: FormControl<number>;
}

@Component({
  selector: 'app-voucher-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, IndianNumberPipe],
  styles: [
    `
      .vno { font-family: var(--font-mono); font-weight: 700; color: var(--accent); }
      .rule-legend { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
      .rule-card { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.6rem 0.75rem; font-size: 0.8rem; }
      .rule-card h6 { margin: 0 0 0.25rem; font-size: 0.82rem; }
      .entry-table .amt { text-align: right; font-family: var(--font-mono); }
      .entry-table input.amt { text-align: right; }
      .balance-chip { font-family: var(--font-heading); font-weight: 700; padding: 0.4rem 0.9rem; border-radius: 999px; }
      .balance-ok { background: rgba(26, 122, 74, 0.12); color: var(--success); }
      .balance-bad { background: rgba(178, 34, 34, 0.12); color: var(--danger); }
      .nat-Personal { background: rgba(46, 95, 138, 0.12); color: var(--info); }
      .nat-Real { background: rgba(200, 134, 10, 0.15); color: var(--accent); }
      .nat-Nominal { background: rgba(26, 122, 74, 0.12); color: var(--success); }
      .modal-backdrop-c { position: fixed; inset: 0; background: rgba(15, 34, 56, 0.45); display: grid; place-items: center; z-index: 1060; padding: 1rem; }
      .modal-card { background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; max-width: 560px; }
      @media (max-width: 640px) { .rule-legend { grid-template-columns: 1fr; } }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header [title]="meta().label" [subtitle]="meta().hint" [icon]="meta().icon">
        <a routerLink="/app/vouchers/list" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-list-ul me-1"></i>All Vouchers
        </a>
      </app-page-header>

      <!-- Golden Rules reminder -->
      <div class="rule-legend mb-3">
        @for (n of natures; track n) {
          <div class="rule-card">
            <h6><span class="badge nat-{{ n }}">{{ n }}</span> Account</h6>
            <div><strong>Dr:</strong> {{ rules[n].dr }}</div>
            <div><strong>Cr:</strong> {{ rules[n].cr }}</div>
          </div>
        }
      </div>

      <form [formGroup]="form" (ngSubmit)="save(false)" novalidate>
        <section class="card mb-3">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-3">
                <label class="form-label">Voucher No.</label>
                <input class="form-control vno" [value]="voucherNo()" readonly />
              </div>
              <div class="col-md-3">
                <label class="form-label">Date<span class="required-mark">*</span></label>
                <input type="date" class="form-control" formControlName="date" [class.is-invalid]="invalid('date')" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Reference</label>
                <input class="form-control" formControlName="reference" placeholder="Bill / cheque / ref no. (optional)" />
              </div>
              <div class="col-12">
                <label class="form-label">Narration<span class="required-mark">*</span></label>
                <input class="form-control" formControlName="narration"
                       placeholder="Being… (description of the transaction)" [class.is-invalid]="invalid('narration')" />
                @if (invalid('narration')) {<div class="invalid-feedback d-block">Narration is required.</div>}
              </div>
            </div>
          </div>
        </section>

        <!-- Entry rows -->
        <section class="card mb-3">
          <div class="card-header"><i class="bi bi-table me-2 text-accent"></i>Entries</div>
          <div class="card-body">
            <div class="table-responsive">
              <table class="table table-bordered align-middle entry-table mb-0">
                <thead class="table-light">
                  <tr>
                    <th style="width:50%">Particular (Ledger)</th>
                    <th class="text-end" style="width:20%">Dr Amount</th>
                    <th class="text-end" style="width:20%">Cr Amount</th>
                    <th style="width:10%"></th>
                  </tr>
                </thead>
                <tbody formArrayName="rows">
                  @for (row of rows.controls; track $index) {
                    <tr [formGroupName]="$index">
                      <td>
                        @let nat = natureOf(row.controls.ledgerName.value);
                        <input class="form-control form-control-sm" formControlName="ledgerName"
                               list="ledgerListVoucher" placeholder="Search ledger…" />
                        @if (nat) {
                          <small class="badge nat-{{ nat }} mt-1">{{ nat }} A/c · Dr: {{ rules[nat].dr }}</small>
                        }
                      </td>
                      <td><input type="number" min="0" step="0.01" class="form-control form-control-sm amt"
                                 formControlName="debit" (input)="onDebit($index)" /></td>
                      <td><input type="number" min="0" step="0.01" class="form-control form-control-sm amt"
                                 formControlName="credit" (input)="onCredit($index)" /></td>
                      <td class="text-center">
                        <button type="button" class="btn btn-sm btn-outline-danger py-0"
                                [disabled]="rows.length <= 2" (click)="removeRow($index)"><i class="bi bi-x-lg"></i></button>
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td><button type="button" class="btn btn-sm btn-outline-primary" (click)="addRow()">
                      <i class="bi bi-plus-lg me-1"></i>Add Row</button></td>
                    <td class="amt fw-bold">{{ totals().dr | indianNumber }}</td>
                    <td class="amt fw-bold">{{ totals().cr | indianNumber }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <datalist id="ledgerListVoucher">
              @for (l of ledgers.ledgers(); track l.id) {<option [value]="l.name"></option>}
            </datalist>

            <div class="mt-3">
              @if (totals().balanced) {
                <span class="balance-chip balance-ok"><i class="bi bi-check-circle-fill me-1"></i>BALANCED</span>
              } @else {
                <span class="balance-chip balance-bad">
                  <i class="bi bi-exclamation-triangle-fill me-1"></i>Difference: ₹{{ totals().diff | indianNumber }}
                </span>
              }
            </div>
          </div>
        </section>

        <div class="d-flex flex-wrap gap-2 no-print">
          <button type="submit" class="btn btn-primary"><i class="bi bi-check2-circle me-1"></i>{{ editId() ? 'Update' : 'Save' }} Voucher</button>
          @if (!editId()) {
            <button type="button" class="btn btn-outline-primary" (click)="save(true)"><i class="bi bi-plus-circle me-1"></i>Save &amp; New</button>
          }
          <button type="button" class="btn btn-outline-secondary" (click)="openPreview()"><i class="bi bi-eye me-1"></i>Preview</button>
          <button type="button" class="btn btn-outline-danger ms-auto" (click)="discard()"><i class="bi bi-trash me-1"></i>Discard</button>
        </div>
      </form>
    </div>

    <!-- Preview modal -->
    @if (showPreview()) {
      <div class="modal-backdrop-c" (click)="showPreview.set(false)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span><i class="bi bi-journal-check me-2 text-accent"></i>{{ meta().label }} — {{ voucherNo() }}</span>
            <button type="button" class="btn-close" (click)="showPreview.set(false)"></button>
          </div>
          <div class="card-body" id="voucher-preview">
            <div class="d-flex justify-content-between small text-muted mb-2">
              <span>{{ company() }}</span><span>Date: {{ form.controls.date.value }}</span>
            </div>
            <table class="table table-sm mb-2">
              <thead class="table-light"><tr><th>Particulars</th><th class="text-end">Dr (₹)</th><th class="text-end">Cr (₹)</th></tr></thead>
              <tbody>
                @for (ln of preview().lines; track $index) {
                  <tr>
                    <td [style.padding-left.px]="ln.type === 'Cr' ? 28 : 8">{{ ln.type === 'Cr' ? 'To ' : '' }}{{ ln.ledgerName }} A/c{{ ln.type === 'Dr' ? ' Dr' : '' }}</td>
                    <td class="text-end mono">{{ ln.type === 'Dr' ? (ln.amount | indianNumber) : '' }}</td>
                    <td class="text-end mono">{{ ln.type === 'Cr' ? (ln.amount | indianNumber) : '' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot><tr class="fw-bold"><td class="text-end">Total</td>
                <td class="text-end mono">{{ preview().dr | indianNumber }}</td>
                <td class="text-end mono">{{ preview().cr | indianNumber }}</td></tr></tfoot>
            </table>
            <p class="small mb-0"><strong>Narration:</strong> {{ form.controls.narration.value || '—' }}</p>
          </div>
          <div class="card-footer d-flex justify-content-end gap-2 no-print">
            <button class="btn btn-outline-secondary btn-sm" (click)="exp.print()"><i class="bi bi-printer me-1"></i>Print</button>
            <button class="btn btn-primary btn-sm" (click)="showPreview.set(false)">Close</button>
          </div>
        </div>
      </div>
    }
  `
})
export class VoucherFormComponent {
  private readonly fb = inject(FormBuilder);
  readonly ledgers = inject(LedgerService);
  private readonly vouchers = inject(VoucherService);
  readonly exp = inject(ExportService);
  private readonly companies = inject(CompanyService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly natures: ReadonlyArray<AccountNature> = ['Personal', 'Real', 'Nominal'];
  readonly rules = GOLDEN_RULES;

  readonly type = signal<VoucherType>('Journal');
  readonly voucherNo = signal('');
  readonly editId = signal<string | null>(null);
  readonly showPreview = signal(false);

  readonly meta = computed(() => VOUCHER_META[this.type()]);
  readonly company = computed(() => this.companies.activeCompany()?.name ?? '');

  readonly form = this.fb.nonNullable.group({
    date: [new Date().toISOString().slice(0, 10), [Validators.required]],
    reference: [''],
    narration: ['', [Validators.required]],
    rows: this.fb.nonNullable.array<FormGroup<RowGroup>>([this.newRow(), this.newRow()])
  });

  private readonly fv = toSignal(this.form.valueChanges);

  readonly totals = computed(() => {
    this.fv(); // re-compute on any form change
    let dr = 0;
    let cr = 0;
    for (const c of this.rows.controls) {
      dr += c.controls.debit.value || 0;
      cr += c.controls.credit.value || 0;
    }
    return { dr, cr, diff: Math.abs(dr - cr), balanced: dr > 0 && Math.abs(dr - cr) < 0.005 };
  });

  readonly preview = computed(() => {
    this.fv();
    const lines: VoucherLine[] = [];
    let dr = 0;
    let cr = 0;
    for (const c of this.rows.controls) {
      const name = c.controls.ledgerName.value.trim();
      const d = c.controls.debit.value || 0;
      const cV = c.controls.credit.value || 0;
      if (!name) {
        continue;
      }
      if (d > 0) {
        lines.push({ ledgerId: '', ledgerName: name, type: 'Dr', amount: d });
        dr += d;
      } else if (cV > 0) {
        lines.push({ ledgerId: '', ledgerName: name, type: 'Cr', amount: cV });
        cr += cV;
      }
    }
    lines.sort((a, b) => (a.type === b.type ? 0 : a.type === 'Dr' ? -1 : 1));
    return { lines, dr, cr };
  });

  constructor() {
    this.ledgers.sync();
    this.vouchers.sync();

    const t = this.route.snapshot.paramMap.get('type');
    const matched = VOUCHER_TYPES.find((vt) => vt.toLowerCase() === (t ?? '').toLowerCase());
    if (matched) {
      this.type.set(matched);
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const v = this.vouchers.getById(id);
      if (v) {
        this.editId.set(id);
        this.type.set(v.voucherType);
        this.voucherNo.set(v.voucherNo);
        this.rows.clear();
        for (const ln of v.lines) {
          this.rows.push(this.newRow(ln.ledgerName, ln.type === 'Dr' ? ln.amount : 0, ln.type === 'Cr' ? ln.amount : 0));
        }
        while (this.rows.length < 2) {
          this.rows.push(this.newRow());
        }
        this.form.patchValue({ date: v.date.slice(0, 10), reference: v.reference ?? '', narration: v.narration ?? '' });
      }
    } else {
      this.voucherNo.set(this.vouchers.nextVoucherNo(this.type()));
    }
  }

  private newRow(ledgerName = '', debit = 0, credit = 0): FormGroup<RowGroup> {
    return this.fb.nonNullable.group({
      ledgerName: [ledgerName],
      debit: [debit],
      credit: [credit]
    });
  }

  get rows(): FormArray<FormGroup<RowGroup>> {
    return this.form.controls.rows;
  }

  addRow(): void {
    this.rows.push(this.newRow());
  }
  removeRow(i: number): void {
    if (this.rows.length > 2) {
      this.rows.removeAt(i);
    }
  }
  onDebit(i: number): void {
    const r = this.rows.at(i);
    if ((r.controls.debit.value || 0) > 0 && (r.controls.credit.value || 0) > 0) {
      r.controls.credit.setValue(0);
    }
  }
  onCredit(i: number): void {
    const r = this.rows.at(i);
    if ((r.controls.credit.value || 0) > 0 && (r.controls.debit.value || 0) > 0) {
      r.controls.debit.setValue(0);
    }
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  natureOf(name: string): AccountNature | null {
    const ledger = this.ledgers.ledgers().find((l) => l.name.toLowerCase() === name.trim().toLowerCase());
    if (!ledger) {
      return null;
    }
    const type = this.ledgers.getGroup(ledger.groupId)?.type;
    return type ? accountNatureOf(type) : null;
  }

  openPreview(): void {
    this.showPreview.set(true);
  }

  save(another: boolean): void {
    if (this.form.controls.date.invalid || this.form.controls.narration.invalid) {
      this.form.markAllAsTouched();
      this.ui.toast('Date and narration are required.', 'warning');
      return;
    }

    const lines: VoucherLine[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const c of this.rows.controls) {
      const name = c.controls.ledgerName.value.trim();
      const d = c.controls.debit.value || 0;
      const cr = c.controls.credit.value || 0;
      if (!name && d === 0 && cr === 0) {
        continue; // blank row — ignore
      }
      if (!name) {
        this.ui.toast('Every entry row needs a ledger.', 'danger');
        return;
      }
      const ledger = this.ledgers.ledgers().find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (!ledger) {
        this.ui.toast(`Ledger “${name}” not found. Create it first.`, 'danger');
        return;
      }
      if (d > 0 && cr > 0) {
        this.ui.toast('A row cannot have both Dr and Cr amounts.', 'danger');
        return;
      }
      if (d <= 0 && cr <= 0) {
        this.ui.toast(`Enter a Dr or Cr amount for “${name}”.`, 'danger');
        return;
      }
      lines.push({
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        type: d > 0 ? 'Dr' : 'Cr',
        amount: d > 0 ? d : cr
      });
      totalDebit += d;
      totalCredit += cr;
    }

    if (lines.length < 2) {
      this.ui.toast('A voucher needs at least two entries.', 'warning');
      return;
    }
    if (Math.abs(totalDebit - totalCredit) >= 0.005 || totalDebit === 0) {
      this.ui.toast('Total Debit must equal Total Credit.', 'danger');
      return;
    }

    const v = this.form.getRawValue();
    const data = {
      voucherType: this.type(),
      voucherNo: this.voucherNo(),
      date: new Date(v.date).toISOString(),
      reference: v.reference || undefined,
      narration: v.narration,
      lines,
      totalDebit,
      totalCredit
    };

    const id = this.editId();
    if (id) {
      this.vouchers.update(id, data);
      this.ui.toast(`Voucher ${data.voucherNo} updated.`, 'success');
      this.router.navigateByUrl('/app/vouchers/list');
      return;
    }

    const created = this.vouchers.create(data);
    this.ui.toast(`Voucher ${created.voucherNo} saved.`, 'success');
    if (another) {
      this.resetForNew();
    } else {
      this.router.navigateByUrl('/app/vouchers/list');
    }
  }

  private resetForNew(): void {
    this.rows.clear();
    this.rows.push(this.newRow());
    this.rows.push(this.newRow());
    this.form.reset({ date: new Date().toISOString().slice(0, 10), reference: '', narration: '' });
    this.voucherNo.set(this.vouchers.nextVoucherNo(this.type()));
  }

  discard(): void {
    if (confirm('Discard this voucher? Unsaved entries will be lost.')) {
      this.router.navigateByUrl('/app/vouchers/list');
    }
  }
}
