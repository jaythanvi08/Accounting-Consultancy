import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Standard feature page heading with icon, title, optional subtitle. */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-header__title">
          @if (icon()) {
            <i class="bi {{ icon() }}"></i>
          }
          {{ title() }}
        </h1>
        @if (subtitle()) {
          <p class="page-header__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content />
      </div>
    </header>
  `,
  imports: [],
  host: { class: 'd-block' }
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly icon = input<string>('');
}
