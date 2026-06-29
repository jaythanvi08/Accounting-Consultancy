import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-card-simple fade-in">
      <h2 class="h4 mb-1">Reset password</h2>
      <p class="text-secondary mb-4">Enter your email and we’ll send a reset link.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="mb-3">
          <label class="form-label">Email Address</label>
          <input type="email" class="form-control" formControlName="email"
                 [class.is-invalid]="form.controls.email.invalid && form.controls.email.touched" />
        </div>
        <button class="btn btn-primary w-100 py-2" [disabled]="sent()">Send reset link</button>
      </form>

      <p class="text-center mt-3 mb-0">
        <a routerLink="/auth/login" class="small text-decoration-none">
          <i class="bi bi-arrow-left me-1"></i>Back to login
        </a>
      </p>
    </div>
  `,
  styles: [
    `
      .auth-card-simple {
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow);
        padding: 1.75rem;
      }
    `
  ]
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ui = inject(UiService);
  readonly sent = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.sent.set(true);
    this.ui.toast('If that email exists, a reset link has been sent.', 'success');
  }
}
