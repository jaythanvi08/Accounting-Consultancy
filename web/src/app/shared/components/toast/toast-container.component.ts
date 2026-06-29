import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiService } from '../../../core/services/ui.service';

/** Fixed-position toast stack bound to UiService.toasts(). */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack">
      @for (t of ui.toasts(); track t.id) {
        <div class="toast-item" [class]="'toast-item--' + t.type" role="alert">
          <i class="bi" [class.bi-check-circle-fill]="t.type === 'success'"
             [class.bi-exclamation-triangle-fill]="t.type === 'danger' || t.type === 'warning'"
             [class.bi-info-circle-fill]="t.type === 'info'"></i>
          <span class="toast-item__text">{{ t.text }}</span>
          <button type="button" class="toast-item__close" (click)="ui.dismissToast(t.id)" aria-label="Dismiss">
            <i class="bi bi-x"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-width: 360px;
      }
      .toast-item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-left-width: 4px;
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-lg);
        padding: 0.7rem 0.9rem;
        font-size: 0.88rem;
        animation: fadeIn 0.25s ease both;
      }
      .toast-item__text {
        flex: 1;
      }
      .toast-item__close {
        border: none;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 1.1rem;
        line-height: 1;
      }
      .toast-item--success {
        border-left-color: var(--success);
      }
      .toast-item--success i:first-child {
        color: var(--success);
      }
      .toast-item--danger {
        border-left-color: var(--danger);
      }
      .toast-item--danger i:first-child {
        color: var(--danger);
      }
      .toast-item--warning {
        border-left-color: var(--warning);
      }
      .toast-item--warning i:first-child {
        color: var(--warning);
      }
      .toast-item--info {
        border-left-color: var(--info);
      }
      .toast-item--info i:first-child {
        color: var(--info);
      }
    `
  ]
})
export class ToastContainerComponent {
  readonly ui = inject(UiService);
}
