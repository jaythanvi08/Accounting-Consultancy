import { Injectable, computed, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  type: 'success' | 'danger' | 'info' | 'warning';
}

/** Global UI state: HTTP loading counter, sidebar, and transient toasts. */
@Injectable({ providedIn: 'root' })
export class UiService {
  // ---- Loading (driven by the loading interceptor) ----
  private readonly pending = signal(0);
  readonly isLoading = computed(() => this.pending() > 0);

  loadingStart(): void {
    this.pending.update((n) => n + 1);
  }

  loadingStop(): void {
    this.pending.update((n) => Math.max(0, n - 1));
  }

  // ---- Sidebar ----
  readonly sidebarCollapsed = signal(false);
  readonly sidebarMobileOpen = signal(false);

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleMobileSidebar(): void {
    this.sidebarMobileOpen.update((v) => !v);
  }

  closeMobileSidebar(): void {
    this.sidebarMobileOpen.set(false);
  }

  // ---- Toasts ----
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  toast(text: string, type: Toast['type'] = 'info'): void {
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, text, type }]);
    setTimeout(() => this.dismissToast(id), 4000);
  }

  dismissToast(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
