import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * LedgerAI brand mark: a stylised balance scale inside a hexagon with an
 * "AI" spark, navy→gold gradient, wordmark + tagline.
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="app-logo" [class.app-logo--compact]="compact()">
      <svg
        class="app-logo__mark"
        [attr.width]="size()"
        [attr.height]="size()"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lg-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stop-color="#1B3A5C" />
            <stop offset="1" stop-color="#0F2238" />
          </linearGradient>
        </defs>
        <!-- hexagon -->
        <path
          d="M24 2 L42 12 V36 L24 46 L6 36 V12 Z"
          fill="url(#lg-grad)"
          stroke="#C8860A"
          stroke-width="1.5"
        />
        <!-- balance scale -->
        <g stroke="#F0A820" stroke-width="1.8" stroke-linecap="round">
          <line x1="24" y1="14" x2="24" y2="34" />
          <line x1="14" y1="18" x2="34" y2="18" />
          <line x1="14" y1="18" x2="10" y2="26" />
          <line x1="14" y1="18" x2="18" y2="26" />
          <line x1="34" y1="18" x2="30" y2="26" />
          <line x1="34" y1="18" x2="38" y2="26" />
          <line x1="18" y1="34" x2="30" y2="34" />
        </g>
        <path d="M8 26 a6 6 0 0 0 12 0 Z" fill="#1A7A4A" opacity="0.85" />
        <path d="M28 26 a6 6 0 0 0 12 0 Z" fill="#B22222" opacity="0.85" />
        <!-- AI spark -->
        <circle cx="24" cy="14" r="3.4" fill="#C8860A" />
        <text x="24" y="15.6" text-anchor="middle" font-size="3.6" font-weight="700" fill="#0F2238" font-family="Poppins, sans-serif">AI</text>
      </svg>

      @if (!compact()) {
        <span class="app-logo__text">
          <span class="brand-text app-logo__name">Ledger<span class="text-accent">AI</span></span>
          @if (showTagline()) {
            <span class="brand-text app-logo__tagline">Powered by Intelligence</span>
          }
        </span>
      }
    </span>
  `,
  styles: [
    `
      .app-logo {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
      }
      .app-logo__mark {
        flex-shrink: 0;
      }
      .app-logo__text {
        display: flex;
        flex-direction: column;
        line-height: 1.05;
      }
      .app-logo__name {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.15rem;
        color: #fff;
        letter-spacing: 0.3px;
      }
      .app-logo__tagline {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--text-muted);
      }
      :host-context(.on-light) .app-logo__name {
        color: var(--primary);
      }
    `
  ]
})
export class LogoComponent {
  readonly size = input(40);
  readonly compact = input(false);
  readonly showTagline = input(true);
}
