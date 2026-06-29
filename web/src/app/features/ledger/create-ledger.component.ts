import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LedgerService } from '../../core/services/ledger.service';
import { UiService } from '../../core/services/ui.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { UpperCaseDirective } from '../../shared/directives/upper-case.directive';
import { gstinValidator } from '../../shared/validators/statutory.validators';
import { LEDGER_CATEGORIES, categoryOf } from '../../core/constants/account-groups';
import { AccountGroup, BalanceNature } from '../../core/models';

interface GroupOption {
  category: string;
  groups: AccountGroup[];
}

@Component({
  selector: 'app-create-ledger',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, UpperCaseDirective],
  template: `
    <div class="fade-in">
      <app-page-header
        [title]="editId() ? 'Edit Ledger' : 'Create Ledger'"
        subtitle="Add an account head and its opening balance"
        icon="bi-journal-plus"
      >
        <a routerLink="/app/ledger/list" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-list-ul me-1"></i>All Ledgers
        </a>
      </app-page-header>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <section class="card mb-4" style="max-width: 760px">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-7">
                <label class="form-label">Ledger Name<span class="required-mark">*</span></label>
                <input class="form-control" formControlName="name"
                       placeholder="e.g. Rent Expense, State Bank of India, Ramesh & Co."
                       [class.is-invalid]="invalid('name')" />
                @if (invalid('name')) {<div class="invalid-feedback d-block">Ledger name is required.</div>}
              </div>
              <div class="col-md-5">
                <label class="form-label">Ledger Group<span class="required-mark">*</span></label>
                <select class="form-select" formControlName="groupId" (change)="onGroupChange()"
                        [class.is-invalid]="invalid('groupId')">
                  <option value="" disabled>Select group…</option>
                  @for (opt of groupOptions(); track opt.category) {
                    <optgroup [label]="opt.category">
                      @for (g of opt.groups; track g.id) {<option [value]="g.id">{{ g.name }}</option>}
                    </optgroup>
                  }
                </select>
                @if (invalid('groupId')) {<div class="invalid-feedback d-block">Select a group.</div>}
              </div>

              <div class="col-md-5">
                <label class="form-label">Opening Balance</label>
                <input type="number" step="0.01" min="0" class="form-control mono" formControlName="openingBalance" />
              </div>
              <div class="col-md-7">
                <label class="form-label d-block">Balance Type</label>
                <div class="d-flex gap-4 pt-1">
                  <label class="d-inline-flex align-items-center gap-2">
                    <input class="form-check-input mt-0" type="radio" formControlName="openingNature" value="Dr" /> Debit (Dr)
                  </label>
                  <label class="d-inline-flex align-items-center gap-2">
                    <input class="form-check-input mt-0" type="radio" formControlName="openingNature" value="Cr" /> Credit (Cr)
                  </label>
                </div>
              </div>

              <div class="col-md-5">
                <label class="form-label d-block">GST Applicable</label>
                <div class="d-flex gap-4 pt-1">
                  <label class="d-inline-flex align-items-center gap-2">
                    <input class="form-check-input mt-0" type="radio" formControlName="gstApplicable" [value]="true" /> Yes
                  </label>
                  <label class="d-inline-flex align-items-center gap-2">
                    <input class="form-check-input mt-0" type="radio" formControlName="gstApplicable" [value]="false" /> No
                  </label>
                </div>
              </div>
              @if (form.controls.gstApplicable.value) {
                <div class="col-md-7">
                  <label class="form-label">GSTIN<span class="required-mark">*</span></label>
                  <input class="form-control text-uppercase" formControlName="gstin" appUpperCase maxlength="15"
                         placeholder="22AAAAA9999A1Z5" [class.is-invalid]="invalid('gstin')" />
                  @if (invalid('gstin')) {<div class="invalid-feedback d-block">Enter a valid 15-char GSTIN.</div>}
                </div>
              }

              <div class="col-12">
                <label class="form-label">Description / Notes</label>
                <textarea class="form-control" rows="2" formControlName="notes"></textarea>
              </div>
            </div>
          </div>
        </section>

        <div class="d-flex gap-2 no-print" style="max-width: 760px">
          <button type="submit" class="btn btn-primary px-4">
            <i class="bi bi-check2-circle me-1"></i>{{ editId() ? 'Update Ledger' : 'Create Ledger' }}
          </button>
          <a routerLink="/app/ledger/list" class="btn btn-outline-secondary">Cancel</a>
        </div>
      </form>
    </div>
  `
})
export class CreateLedgerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ledgers = inject(LedgerService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editId = signal<string | null>(null);

  readonly groupOptions = computed<GroupOption[]>(() => {
    const all = this.ledgers.groups();
    return LEDGER_CATEGORIES.map((c) => ({
      category: c.label,
      groups: all.filter((g) => categoryOf(g.type) === c.key)
    })).filter((o) => o.groups.length > 0);
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    groupId: ['', [Validators.required]],
    openingBalance: [0, [Validators.min(0)]],
    openingNature: ['Dr' as BalanceNature, [Validators.required]],
    gstApplicable: [false],
    gstin: ['', [gstinValidator()]],
    notes: ['']
  });

  constructor() {
    this.ledgers.sync();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const l = this.ledgers.getLedger(id);
      if (l) {
        this.editId.set(id);
        this.form.patchValue({
          name: l.name,
          groupId: l.groupId,
          openingBalance: l.openingBalance,
          openingNature: l.openingNature,
          gstApplicable: !!l.gstin,
          gstin: l.gstin ?? '',
          notes: l.notes ?? ''
        });
      }
    }
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  /** Default the balance side to the group's natural nature. */
  onGroupChange(): void {
    const g = this.ledgers.getGroup(this.form.controls.groupId.value);
    if (g) {
      this.form.controls.openingNature.setValue(g.nature);
    }
  }

  submit(): void {
    if (this.form.controls.gstApplicable.value) {
      this.form.controls.gstin.addValidators(Validators.required);
    } else {
      this.form.controls.gstin.removeValidators(Validators.required);
    }
    this.form.controls.gstin.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.ui.toast('Please complete the required fields.', 'warning');
      return;
    }

    const v = this.form.getRawValue();
    const payload = {
      name: v.name.trim(),
      groupId: v.groupId,
      openingBalance: Number(v.openingBalance) || 0,
      openingNature: v.openingNature,
      gstin: v.gstApplicable ? v.gstin.toUpperCase() : undefined,
      notes: v.notes || undefined
    };

    const id = this.editId();
    if (id) {
      this.ledgers.updateLedger(id, payload);
      this.ui.toast(`Ledger “${payload.name}” updated successfully.`, 'success');
    } else {
      const created = this.ledgers.createLedger(payload);
      this.ui.toast(`Ledger “${created.name}” created successfully.`, 'success');
    }
    this.router.navigateByUrl('/app/ledger/list');
  }
}
