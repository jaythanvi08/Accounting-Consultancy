import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AssetService } from '../../core/services/asset.service';
import { LedgerService } from '../../core/services/ledger.service';
import { UiService } from '../../core/services/ui.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ASSET_TYPES, isDepreciable } from '../../core/constants/assets';
import { AssetType, DepreciationMethod } from '../../core/models';

@Component({
  selector: 'app-create-asset',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, DecimalPipe],
  template: `
    <div class="fade-in">
      <app-page-header
        [title]="editId() ? 'Edit Asset Account' : 'Create Asset Account'"
        subtitle="Fixed assets & depreciation (SLM / WDV)"
        icon="bi-building-gear"
      >
        <a routerLink="/app/accounts" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-list-ul me-1"></i>Asset Register
        </a>
      </app-page-header>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <section class="card mb-4" style="max-width: 880px">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Asset Name<span class="required-mark">*</span></label>
                <input class="form-control" formControlName="name" placeholder="e.g. CNC Lathe Machine #2"
                       [class.is-invalid]="invalid('name')" />
                @if (invalid('name')) {<div class="invalid-feedback d-block">Asset name is required.</div>}
              </div>
              <div class="col-md-6">
                <label class="form-label">Asset Type<span class="required-mark">*</span></label>
                <select class="form-select" formControlName="type" (change)="onTypeChange()" [class.is-invalid]="invalid('type')">
                  <option value="" disabled>Select type…</option>
                  @for (t of assetTypes; track t) {<option [value]="t">{{ t }}</option>}
                </select>
                @if (invalid('type')) {<div class="invalid-feedback d-block">Select an asset type.</div>}
              </div>

              <div class="col-md-4">
                <label class="form-label">Purchase Date<span class="required-mark">*</span></label>
                <input type="date" class="form-control" formControlName="purchaseDate" [class.is-invalid]="invalid('purchaseDate')" />
                @if (invalid('purchaseDate')) {<div class="invalid-feedback d-block">Required.</div>}
              </div>
              <div class="col-md-4">
                <label class="form-label">Purchase Amount (₹)<span class="required-mark">*</span></label>
                <input type="number" min="0" step="0.01" class="form-control mono" formControlName="cost" [class.is-invalid]="invalid('cost')" />
                @if (invalid('cost')) {<div class="invalid-feedback d-block">Enter the cost.</div>}
              </div>
              <div class="col-md-4">
                <label class="form-label">GST Paid (₹)</label>
                <input type="number" min="0" step="0.01" class="form-control mono" formControlName="gstPaid" />
              </div>

              @if (depreciable()) {
                <div class="col-md-4">
                  <label class="form-label">Depreciation Method<span class="required-mark">*</span></label>
                  <select class="form-select" formControlName="method">
                    <option value="SLM">Straight Line (SLM)</option>
                    <option value="WDV">Written Down Value (WDV)</option>
                  </select>
                  <small class="text-muted">
                    @if (form.controls.method.value === 'SLM') { Annual = (Cost − Residual) ÷ Useful Life }
                    @else { Annual = Opening Value × Rate% }
                  </small>
                </div>
                <div class="col-md-4">
                  <label class="form-label">Useful Life (years)<span class="required-mark">*</span></label>
                  <input type="number" min="1" class="form-control" formControlName="usefulLife" [class.is-invalid]="invalid('usefulLife')" />
                  @if (invalid('usefulLife')) {<div class="invalid-feedback d-block">Required.</div>}
                </div>
                <div class="col-md-4">
                  <label class="form-label">
                    Depreciation Rate %@if (form.controls.method.value === 'WDV') {<span class="required-mark">*</span>}
                  </label>
                  <input type="number" min="0" step="0.01" class="form-control mono" formControlName="rate" [class.is-invalid]="invalid('rate')" />
                  @if (invalid('rate')) {<div class="invalid-feedback d-block">Rate is required for WDV.</div>}
                </div>
                <div class="col-md-4">
                  <label class="form-label">Residual / Scrap Value (₹)</label>
                  <input type="number" min="0" step="0.01" class="form-control mono" formControlName="residualValue" />
                </div>
              } @else {
                <div class="col-12">
                  <div class="alert alert-info py-2 mb-0"><i class="bi bi-info-circle me-1"></i>
                    Land is a non-depreciable asset — no depreciation will be charged.
                  </div>
                </div>
              }

              <div class="col-md-6">
                <label class="form-label">Supplier / Vendor Ledger</label>
                <input class="form-control" formControlName="vendorLedger" list="vendorLedgers" placeholder="Search ledger…" />
                <datalist id="vendorLedgers">
                  @for (l of ledgers.ledgers(); track l.id) {<option [value]="l.name"></option>}
                </datalist>
              </div>

              @if (depreciable() && form.controls.cost.value > 0) {
                <div class="col-12">
                  <div class="p-2 rounded bg-soft-accent small">
                    <i class="bi bi-calculator me-1 text-accent"></i>
                    Estimated first-year depreciation: <strong>₹{{ firstYearDep() | number: '1.2-2' }}</strong>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>

        <div class="d-flex gap-2" style="max-width: 880px">
          <button type="submit" class="btn btn-primary px-4">
            <i class="bi bi-check2-circle me-1"></i>{{ editId() ? 'Update Asset' : 'Create Asset' }}
          </button>
          <a routerLink="/app/accounts" class="btn btn-outline-secondary">Cancel</a>
        </div>
      </form>
    </div>
  `
})
export class CreateAssetComponent {
  private readonly fb = inject(FormBuilder);
  private readonly assets = inject(AssetService);
  readonly ledgers = inject(LedgerService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly assetTypes = ASSET_TYPES;
  readonly editId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: ['' as AssetType | '', [Validators.required]],
    purchaseDate: ['', [Validators.required]],
    cost: [0, [Validators.required, Validators.min(1)]],
    method: ['SLM' as DepreciationMethod, [Validators.required]],
    usefulLife: [5, [Validators.min(1)]],
    rate: [0, []],
    residualValue: [0, []],
    gstPaid: [0, []],
    vendorLedger: ['']
  });

  readonly depreciable = computed(() => {
    const t = this.form.controls.type.value;
    return t === '' || isDepreciable(t);
  });

  readonly firstYearDep = computed(() => {
    const v = this.form.getRawValue();
    if (v.type === 'Land' || v.cost <= 0) {
      return 0;
    }
    return v.method === 'SLM'
      ? Math.max(0, (v.cost - (v.residualValue || 0)) / Math.max(1, v.usefulLife))
      : (v.cost * (v.rate || 0)) / 100;
  });

  // recompute on form changes for OnPush
  private readonly fv = this.form.valueChanges;

  constructor() {
    this.assets.sync();
    this.ledgers.sync();
    // touch valueChanges so computed-driven hints refresh under OnPush
    this.fv.subscribe(() => undefined);

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const a = this.assets.getById(id);
      if (a) {
        this.editId.set(id);
        this.form.patchValue({
          name: a.name,
          type: a.type,
          purchaseDate: a.purchaseDate.slice(0, 10),
          cost: a.cost,
          method: a.method === 'None' ? 'SLM' : a.method,
          usefulLife: a.usefulLife,
          rate: a.rate,
          residualValue: a.residualValue,
          gstPaid: a.gstPaid ?? 0,
          vendorLedger: a.vendorLedger ?? ''
        });
      }
    }
  }

  onTypeChange(): void {
    if (this.form.controls.type.value === 'Land') {
      this.form.controls.method.setValue('None');
    } else if (this.form.controls.method.value === 'None') {
      this.form.controls.method.setValue('SLM');
    }
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  submit(): void {
    const v = this.form.getRawValue();
    const land = v.type === 'Land';

    // Conditional validators
    this.form.controls.usefulLife.setValidators(land ? [] : [Validators.required, Validators.min(1)]);
    this.form.controls.rate.setValidators(!land && v.method === 'WDV' ? [Validators.required, Validators.min(0.01)] : []);
    this.form.controls.usefulLife.updateValueAndValidity();
    this.form.controls.rate.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.ui.toast('Please complete the required fields.', 'warning');
      return;
    }

    const payload = {
      name: v.name.trim(),
      type: v.type as AssetType,
      purchaseDate: new Date(v.purchaseDate).toISOString(),
      cost: Number(v.cost),
      method: (land ? 'None' : v.method) as DepreciationMethod,
      usefulLife: land ? 0 : Number(v.usefulLife),
      rate: land ? 0 : Number(v.rate) || 0,
      residualValue: land ? 0 : Number(v.residualValue) || 0,
      gstPaid: Number(v.gstPaid) || undefined,
      vendorLedger: v.vendorLedger || undefined
    };

    const id = this.editId();
    if (id) {
      this.assets.update(id, payload);
      this.ui.toast(`Asset “${payload.name}” updated.`, 'success');
    } else {
      this.assets.create(payload);
      this.ui.toast(`Asset “${payload.name}” created.`, 'success');
    }
    this.router.navigateByUrl('/app/accounts');
  }
}
