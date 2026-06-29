import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LedgerService } from '../../core/services/ledger.service';
import { UiService } from '../../core/services/ui.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import { Ledger } from '../../core/models';

// jQuery is loaded globally (angular.json scripts); DataTables enhances the
// table if present, otherwise the plain Bootstrap table is shown as-is.
declare const $: (selector: unknown) => {
  DataTable: (options: unknown) => { destroy: () => void };
};

@Component({
  selector: 'app-ledger-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, IndianNumberPipe],
  template: `
    <div class="fade-in">
      <app-page-header
        title="Ledgers"
        subtitle="All account heads with opening balances"
        icon="bi-journals"
      >
        <a routerLink="/app/ledger/create" class="btn btn-primary btn-sm">
          <i class="bi bi-plus-lg me-1"></i>New Ledger
        </a>
      </app-page-header>

      @if (groupFilter()) {
        <div class="mb-3">
          <span class="badge bg-soft-primary text-primary p-2">
            <i class="bi bi-funnel me-1"></i>Filtered by group: <strong>{{ ledgers.groupName(groupFilter()) }}</strong>
            <button class="btn-close btn-close-sm ms-2" style="font-size:.6rem" (click)="clearFilter()"></button>
          </span>
        </div>
      }

      <div class="card">
        <div class="card-body">
          @if (rows().length === 0) {
            <div class="text-center text-muted py-5">
              <i class="bi bi-inbox fs-1 d-block mb-2"></i>
              No ledgers yet. Click <strong>New Ledger</strong> to create your first account head.
            </div>
          } @else {
            <table #table class="table table-hover table-bordered align-middle w-100" style="border-color: var(--border)">
              <thead class="table-light">
                <tr>
                  <th>Ledger Name</th>
                  <th>Group</th>
                  <th class="text-end">Opening Balance</th>
                  <th class="text-center">Dr/Cr</th>
                  <th class="text-center no-sort">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (l of rows(); track l.id) {
                  <tr>
                    <td class="fw-medium">{{ l.name }}</td>
                    <td>{{ ledgers.groupName(l.groupId) }}</td>
                    <td class="text-end mono" [attr.data-order]="l.openingBalance">{{ l.openingBalance | indianNumber }}</td>
                    <td class="text-center">
                      <span class="badge" [class.bg-soft-success]="l.openingNature === 'Dr'"
                            [class.text-success]="l.openingNature === 'Dr'"
                            [class.bg-soft-danger]="l.openingNature === 'Cr'"
                            [class.text-danger]="l.openingNature === 'Cr'">{{ l.openingNature }}</span>
                    </td>
                    <td class="text-center text-nowrap">
                      <a [routerLink]="['/app/ledger/statement', l.id]" class="btn btn-sm btn-outline-secondary py-0"
                         title="View"><i class="bi bi-eye"></i></a>
                      <a [routerLink]="['/app/ledger/edit', l.id]" class="btn btn-sm btn-outline-primary py-0 ms-1"
                         title="Edit"><i class="bi bi-pencil"></i></a>
                      <a [routerLink]="['/app/ledger/statement', l.id]" class="btn btn-sm btn-outline-info py-0 ms-1"
                         title="Ledger Statement"><i class="bi bi-file-earmark-text"></i></a>
                      <button class="btn btn-sm btn-outline-danger py-0 ms-1" title="Delete" (click)="remove(l)">
                        <i class="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  `
})
export class LedgerListComponent implements AfterViewInit, OnDestroy {
  readonly ledgers = inject(LedgerService);
  private readonly ui = inject(UiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('table') tableRef?: ElementRef<HTMLTableElement>;
  private dt: { destroy: () => void } | null = null;

  readonly groupFilter = signal<string>('');
  readonly rows = computed<Ledger[]>(() => {
    const gid = this.groupFilter();
    const all = this.ledgers.ledgers();
    return gid ? all.filter((l) => l.groupId === gid) : all;
  });

  constructor() {
    this.ledgers.sync();
    this.groupFilter.set(this.route.snapshot.queryParamMap.get('group') ?? '');
  }

  clearFilter(): void {
    this.destroyDataTable();
    this.groupFilter.set('');
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    setTimeout(() => this.initDataTable());
  }

  ngAfterViewInit(): void {
    this.initDataTable();
  }

  ngOnDestroy(): void {
    this.destroyDataTable();
  }

  private initDataTable(): void {
    const el = this.tableRef?.nativeElement;
    if (!el || typeof $ !== 'function') {
      return;
    }
    try {
      this.dt = $(el).DataTable({
        paging: true,
        pageLength: 10,
        searching: true,
        ordering: true,
        info: true,
        order: [[0, 'asc']],
        columnDefs: [{ orderable: false, targets: 'no-sort' }],
        language: { search: 'Search ledgers:' }
      });
    } catch {
      this.dt = null; // plugin missing or init failed — plain table remains
    }
  }

  private destroyDataTable(): void {
    try {
      this.dt?.destroy();
    } catch {
      /* ignore */
    }
    this.dt = null;
  }

  remove(l: Ledger): void {
    if (!confirm(`Delete ledger “${l.name}”? This cannot be undone.`)) {
      return;
    }
    // Tear down DataTables before Angular re-renders the rows, then re-enhance.
    this.destroyDataTable();
    this.ledgers.deleteLedger(l.id);
    this.ui.toast(`Ledger “${l.name}” deleted.`, 'info');
    setTimeout(() => this.initDataTable());
  }
}
