import { Route, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { companyGuard } from './core/guards/company.guard';
import { FeaturePlaceholderComponent } from './shared/components/feature-placeholder/feature-placeholder.component';

/** Helper: a placeholder route wired into navigation, with title/icon via route data. */
function stub(path: string, title: string, subtitle: string, icon: string): Route {
  return {
    path,
    component: FeaturePlaceholderComponent,
    data: { title, subtitle, icon },
    title: `${title} · LedgerAI`
  };
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app/dashboard' },

  // ───────── Authentication ─────────
  {
    path: 'auth',
    loadComponent: () =>
      import('./layout/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES)
  },

  // ───────── Application shell (auth-guarded) ─────────
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      {
        path: 'dashboard',
        title: 'Dashboard · LedgerAI',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },

      // Company (no companyGuard — this is where companies get created)
      {
        path: 'company',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'create' },
          {
            path: 'create',
            title: 'Create Company · LedgerAI',
            loadComponent: () =>
              import('./features/company/create-company.component').then((m) => m.CreateCompanyComponent)
          },
          {
            path: 'settings',
            title: 'Company Settings · LedgerAI',
            loadComponent: () =>
              import('./features/company/company-settings.component').then((m) => m.CompanySettingsComponent)
          }
        ]
      },

      // Everything below requires an active company
      {
        path: '',
        canActivateChild: [companyGuard],
        children: [
          // Master · Ledger Management (Module 3)
          {
            path: 'ledger',
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'list' },
              {
                path: 'groups',
                title: 'Ledger Groups · LedgerAI',
                loadComponent: () =>
                  import('./features/ledger/ledger-groups.component').then((m) => m.LedgerGroupsComponent)
              },
              {
                path: 'list',
                title: 'Ledgers · LedgerAI',
                loadComponent: () =>
                  import('./features/ledger/ledger-list.component').then((m) => m.LedgerListComponent)
              },
              {
                path: 'create',
                title: 'Create Ledger · LedgerAI',
                loadComponent: () =>
                  import('./features/ledger/create-ledger.component').then((m) => m.CreateLedgerComponent)
              },
              {
                path: 'edit/:id',
                title: 'Edit Ledger · LedgerAI',
                loadComponent: () =>
                  import('./features/ledger/create-ledger.component').then((m) => m.CreateLedgerComponent)
              },
              {
                path: 'statement/:id',
                title: 'Ledger Statement · LedgerAI',
                loadComponent: () =>
                  import('./features/ledger/ledger-statement.component').then((m) => m.LedgerStatementComponent)
              }
            ]
          },
          // Accounts — Fixed Assets & Depreciation (Module 7)
          {
            path: 'accounts',
            children: [
              {
                path: '',
                pathMatch: 'full',
                title: 'Asset Register · LedgerAI',
                loadComponent: () =>
                  import('./features/accounts/asset-register.component').then((m) => m.AssetRegisterComponent)
              },
              {
                path: 'create',
                title: 'Create Asset · LedgerAI',
                loadComponent: () =>
                  import('./features/accounts/create-asset.component').then((m) => m.CreateAssetComponent)
              },
              {
                path: 'edit/:id',
                title: 'Edit Asset · LedgerAI',
                loadComponent: () =>
                  import('./features/accounts/create-asset.component').then((m) => m.CreateAssetComponent)
              }
            ]
          },

          // Books of Account (Module 4)
          {
            path: 'books',
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'purchase' },
              {
                path: ':book',
                title: 'Books of Account · LedgerAI',
                loadComponent: () => import('./features/books/books.component').then((m) => m.BooksComponent)
              }
            ]
          },

          // Vouchers (Module 6)
          {
            path: 'vouchers',
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'list' },
              {
                path: 'list',
                title: 'Vouchers · LedgerAI',
                loadComponent: () =>
                  import('./features/vouchers/voucher-list.component').then((m) => m.VoucherListComponent)
              },
              {
                path: ':type/edit/:id',
                title: 'Edit Voucher · LedgerAI',
                loadComponent: () =>
                  import('./features/vouchers/voucher-form.component').then((m) => m.VoucherFormComponent)
              },
              {
                path: ':type',
                title: 'New Voucher · LedgerAI',
                loadComponent: () =>
                  import('./features/vouchers/voucher-form.component').then((m) => m.VoucherFormComponent)
              }
            ]
          },

          // Inventory — Stock Management (Module 11)
          {
            path: 'stock',
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'items' },
              {
                path: ':section',
                title: 'Stock Management · LedgerAI',
                loadComponent: () => import('./features/stock/stock.component').then((m) => m.StockComponent)
              }
            ]
          },

          // Sales Management (Module 9)
          {
            path: 'sales',
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'cash' },
              {
                path: ':section',
                title: 'Sales · LedgerAI',
                loadComponent: () => import('./features/sales/sales.component').then((m) => m.SalesComponent)
              }
            ]
          },

          // Purchase Management (Module 10)
          {
            path: 'purchase',
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'cash' },
              {
                path: ':section',
                title: 'Purchase · LedgerAI',
                loadComponent: () => import('./features/purchase/purchase.component').then((m) => m.PurchaseComponent)
              }
            ]
          },

          // Fixed Assets
          stub('assets/plant-machinery', 'Plant & Machinery', 'Fixed Assets', 'bi-gear-wide-connected'),
          stub('assets/land-building', 'Land & Building', 'Fixed Assets', 'bi-houses'),
          stub('assets/depreciation', 'Depreciation', 'Fixed Assets', 'bi-graph-down-arrow'),
          stub('assets/lease-hold', 'Lease Hold Assets', 'Fixed Assets', 'bi-file-earmark-lock'),

          // Reports
          {
            path: 'reports/balance-sheet',
            title: 'Balance Sheet · LedgerAI',
            loadComponent: () =>
              import('./features/reports/balance-sheet.component').then((m) => m.BalanceSheetComponent)
          },
          {
            path: 'reports/trading-account',
            title: 'Trading & Profit & Loss · LedgerAI',
            loadComponent: () =>
              import('./features/reports/trading-pl.component').then((m) => m.TradingPLComponent)
          },
          {
            path: 'reports/profit-loss',
            title: 'Trading & Profit & Loss · LedgerAI',
            loadComponent: () =>
              import('./features/reports/trading-pl.component').then((m) => m.TradingPLComponent)
          },
          {
            path: 'reports/assets-liabilities',
            title: 'Assets & Liabilities · LedgerAI',
            loadComponent: () =>
              import('./features/reports/assets-liabilities.component').then((m) => m.AssetsLiabilitiesComponent)
          },
          {
            path: 'reports/trial-balance',
            title: 'Trial Balance · LedgerAI',
            loadComponent: () =>
              import('./features/reports/trial-balance.component').then((m) => m.TrialBalanceComponent)
          }
        ]
      }
    ]
  },

  { path: '**', redirectTo: 'app/dashboard' }
];
