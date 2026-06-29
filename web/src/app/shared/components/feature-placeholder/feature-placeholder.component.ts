import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PageHeaderComponent } from '../page-header/page-header.component';

/**
 * Lightweight scaffold used by feature routes that are wired into navigation
 * but whose full UI is part of a later milestone. Keeps the shell, routing,
 * guards and breadcrumbs fully functional end-to-end.
 */
@Component({
  selector: 'app-feature-placeholder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  template: `
    <div class="fade-in">
      <app-page-header [title]="title()" [subtitle]="subtitle()" [icon]="icon()" />

      <div class="surface-card p-5 text-center">
        <div class="placeholder-icon mb-3">
          <i class="bi {{ icon() || 'bi-tools' }}"></i>
        </div>
        <h2 class="h5 mb-2">{{ title() }}</h2>
        <p class="text-secondary mb-1">This module is scaffolded and ready for implementation.</p>
        <p class="text-muted small mb-0">
          Routing, guards, the active company context and the design system are all live here.
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .placeholder-icon {
        width: 84px;
        height: 84px;
        margin: 0 auto;
        border-radius: 24px;
        display: grid;
        place-items: center;
        font-size: 2.2rem;
        color: var(--accent);
        background: rgba(200, 134, 10, 0.12);
      }
    `
  ]
})
export class FeaturePlaceholderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('Coming soon');
  readonly icon = input<string>('bi-tools');
}
