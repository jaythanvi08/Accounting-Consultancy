import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';
import { PROFESSIONS, GENDERS } from '../../core/constants/currencies';
import {
  indianPhoneValidator,
  matchValidator,
  passwordStrengthValidator
} from '../../shared/validators/statutory.validators';
import { NumberOnlyDirective } from '../../shared/directives/number-only.directive';
import { Gender, Profession } from '../../core/models';

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NumberOnlyDirective],
  template: `
    <form class="fade-in" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 class="h4 mb-1">Create your account</h2>
      <p class="text-secondary mb-4">Start managing your books in minutes.</p>

      <div class="row g-3">
        <div class="col-6">
          <label class="form-label">First Name<span class="required-mark">*</span></label>
          <input class="form-control" formControlName="firstName" [class.is-invalid]="invalid('firstName')" />
          @if (invalid('firstName')) {<div class="invalid-feedback d-block">First name is required.</div>}
        </div>
        <div class="col-6">
          <label class="form-label">Last Name<span class="required-mark">*</span></label>
          <input class="form-control" formControlName="lastName" [class.is-invalid]="invalid('lastName')" />
          @if (invalid('lastName')) {<div class="invalid-feedback d-block">Last name is required.</div>}
        </div>

        <div class="col-12 col-sm-7">
          <label class="form-label">Phone Number<span class="required-mark">*</span></label>
          <div class="input-group">
            <span class="input-group-text bg-white">+91</span>
            <input
              class="form-control"
              formControlName="phone"
              appNumberOnly
              maxlength="10"
              inputmode="numeric"
              placeholder="10-digit mobile"
              [class.is-invalid]="invalid('phone')"
            />
          </div>
          @if (invalid('phone')) {
            <div class="invalid-feedback d-block">Enter a valid 10-digit Indian mobile number.</div>
          }
        </div>
        <div class="col-12 col-sm-5">
          <label class="form-label">Age<span class="required-mark">*</span></label>
          <input
            type="number"
            class="form-control"
            formControlName="age"
            min="18"
            max="80"
            [class.is-invalid]="invalid('age')"
          />
          @if (invalid('age')) {<div class="invalid-feedback d-block">Age must be between 18 and 80.</div>}
        </div>

        <div class="col-12">
          <label class="form-label">Email Address<span class="required-mark">*</span></label>
          <input type="email" class="form-control" formControlName="email" [class.is-invalid]="invalid('email')" autocomplete="email" />
          @if (invalid('email')) {<div class="invalid-feedback d-block">Enter a valid email address.</div>}
        </div>

        <div class="col-12 col-sm-6">
          <label class="form-label">Profession / Role<span class="required-mark">*</span></label>
          <select class="form-select" formControlName="profession" [class.is-invalid]="invalid('profession')">
            <option value="" disabled>Select…</option>
            @for (p of professions; track p) {<option [value]="p">{{ p }}</option>}
          </select>
          @if (invalid('profession')) {<div class="invalid-feedback d-block">Please select your role.</div>}
        </div>
        <div class="col-12 col-sm-6">
          <label class="form-label d-block">Gender<span class="required-mark">*</span></label>
          <div class="d-flex gap-3 pt-1">
            @for (g of genders; track g) {
              <div class="form-check">
                <input class="form-check-input" type="radio" [id]="'g-' + g" [value]="g" formControlName="gender" />
                <label class="form-check-label" [for]="'g-' + g">{{ g }}</label>
              </div>
            }
          </div>
          @if (invalid('gender')) {<div class="text-danger small mt-1">Please select a gender.</div>}
        </div>

        <div class="col-12 col-sm-6">
          <label class="form-label">Password<span class="required-mark">*</span></label>
          <div class="input-group">
            <input
              [type]="showPwd() ? 'text' : 'password'"
              class="form-control"
              formControlName="password"
              [class.is-invalid]="invalid('password')"
              autocomplete="new-password"
            />
            <button type="button" class="btn btn-outline-secondary" (click)="showPwd.set(!showPwd())" tabindex="-1">
              <i class="bi" [class.bi-eye]="!showPwd()" [class.bi-eye-slash]="showPwd()"></i>
            </button>
          </div>
          @if (passwordErrors().length) {
            <ul class="small text-danger mt-1 mb-0 ps-3">
              @for (e of passwordErrors(); track e) {<li>{{ e }}</li>}
            </ul>
          }
        </div>
        <div class="col-12 col-sm-6">
          <label class="form-label">Confirm Password<span class="required-mark">*</span></label>
          <input
            [type]="showPwd() ? 'text' : 'password'"
            class="form-control"
            formControlName="confirmPassword"
            [class.is-invalid]="mismatch()"
            autocomplete="new-password"
          />
          @if (mismatch()) {<div class="invalid-feedback d-block">Passwords do not match.</div>}
        </div>

        <div class="col-12">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="terms" formControlName="terms" [class.is-invalid]="invalid('terms')" />
            <label class="form-check-label" for="terms">
              I agree to the <a href="#" (click)="$event.preventDefault()">Terms &amp; Conditions</a>.
            </label>
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100 py-2 mt-4" [disabled]="busy()">
        @if (busy()) {<span class="spinner-border spinner-border-sm me-2"></span>}
        Create Account
      </button>
    </form>
  `
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  readonly professions = PROFESSIONS;
  readonly genders = GENDERS;
  readonly showPwd = signal(false);
  readonly busy = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(1)]],
      phone: ['', [Validators.required, indianPhoneValidator()]],
      email: ['', [Validators.required, Validators.email]],
      age: [null as number | null, [Validators.required, Validators.min(18), Validators.max(80)]],
      profession: ['' as Profession | '', [Validators.required]],
      gender: ['' as Gender | '', [Validators.required]],
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]],
      terms: [false, [Validators.requiredTrue]]
    },
    { validators: matchValidator('password', 'confirmPassword') }
  );

  readonly passwordErrors = computed(() => this.collectPasswordErrors());

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  mismatch(): boolean {
    const c = this.form.controls.confirmPassword;
    return this.form.hasError('mismatch') && (c.dirty || c.touched);
  }

  private collectPasswordErrors(): string[] {
    const errs = this.form.controls.password.errors?.['passwordStrength'];
    if (!errs || !(this.form.controls.password.dirty || this.form.controls.password.touched)) {
      return [];
    }
    const messages: string[] = [];
    if (errs['minlength']) messages.push('At least 8 characters');
    if (errs['upper']) messages.push('One uppercase letter');
    if (errs['digit']) messages.push('One number');
    if (errs['special']) messages.push('One special character');
    return messages;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    const v = this.form.getRawValue();
    try {
      await this.auth.register({
        firstName: v.firstName,
        lastName: v.lastName,
        phone: v.phone,
        email: v.email,
        age: Number(v.age),
        profession: v.profession as Profession,
        gender: v.gender as Gender,
        password: v.password
      });
      this.ui.toast('Account created! Let’s set up your company.', 'success');
      this.router.navigateByUrl('/app/company/create');
    } catch (err) {
      this.ui.toast((err as Error).message, 'danger');
    } finally {
      this.busy.set(false);
    }
  }
}
