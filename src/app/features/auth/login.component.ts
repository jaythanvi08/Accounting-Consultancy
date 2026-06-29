import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <form class="fade-in" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 class="h4 mb-1">Welcome back</h2>
      <p class="text-secondary mb-4">Sign in to continue to your books.</p>

      <!-- Email or phone -->
      <div class="mb-3">
        <label class="form-label">Email or Phone</label>
        <div class="input-group">
          <span class="input-group-text bg-white">
            <i class="bi" [class.bi-envelope]="!isPhone()" [class.bi-telephone]="isPhone()"></i>
          </span>
          <input
            type="text"
            class="form-control"
            formControlName="identifier"
            placeholder="you@example.com or 98XXXXXXXX"
            [class.is-invalid]="invalid('identifier')"
            autocomplete="username"
          />
        </div>
        @if (invalid('identifier')) {
          <div class="invalid-feedback d-block">Enter your email address or phone number.</div>
        }
      </div>

      <!-- Password -->
      <div class="mb-3">
        <label class="form-label">Password</label>
        <div class="input-group">
          <input
            [type]="showPwd() ? 'text' : 'password'"
            class="form-control"
            formControlName="password"
            placeholder="••••••••"
            [class.is-invalid]="invalid('password')"
            autocomplete="current-password"
          />
          <button type="button" class="btn btn-outline-secondary" (click)="showPwd.set(!showPwd())" tabindex="-1">
            <i class="bi" [class.bi-eye]="!showPwd()" [class.bi-eye-slash]="showPwd()"></i>
          </button>
        </div>
        @if (invalid('password')) {
          <div class="invalid-feedback d-block">Password is required.</div>
        }
      </div>

      <div class="d-flex align-items-center justify-content-between mb-4">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="remember" formControlName="remember" />
          <label class="form-check-label" for="remember">Remember me</label>
        </div>
        <a routerLink="/auth/forgot-password" class="small text-decoration-none">Forgot password?</a>
      </div>

      <button type="submit" class="btn btn-primary w-100 py-2" [disabled]="busy()">
        @if (busy()) {
          <span class="spinner-border spinner-border-sm me-2"></span>
        }
        Login
      </button>

      <p class="text-center text-muted small mt-3 mb-0">
        Demo: register first, then sign in with the same credentials.
      </p>
    </form>
  `
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly showPwd = signal(false);
  readonly busy = signal(false);

  readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]],
    remember: [true]
  });

  isPhone(): boolean {
    return !this.form.controls.identifier.value.includes('@');
  }

  invalid(name: 'identifier' | 'password'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    try {
      const user = await this.auth.login(this.form.getRawValue());
      this.ui.toast(`Welcome back, ${user.firstName}!`, 'success');
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      this.router.navigateByUrl(redirect ?? '/app/dashboard');
    } catch (err) {
      this.ui.toast((err as Error).message, 'danger');
    } finally {
      this.busy.set(false);
    }
  }
}
