import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { UiService } from '../../core/services/ui.service';
import { CompanyService } from '../../core/services/company.service';
import { NAV_GROUPS } from '../../core/constants/nav-config';
import { UtilityBus } from '../../core/services/utility-bus.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, LogoComponent],
  template: `
    <aside
      class="app-sidebar"
      [class.is-collapsed]="ui.sidebarCollapsed()"
      [class.is-open]="ui.sidebarMobileOpen()"
    >
      <div class="app-sidebar__brand">
        <app-logo [compact]="ui.sidebarCollapsed()" [showTagline]="false" [size]="34" />
        @if (!ui.sidebarCollapsed() && company.activeCompany(); as c) {
          <span class="company-badge ms-auto">{{ c.name }}</span>
        }
      </div>

      <nav class="app-sidebar__nav">
        @for (group of navGroups; track group.title) {
          <div class="nav-group" [class.open]="isGroupOpen(group.title)">
            <div class="nav-group__title">{{ group.title }}</div>

            @for (item of group.items; track item.label) {
              @if (item.children?.length) {
                <a
                  class="nav-link nav-group__toggle"
                  (click)="toggleGroup(item.label)"
                  role="button"
                  tabindex="0"
                >
                  <i class="bi {{ item.icon }}"></i>
                  <span class="app-sidebar__label">{{ item.label }}</span>
                  <i class="bi bi-chevron-right chev"></i>
                </a>
                @if (isExpanded(item.label) && !ui.sidebarCollapsed()) {
                  <div class="nav-children">
                    @for (child of item.children; track child.label) {
                      <a
                        class="nav-link"
                        [routerLink]="child.route"
                        routerLinkActive="active"
                        (click)="ui.closeMobileSidebar()"
                      >
                        <i class="bi {{ child.icon }}"></i>
                        <span class="app-sidebar__label">{{ child.label }}</span>
                      </a>
                    }
                  </div>
                }
              } @else {
                <a
                  class="nav-link"
                  [routerLink]="item.route"
                  routerLinkActive="active"
                  (click)="ui.closeMobileSidebar()"
                >
                  <i class="bi {{ item.icon }}"></i>
                  <span class="app-sidebar__label">{{ item.label }}</span>
                </a>
              }
            }
          </div>
        }

        <!-- Utilities -->
        <div class="nav-group">
          <div class="nav-group__title">Utilities</div>
          <a class="nav-link" role="button" tabindex="0" (click)="utility.emit('calculator')">
            <i class="bi bi-calculator"></i><span class="app-sidebar__label">Calculator</span>
          </a>
          <a class="nav-link" role="button" tabindex="0" (click)="utility.emit('pdf')">
            <i class="bi bi-filetype-pdf"></i><span class="app-sidebar__label">Export PDF</span>
          </a>
          <a class="nav-link" role="button" tabindex="0" (click)="utility.emit('excel')">
            <i class="bi bi-file-earmark-excel"></i><span class="app-sidebar__label">Export Excel</span>
          </a>
          <a class="nav-link" role="button" tabindex="0" (click)="utility.emit('print')">
            <i class="bi bi-printer"></i><span class="app-sidebar__label">Print</span>
          </a>
        </div>
      </nav>
    </aside>
  `
})
export class SidebarComponent {
  readonly ui = inject(UiService);
  readonly company = inject(CompanyService);
  readonly navGroups = NAV_GROUPS;

  // expanded parent menus (multi-open)
  private readonly expanded = signal<Set<string>>(new Set(['Company']));

  // emitted utility actions handled by the layout
  readonly utility = inject(UtilityBus);

  toggleGroup(label: string): void {
    const next = new Set(this.expanded());
    next.has(label) ? next.delete(label) : next.add(label);
    this.expanded.set(next);
  }

  isExpanded(label: string): boolean {
    return this.expanded().has(label);
  }

  isGroupOpen(_title: string): boolean {
    return true;
  }
}
