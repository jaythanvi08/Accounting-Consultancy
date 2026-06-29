import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CompanyService } from '../../core/services/company.service';
import { UiService } from '../../core/services/ui.service';
import {
  ACCOUNTING_METHODS,
  BUSINESS_TYPES,
  CURRENCIES,
  ISD_CODES
} from '../../core/constants/currencies';
import { INDIAN_STATES } from '../../core/constants/gst-rates';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { NumberOnlyDirective } from '../../shared/directives/number-only.directive';
import { UpperCaseDirective } from '../../shared/directives/upper-case.directive';
import {
  aadhaarValidator,
  cinValidator,
  gstinValidator,
  ifscValidator,
  indianPhoneValidator,
  matchValidator,
  panValidator,
  passwordStrengthValidator,
  pincodeValidator,
  tanValidator,
  urlValidator
} from '../../shared/validators/statutory.validators';
import { AccountingMethod, BusinessType } from '../../core/models';

type FyOption = 'apr1' | 'jan1' | 'custom';
type YesNo = 'Yes' | 'No';

interface StepMeta {
  n: number;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-create-company',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeaderComponent, NumberOnlyDirective, UpperCaseDirective],
  styles: [
    `
      .wizard-steps {
        display: flex;
        list-style: none;
        margin: 0 0 1.5rem;
        padding: 0;
        counter-reset: step;
      }
      .wizard-step {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.45rem;
        position: relative;
        text-align: center;
      }
      .wizard-step::before,
      .wizard-step::after {
        content: '';
        position: absolute;
        top: 18px;
        height: 2px;
        background: var(--border);
        z-index: 0;
      }
      .wizard-step::before { left: 0; right: 50%; }
      .wizard-step::after { left: 50%; right: 0; }
      .wizard-step:first-child::before,
      .wizard-step:last-child::after { display: none; }
      .wizard-step.done::after,
      .wizard-step.done::before,
      .wizard-step.active::before { background: var(--accent); }
      .wizard-step__circle {
        position: relative;
        z-index: 1;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--card-bg);
        border: 2px solid var(--border);
        color: var(--text-muted);
        font-weight: 600;
        font-family: var(--font-heading);
        transition: var(--transition);
      }
      .wizard-step.active .wizard-step__circle {
        border-color: var(--accent);
        color: var(--accent);
        box-shadow: 0 0 0 4px rgba(200, 134, 10, 0.15);
      }
      .wizard-step.done .wizard-step__circle {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
      .wizard-step__label {
        font-size: 0.78rem;
        color: var(--text-secondary);
        font-weight: 500;
        max-width: 110px;
      }
      .wizard-step.active .wizard-step__label { color: var(--primary); font-weight: 600; }
      .logo-drop {
        border: 2px dashed var(--border);
        border-radius: var(--radius);
        padding: 1rem;
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .logo-drop img {
        width: 64px;
        height: 64px;
        object-fit: contain;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border);
        background: #fff;
      }
      .choice-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        cursor: pointer;
      }
      @media (max-width: 575px) {
        .wizard-step__label { display: none; }
      }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header
        title="Create Company"
        subtitle="Set up a new company in 4 quick steps to start maintaining its books"
        icon="bi-building-add"
      />

      <!-- ───────── Progress indicator ───────── -->
      <ol class="wizard-steps">
        @for (s of stepMeta; track s.n) {
          <li class="wizard-step" [class.active]="step() === s.n" [class.done]="step() > s.n">
            <span class="wizard-step__circle">
              @if (step() > s.n) {
                <i class="bi bi-check-lg"></i>
              } @else {
                {{ s.n }}
              }
            </span>
            <span class="wizard-step__label">{{ s.label }}</span>
          </li>
        }
      </ol>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <!-- ═══════════ STEP 1 — Basic Information ═══════════ -->
        @if (step() === 1) {
          <section class="card mb-4 fade-in">
            <div class="card-header"><i class="bi bi-info-circle me-2 text-accent"></i>Basic Information</div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-8">
                  <label class="form-label">Company Name<span class="required-mark">*</span></label>
                  <input class="form-control" formControlName="name" placeholder="Legal name as per registration"
                         [class.is-invalid]="invalid('name')" />
                  @if (invalid('name')) {<div class="invalid-feedback d-block">Company name is required (min 2 chars).</div>}
                </div>
                <div class="col-md-4">
                  <label class="form-label">Type of Company<span class="required-mark">*</span></label>
                  <select class="form-select" formControlName="businessType" [class.is-invalid]="invalid('businessType')">
                    <option value="" disabled>Select…</option>
                    @for (b of businessTypes; track b) {<option [value]="b">{{ b }}</option>}
                  </select>
                  @if (invalid('businessType')) {<div class="invalid-feedback d-block">Select a company type.</div>}
                </div>

                <div class="col-md-4">
                  <label class="form-label">Date of Incorporation<span class="required-mark">*</span></label>
                  <input type="date" class="form-control" formControlName="incorporationDate"
                         [class.is-invalid]="invalid('incorporationDate')" />
                  @if (invalid('incorporationDate')) {<div class="invalid-feedback d-block">Required.</div>}
                </div>
                <div class="col-md-4">
                  <label class="form-label">Financial Year Start<span class="required-mark">*</span></label>
                  <select class="form-select" formControlName="fyStartOption">
                    <option value="apr1">April 1 (default — India)</option>
                    <option value="jan1">January 1</option>
                    <option value="custom">Custom…</option>
                  </select>
                </div>
                <div class="col-md-4">
                  @if (form.controls.fyStartOption.value === 'custom') {
                    <label class="form-label">Custom FY Start Date<span class="required-mark">*</span></label>
                    <input type="date" class="form-control" formControlName="fyCustomDate"
                           [class.is-invalid]="fyCustomInvalid()" />
                    @if (fyCustomInvalid()) {<div class="invalid-feedback d-block">Pick a custom start date.</div>}
                  }
                </div>

                <div class="col-md-4">
                  <label class="form-label">Base Currency<span class="required-mark">*</span></label>
                  <select class="form-select" formControlName="baseCurrency">
                    @for (c of currencies; track c.code) {<option [value]="c.code">{{ c.symbol }} — {{ c.name }} ({{ c.code }})</option>}
                  </select>
                </div>
                <div class="col-md-8">
                  <label class="form-label">Company Website <span class="text-muted small fw-normal">(optional)</span></label>
                  <input class="form-control" formControlName="website" placeholder="https://example.com"
                         [class.is-invalid]="invalid('website')" />
                  @if (invalid('website')) {<div class="invalid-feedback d-block">Enter a valid URL.</div>}
                </div>
              </div>
            </div>
          </section>
        }

        <!-- ═══════════ STEP 2 — Contact & Address ═══════════ -->
        @if (step() === 2) {
          <section class="card mb-4 fade-in">
            <div class="card-header"><i class="bi bi-geo-alt me-2 text-accent"></i>Contact &amp; Address</div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-12">
                  <label class="form-label">Registered Address Line 1<span class="required-mark">*</span></label>
                  <input class="form-control" formControlName="addressLine1" [class.is-invalid]="invalid('addressLine1')" />
                  @if (invalid('addressLine1')) {<div class="invalid-feedback d-block">Address is required.</div>}
                </div>
                <div class="col-12">
                  <label class="form-label">Address Line 2 <span class="text-muted small fw-normal">(optional)</span></label>
                  <input class="form-control" formControlName="addressLine2" />
                </div>
                <div class="col-md-4">
                  <label class="form-label">City<span class="required-mark">*</span></label>
                  <input class="form-control" formControlName="city" [class.is-invalid]="invalid('city')" />
                  @if (invalid('city')) {<div class="invalid-feedback d-block">City is required.</div>}
                </div>
                <div class="col-md-4">
                  <label class="form-label">State<span class="required-mark">*</span></label>
                  <select class="form-select" formControlName="state" (change)="onStateChange()"
                          [class.is-invalid]="invalid('state')">
                    <option value="" disabled>Select…</option>
                    @for (s of states; track s.code) {<option [value]="s.name">{{ s.name }}</option>}
                  </select>
                  @if (invalid('state')) {<div class="invalid-feedback d-block">Select a state.</div>}
                </div>
                <div class="col-md-4">
                  <label class="form-label">PIN Code<span class="required-mark">*</span></label>
                  <input class="form-control" formControlName="pincode" appNumberOnly maxlength="6"
                         [class.is-invalid]="invalid('pincode')" />
                  @if (invalid('pincode')) {<div class="invalid-feedback d-block">Enter a valid 6-digit PIN.</div>}
                </div>

                <div class="col-md-4">
                  <label class="form-label">Country<span class="required-mark">*</span></label>
                  <input class="form-control" formControlName="country" [class.is-invalid]="invalid('country')" />
                  @if (invalid('country')) {<div class="invalid-feedback d-block">Country is required.</div>}
                </div>
                <div class="col-md-4">
                  <label class="form-label">Phone Number<span class="required-mark">*</span></label>
                  <div class="input-group">
                    <select class="form-select" style="max-width: 7rem" formControlName="phoneIsd">
                      @for (i of isdCodes; track i.code) {<option [value]="i.code">{{ i.code }}</option>}
                    </select>
                    <input class="form-control" formControlName="phone" appNumberOnly maxlength="10"
                           [class.is-invalid]="invalid('phone')" />
                  </div>
                  @if (invalid('phone')) {<div class="invalid-feedback d-block">Enter a valid 10-digit number.</div>}
                </div>
                <div class="col-md-4">
                  <label class="form-label">Email Address<span class="required-mark">*</span></label>
                  <input type="email" class="form-control" formControlName="email" [class.is-invalid]="invalid('email')" />
                  @if (invalid('email')) {<div class="invalid-feedback d-block">Enter a valid email.</div>}
                </div>
              </div>
            </div>
          </section>
        }

        <!-- ═══════════ STEP 3 — Tax & Legal Details ═══════════ -->
        @if (step() === 3) {
          <section class="card mb-4 fade-in">
            <div class="card-header"><i class="bi bi-patch-check me-2 text-accent"></i>Tax &amp; Legal Details</div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-3">
                  <label class="form-label">PAN Number<span class="required-mark">*</span></label>
                  <input class="form-control text-uppercase" formControlName="pan" appUpperCase maxlength="10"
                         placeholder="AAAAA9999A" [class.is-invalid]="invalid('pan')" />
                  @if (invalid('pan')) {<div class="invalid-feedback d-block">Invalid PAN (AAAAA9999A).</div>}
                </div>
                <div class="col-md-3">
                  <label class="form-label">Aadhaar Number <span class="text-muted small fw-normal">(optional)</span></label>
                  <input class="form-control" formControlName="aadhaar" appNumberOnly maxlength="12"
                         placeholder="12 digits" [class.is-invalid]="invalid('aadhaar')" />
                  @if (invalid('aadhaar')) {<div class="invalid-feedback d-block">Aadhaar must be 12 digits.</div>}
                </div>
                <div class="col-md-3">
                  <label class="form-label">GSTIN <span class="text-muted small fw-normal">(optional)</span></label>
                  <input class="form-control text-uppercase" formControlName="gstin" appUpperCase maxlength="15"
                         placeholder="22AAAAA9999A1Z5" [class.is-invalid]="invalid('gstin')" />
                  @if (invalid('gstin')) {<div class="invalid-feedback d-block">Invalid GSTIN format.</div>}
                </div>
                <div class="col-md-3">
                  <label class="form-label">TAN Number <span class="text-muted small fw-normal">(optional)</span></label>
                  <input class="form-control text-uppercase" formControlName="tan" appUpperCase maxlength="10"
                         placeholder="AAAA99999A" [class.is-invalid]="invalid('tan')" />
                  @if (invalid('tan')) {<div class="invalid-feedback d-block">Invalid TAN format.</div>}
                </div>

                <div class="col-md-6">
                  <label class="form-label">CIN Number <span class="text-muted small fw-normal">(optional)</span></label>
                  <input class="form-control text-uppercase" formControlName="cin" appUpperCase maxlength="21"
                         placeholder="U74999DL2020PTC123456" [class.is-invalid]="invalid('cin')" />
                  @if (invalid('cin')) {<div class="invalid-feedback d-block">Invalid CIN format.</div>}
                </div>
                <div class="col-md-3">
                  <label class="form-label">State Code <span class="text-muted small fw-normal">(auto)</span></label>
                  <input class="form-control" formControlName="stateCode" readonly placeholder="—"
                         title="Auto-filled from the State you select in Step 2" />
                </div>
                <div class="col-md-3">
                  <label class="form-label">Accounting Method<span class="required-mark">*</span></label>
                  <select class="form-select" formControlName="accountingMethod">
                    @for (m of accountingMethods; track m) {<option [value]="m">{{ m }}</option>}
                  </select>
                </div>

                <div class="col-12">
                  <label class="form-label d-block">Inventory Tracking</label>
                  <div class="d-flex gap-4 pt-1">
                    <label class="choice-pill">
                      <input class="form-check-input mt-0" type="radio" formControlName="inventoryTracking" value="Yes" />
                      Yes
                    </label>
                    <label class="choice-pill">
                      <input class="form-check-input mt-0" type="radio" formControlName="inventoryTracking" value="No" />
                      No
                    </label>
                  </div>
                  @if (form.controls.inventoryTracking.value === 'Yes') {
                    <div class="small text-success mt-2">
                      <i class="bi bi-unlock me-1"></i>Stock module will be enabled for this company.
                    </div>
                  }
                </div>
              </div>
            </div>
          </section>
        }

        <!-- ═══════════ STEP 4 — Banking & Security ═══════════ -->
        @if (step() === 4) {
          <section class="card mb-4 fade-in">
            <div class="card-header"><i class="bi bi-bank me-2 text-accent"></i>Banking &amp; Security</div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Bank Name<span class="required-mark">*</span></label>
                  <input class="form-control" formControlName="bankName" [class.is-invalid]="invalid('bankName')" />
                  @if (invalid('bankName')) {<div class="invalid-feedback d-block">Bank name is required.</div>}
                </div>
                <div class="col-md-6">
                  <label class="form-label">Account Number<span class="required-mark">*</span></label>
                  <input class="form-control" formControlName="bankAccountNo" appNumberOnly maxlength="18"
                         [class.is-invalid]="invalid('bankAccountNo')" />
                  @if (invalid('bankAccountNo')) {<div class="invalid-feedback d-block">Account number is required.</div>}
                </div>
                <div class="col-md-6">
                  <label class="form-label">IFSC Code<span class="required-mark">*</span></label>
                  <input class="form-control text-uppercase" formControlName="ifsc" appUpperCase maxlength="11"
                         placeholder="HDFC0001234" [class.is-invalid]="invalid('ifsc')" />
                  @if (invalid('ifsc')) {
                    <div class="invalid-feedback d-block">Invalid IFSC format.</div>
                  } @else {
                    <div class="form-text">First 4 letters = bank, 5th is 0, last 6 = branch code.</div>
                  }
                </div>
                <div class="col-md-6">
                  <label class="form-label">Branch Name <span class="text-muted small fw-normal">(optional)</span></label>
                  <input class="form-control" formControlName="branchName" />
                </div>

                <div class="col-md-6">
                  <label class="form-label">Owner / Director Name<span class="required-mark">*</span></label>
                  <input class="form-control" formControlName="ownerName" [class.is-invalid]="invalid('ownerName')" />
                  @if (invalid('ownerName')) {<div class="invalid-feedback d-block">Owner / Director name is required.</div>}
                </div>
                <div class="col-md-6">
                  <label class="form-label">Company Logo <span class="text-muted small fw-normal">(PNG/JPG, max 2MB)</span></label>
                  <div class="logo-drop">
                    @if (logoData()) {
                      <img [src]="logoData() ?? ''" alt="logo preview" />
                    } @else {
                      <i class="bi bi-image fs-2 text-muted"></i>
                    }
                    <div class="flex-grow-1">
                      <input type="file" class="form-control" accept="image/png,image/jpeg" (change)="onLogoSelected($event)" />
                      @if (logoName()) {<div class="form-text text-success">{{ logoName() }} loaded.</div>}
                    </div>
                  </div>
                </div>

                <div class="col-md-6">
                  <label class="form-label">Company Password<span class="required-mark">*</span></label>
                  <input type="password" class="form-control" formControlName="accessPassword"
                         autocomplete="new-password" [class.is-invalid]="invalid('accessPassword')" />
                  @if (invalid('accessPassword')) {
                    <div class="invalid-feedback d-block">Min 8 chars with an uppercase letter, a digit and a special character.</div>
                  }
                </div>
                <div class="col-md-6">
                  <label class="form-label">Confirm Password<span class="required-mark">*</span></label>
                  <input type="password" class="form-control" formControlName="confirmPassword"
                         autocomplete="new-password" [class.is-invalid]="confirmInvalid()" />
                  @if (confirmInvalid()) {<div class="invalid-feedback d-block">Passwords do not match.</div>}
                </div>
              </div>
            </div>
          </section>
        }

        <!-- ───────── Navigation ───────── -->
        <div class="d-flex justify-content-between gap-2 no-print">
          <button type="button" class="btn btn-outline-secondary" [disabled]="step() === 1" (click)="back()">
            <i class="bi bi-arrow-left me-1"></i>Back
          </button>

          <div class="d-flex gap-2">
            <span class="align-self-center text-muted small me-2">Step {{ step() }} of 4</span>
            @if (step() < 4) {
              <button type="button" class="btn btn-primary px-4" (click)="next()">
                Next<i class="bi bi-arrow-right ms-1"></i>
              </button>
            } @else {
              <button type="submit" class="btn btn-primary px-4">
                <i class="bi bi-check2-circle me-1"></i>Create Company
              </button>
            }
          </div>
        </div>
      </form>
    </div>
  `
})
export class CreateCompanyComponent {
  private readonly fb = inject(FormBuilder);
  private readonly companies = inject(CompanyService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  readonly businessTypes = BUSINESS_TYPES;
  readonly currencies = CURRENCIES;
  readonly accountingMethods = ACCOUNTING_METHODS;
  readonly isdCodes = ISD_CODES;
  readonly states = INDIAN_STATES;

  readonly stepMeta: ReadonlyArray<StepMeta> = [
    { n: 1, label: 'Basic Info', icon: 'bi-info-circle' },
    { n: 2, label: 'Contact & Address', icon: 'bi-geo-alt' },
    { n: 3, label: 'Tax & Legal', icon: 'bi-patch-check' },
    { n: 4, label: 'Banking & Security', icon: 'bi-bank' }
  ];

  readonly step = signal(1);
  readonly logoData = signal<string | null>(null);
  readonly logoName = signal<string>('');

  readonly form = this.fb.nonNullable.group(
    {
      // ---- Step 1 ----
      name: ['', [Validators.required, Validators.minLength(2)]],
      businessType: ['' as BusinessType | '', [Validators.required]],
      incorporationDate: ['', [Validators.required]],
      fyStartOption: ['apr1' as FyOption, [Validators.required]],
      fyCustomDate: [''],
      baseCurrency: ['INR', [Validators.required]],
      website: ['', [urlValidator()]],

      // ---- Step 2 ----
      addressLine1: ['', [Validators.required]],
      addressLine2: [''],
      city: ['', [Validators.required]],
      state: ['', [Validators.required]],
      pincode: ['', [Validators.required, pincodeValidator()]],
      country: ['India', [Validators.required]],
      phoneIsd: ['+91', [Validators.required]],
      phone: ['', [Validators.required, indianPhoneValidator()]],
      email: ['', [Validators.required, Validators.email]],

      // ---- Step 3 ----
      pan: ['', [Validators.required, panValidator()]],
      aadhaar: ['', [aadhaarValidator()]],
      gstin: ['', [gstinValidator()]],
      tan: ['', [tanValidator()]],
      cin: ['', [cinValidator()]],
      stateCode: [''],
      accountingMethod: ['Accrual' as AccountingMethod, [Validators.required]],
      inventoryTracking: ['No' as YesNo, [Validators.required]],

      // ---- Step 4 ----
      bankName: ['', [Validators.required]],
      bankAccountNo: ['', [Validators.required]],
      ifsc: ['', [Validators.required, ifscValidator()]],
      branchName: [''],
      ownerName: ['', [Validators.required]],
      accessPassword: ['', [Validators.required, passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: [matchValidator('accessPassword', 'confirmPassword')] }
  );

  /** Control names that must be valid before leaving each step. */
  private readonly stepFields: Record<number, string[]> = {
    1: ['name', 'businessType', 'incorporationDate', 'fyStartOption', 'baseCurrency', 'website'],
    2: ['addressLine1', 'city', 'state', 'pincode', 'country', 'phoneIsd', 'phone', 'email'],
    3: ['pan', 'aadhaar', 'gstin', 'tan', 'cin', 'accountingMethod', 'inventoryTracking'],
    4: ['bankName', 'bankAccountNo', 'ifsc', 'ownerName', 'accessPassword', 'confirmPassword']
  };

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  fyCustomInvalid(): boolean {
    const c = this.form.controls.fyCustomDate;
    return this.form.controls.fyStartOption.value === 'custom' && !c.value && (c.dirty || c.touched);
  }

  confirmInvalid(): boolean {
    const c = this.form.controls.confirmPassword;
    return (c.dirty || c.touched) && (c.invalid || this.form.hasError('mismatch'));
  }

  /** Auto-fill the 2-digit GST state code from the selected state. */
  onStateChange(): void {
    const match = this.states.find((s) => s.name === this.form.controls.state.value);
    this.form.controls.stateCode.setValue(match ? match.code : '');
  }

  private isStepValid(n: number): boolean {
    const ok = this.stepFields[n].every((f) => this.form.get(f)!.valid);
    if (n === 1 && this.form.controls.fyStartOption.value === 'custom' && !this.form.controls.fyCustomDate.value) {
      return false;
    }
    if (n === 4 && this.form.hasError('mismatch')) {
      return false;
    }
    return ok;
  }

  back(): void {
    if (this.step() > 1) {
      this.step.update((s) => s - 1);
    }
  }

  next(): void {
    const n = this.step();
    this.stepFields[n].forEach((f) => this.form.get(f)!.markAsTouched());
    if (n === 1) {
      this.form.controls.fyCustomDate.markAsTouched();
    }
    if (!this.isStepValid(n)) {
      this.ui.toast('Please complete the required fields in this step.', 'warning');
      return;
    }
    this.step.update((s) => s + 1);
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      this.ui.toast('Logo must be a PNG or JPG image.', 'warning');
      input.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.ui.toast('Logo must be 2MB or smaller.', 'warning');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.logoData.set(reader.result as string);
      this.logoName.set(file.name);
    };
    reader.readAsDataURL(file);
  }

  private computeFyStart(): string {
    const { fyStartOption, fyCustomDate, incorporationDate } = this.form.getRawValue();
    if (fyStartOption === 'custom') {
      return fyCustomDate;
    }
    const inc = incorporationDate ? new Date(incorporationDate) : new Date();
    const year = inc.getFullYear();
    if (fyStartOption === 'jan1') {
      return `${year}-01-01`;
    }
    // April 1 of the financial year the incorporation falls into.
    const fyYear = inc.getMonth() >= 3 ? year : year - 1;
    return `${fyYear}-04-01`;
  }

  submit(): void {
    // Enter key inside an input can trigger submit early — only finish on step 4.
    if (this.step() !== 4) {
      this.next();
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.ui.toast('Please fix the highlighted fields before creating the company.', 'warning');
      return;
    }

    const v = this.form.getRawValue();
    const financialYearStart = this.computeFyStart();

    const company = this.companies.create({
      name: v.name,
      mailingName: v.name, // derived — kept in sync with the legal name
      businessType: v.businessType as BusinessType,
      incorporationDate: v.incorporationDate,
      financialYearStart,
      booksBeginFrom: financialYearStart,
      baseCurrency: v.baseCurrency,
      maintain: v.inventoryTracking === 'Yes' ? 'Accounts with Inventory' : 'Accounts Only',
      accountingMethod: v.accountingMethod,
      addressLine1: v.addressLine1,
      addressLine2: v.addressLine2,
      city: v.city,
      state: v.state,
      stateCode: v.stateCode,
      pincode: v.pincode,
      country: v.country,
      pan: v.pan,
      aadhaar: v.aadhaar,
      gstin: v.gstin,
      cin: v.cin,
      tan: v.tan,
      phoneIsd: v.phoneIsd,
      phone: v.phone,
      email: v.email,
      website: v.website,
      bankName: v.bankName,
      bankAccountNo: v.bankAccountNo,
      ifsc: v.ifsc,
      branchName: v.branchName,
      ownerName: v.ownerName,
      accessPassword: v.accessPassword,
      logo: this.logoData() ?? undefined
    });

    this.ui.toast(`Company “${company.name}” created successfully.`, 'success');
    this.router.navigateByUrl('/app/dashboard');
  }
}
