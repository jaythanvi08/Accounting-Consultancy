import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { ToastContainerComponent } from '../../shared/components/toast/toast-container.component';

/** Split-screen shell for authentication routes (login / register). */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, LogoComponent, ToastContainerComponent],
  template: `
    <div class="auth-shell">
      <!-- LEFT: brand / illustration -->
      <aside class="auth-hero">
        <div class="auth-hero__brand">
          <app-logo [size]="48" [showTagline]="true" />
        </div>

        <div class="auth-hero__content">
          <h1 class="auth-hero__headline">
            Intelligent accounting,<br />from ledger to balance sheet.
          </h1>
          <p class="auth-hero__sub">
            Maintain ledgers, post vouchers, run your books and generate
            financial statements — all in one AI-powered workspace built on the
            NCERT accounting framework.
          </p>

          <ul class="auth-hero__features">
            <li><i class="bi bi-journals"></i> Double-entry ledgers &amp; vouchers</li>
            <li><i class="bi bi-box-seam"></i> Inventory &amp; stock valuation</li>
            <li><i class="bi bi-clipboard-data"></i> Balance Sheet, P&amp;L, Trial Balance</li>
            <li><i class="bi bi-robot"></i> AI assistant for entries &amp; insights</li>
          </ul>
        </div>

        <div class="auth-hero__decor" aria-hidden="true">
          <i class="bi bi-graph-up-arrow"></i>
          <i class="bi bi-cash-coin"></i>
          <i class="bi bi-pie-chart"></i>
        </div>
      </aside>

      <!-- RIGHT: routed auth card -->
      <main class="auth-panel">
        <div class="auth-panel__inner">
          <router-outlet />
        </div>
      </main>
    </div>

    <app-toast-container />
  `,
  styles: [
    `
      .auth-shell {
        display: grid;
        grid-template-columns: 1.1fr 1fr;
        min-height: 100vh;
      }
      .auth-hero {
        position: relative;
        background: radial-gradient(circle at 20% 20%, #2e5f8a 0, #0f2238 60%);
        color: #fff;
        padding: 2.5rem 3rem;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .auth-hero__brand {
        margin-bottom: auto;
      }
      .auth-hero__headline {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 2.1rem;
        line-height: 1.25;
        margin-bottom: 1rem;
      }
      .auth-hero__sub {
        color: #c9d6e5;
        max-width: 460px;
        margin-bottom: 1.75rem;
      }
      .auth-hero__features {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.65rem;
      }
      .auth-hero__features li {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        color: #e4ecf5;
      }
      .auth-hero__features i {
        color: var(--accent-light);
        font-size: 1.1rem;
      }
      .auth-hero__decor {
        position: absolute;
        right: -10px;
        bottom: -10px;
        font-size: 6rem;
        opacity: 0.06;
        display: flex;
        gap: 1rem;
      }
      .auth-panel {
        display: grid;
        place-items: center;
        background: var(--surface);
        padding: 2rem 1.5rem;
      }
      .auth-panel__inner {
        width: 100%;
        max-width: 440px;
      }
      @media (max-width: 900px) {
        .auth-shell {
          grid-template-columns: 1fr;
        }
        .auth-hero {
          display: none;
        }
      }
    `
  ]
})
export class AuthLayoutComponent {}
