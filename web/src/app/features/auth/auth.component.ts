import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';

type Mode = 'login' | 'register';

/** Auth card with a Login | Register tab toggle (CSS-animated transition). */
@Component({
  selector: 'app-auth',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoginComponent, RegisterComponent],
  template: `
    <div class="auth-card">
      <div class="auth-tabs">
        <button
          type="button"
          class="auth-tab"
          [class.active]="mode() === 'login'"
          (click)="mode.set('login')"
        >
          Login
        </button>
        <button
          type="button"
          class="auth-tab"
          [class.active]="mode() === 'register'"
          (click)="mode.set('register')"
        >
          Register
        </button>
        <span class="auth-tabs__indicator" [class.right]="mode() === 'register'"></span>
      </div>

      <div class="auth-card__body">
        @if (mode() === 'login') {
          <app-login />
        } @else {
          <app-register />
        }
      </div>
    </div>
  `,
  styles: [
    `
      .auth-card {
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow);
        overflow: hidden;
      }
      .auth-tabs {
        position: relative;
        display: grid;
        grid-template-columns: 1fr 1fr;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
      }
      .auth-tab {
        border: none;
        background: transparent;
        padding: 1rem;
        font-family: var(--font-heading);
        font-weight: 600;
        color: var(--text-secondary);
        cursor: pointer;
        transition: color var(--transition);
        z-index: 1;
      }
      .auth-tab.active {
        color: var(--primary);
      }
      .auth-tabs__indicator {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 50%;
        height: 3px;
        background: var(--accent);
        transition: transform var(--transition);
      }
      .auth-tabs__indicator.right {
        transform: translateX(100%);
      }
      .auth-card__body {
        padding: 1.75rem;
      }
    `
  ]
})
export class AuthComponent {
  private readonly route = inject(ActivatedRoute);
  readonly mode = signal<Mode>(
    (this.route.snapshot.data['mode'] as Mode | undefined) ?? 'login'
  );
}
