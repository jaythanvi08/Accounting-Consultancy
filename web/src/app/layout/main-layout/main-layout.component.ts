import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiService } from '../../core/services/ui.service';
import { ExportService } from '../../core/services/export.service';
import { UtilityBus, UtilityAction } from '../../core/services/utility-bus.service';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { ToastContainerComponent } from '../../shared/components/toast/toast-container.component';
import { CalculatorComponent } from '../../shared/components/calculator/calculator.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    ToastContainerComponent,
    CalculatorComponent
  ],
  template: `
    <div class="app-shell">
      <app-sidebar />

      <!-- mobile backdrop -->
      @if (ui.sidebarMobileOpen()) {
        <div class="position-fixed top-0 start-0 w-100 h-100"
             style="background:rgba(15,34,56,.4);z-index:1035"
             (click)="ui.closeMobileSidebar()"></div>
      }

      <div class="app-main" [class.is-collapsed]="ui.sidebarCollapsed()">
        <app-topbar />
        <main class="app-content" id="printArea">
          <router-outlet />
        </main>
      </div>
    </div>

    @if (showCalc()) {
      <app-calculator (closed)="showCalc.set(false)" />
    }

    <app-toast-container />
  `
})
export class MainLayoutComponent implements OnInit {
  readonly ui = inject(UiService);
  private readonly exporter = inject(ExportService);
  private readonly bus = inject(UtilityBus);

  readonly showCalc = signal(false);

  ngOnInit(): void {
    this.bus.subscribe((action: UtilityAction) => this.handleUtility(action));
  }

  private handleUtility(action: UtilityAction): void {
    switch (action) {
      case 'calculator':
        this.showCalc.update((v) => !v);
        break;
      case 'print':
        this.exporter.print();
        break;
      case 'pdf': {
        const el = document.getElementById('printArea');
        if (el) {
          void this.exporter.toPdf(el, 'ledgerai-export');
        }
        break;
      }
      case 'excel':
        this.ui.toast('Open a report or list to export it to Excel.', 'info');
        break;
    }
  }
}
