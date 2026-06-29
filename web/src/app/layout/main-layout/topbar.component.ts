import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header class="app-topbar">
      <button class="topbar__toggle" (click)="ui.toggleSidebar(); ui.toggleMobileSidebar()" aria-label="Toggle menu">
        <i class="bi bi-list"></i>
      </button>

      <nav aria-label="breadcrumb" class="d-none d-md-block">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a routerLink="/app/dashboard">Home</a></li>
          @for (crumb of crumbs(); track crumb) {
            <li class="breadcrumb-item active">{{ crumb }}</li>
          }
        </ol>
      </nav>

      <span class="topbar__spacer"></span>

      @if (ui.isLoading()) {
        <span class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-label="Loading"></span>
      }

      <!-- Company switcher -->
      @if (company.companies().length > 1) {
        <div class="dropdown">
          <button class="btn btn-sm btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown">
            <i class="bi bi-building me-1"></i>{{ company.activeCompany()?.name ?? 'Company' }}
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            @for (c of company.companies(); track c.id) {
              <li>
                <button class="dropdown-item" (click)="company.select(c.id)">
                  <i class="bi bi-check2 me-1" [style.visibility]="c.id === company.activeCompany()?.id ? 'visible' : 'hidden'"></i>
                  {{ c.name }}
                </button>
              </li>
            }
          </ul>
        </div>
      }

      <button class="topbar__action" aria-label="Notifications">
        <i class="bi bi-bell"></i>
        <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size:0.55rem">3</span>
      </button>

      <button class="topbar__action" aria-label="AI Assistant" title="AI Assistant">
        <i class="bi bi-robot text-accent"></i>
      </button>

      <!-- User -->
      <div class="dropdown">
        <div class="topbar__user" data-bs-toggle="dropdown" role="button">
          <span class="avatar">{{ initials() }}</span>
          <span class="d-none d-lg-flex flex-column lh-1">
            <span class="fw-semibold" style="font-size:0.85rem">{{ user()?.firstName }} {{ user()?.lastName }}</span>
            <span class="text-muted" style="font-size:0.72rem">{{ user()?.profession }}</span>
          </span>
          <i class="bi bi-chevron-down text-muted small"></i>
        </div>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><h6 class="dropdown-header">{{ user()?.email }}</h6></li>
          <li><a class="dropdown-item" routerLink="/app/company/settings"><i class="bi bi-gear me-2"></i>Company Settings</a></li>
          <li><hr class="dropdown-divider" /></li>
          <li><button class="dropdown-item text-danger" (click)="logout()"><i class="bi bi-box-arrow-right me-2"></i>Logout</button></li>
        </ul>
      </div>
    </header>
  `
})
export class TopbarComponent {
  readonly ui = inject(UiService);
  readonly company = inject(CompanyService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;

  // breadcrumb from the current URL
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly crumbs = computed(() =>
    this.url()
      .split('?')[0]
      .split('/')
      .filter((s) => s && s !== 'app')
      .map((s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
  );

  readonly initials = computed(() => {
    const u = this.user();
    return u ? `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase() : 'U';
  });

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
