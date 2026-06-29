# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**LedgerAI** — an AI-Powered Accountant SPA (Angular 19) implementing the NCERT Class 11–12
accounting curriculum: companies, chart of accounts, double-entry vouchers, books, stock,
fixed assets/depreciation, and financial statements. The full product spec lives in the
**`ledgerai` skill** — invoke `/ledgerai` to load the authoritative module-by-module
specification, design system, and accounting rules. This file documents how the code is
actually wired today; the skill documents the intended target.

## Commands

Environment is **Windows / PowerShell** (a Bash tool is also available). npm scripts:

```bash
npm start          # ng serve → http://localhost:4200 (dev config: no optimization, sourcemaps)
npm run build      # ng build → dist/ledgerai (PRODUCTION by default; has budget limits)
npm run watch      # ng build --watch --configuration development
npm test           # Karma + Jasmine (Chrome). NOTE: no *.spec.ts files exist yet.
ng generate component <name>   # schematics default to inline-... see "Components" below
```

Run a single spec once specs exist: `ng test --include='**/<name>.spec.ts'`.

## Architecture — the things you can't infer from one file

### There is no backend. Data lives in `localStorage`.
This is the single most important fact. Despite the HTTP interceptors wired in
`app.config.ts` (`auth`, `loading`, `error`) and `provideHttpClient`, **no feature calls an
API**. Every domain service is a signal store persisted through `core/services/storage.service.ts`
(a thin typed `localStorage` JSON wrapper). `AuthService` even mints a fake JWT-shaped token.
When a real API arrives, swap service method bodies for `HttpClient` calls — the public surface
(signals + promises) is designed to stay the same.

### Per-company data isolation + the `sync()` pattern
Domain data is namespaced by the active company: storage keys are
`ledgerai.<entity>.<companyId>` (e.g. `ledgerai.ledgers.<id>`, `ledgerai.vouchers.<id>`,
`ledgerai.groups.<id>`). Global keys: `ledgerai.companies`, `ledgerai.activeCompany`,
`ledgerai.users`, `ledgerai.session`.

Because stores are per-company and the active company can change, **per-company services
expose `sync()` and feature components must call it before reading the signals**
(see `LedgerService.sync()`, `VoucherService.sync()`). `sync()` also seeds defaults on first
use (e.g. `LedgerService.sync()` seeds `DEFAULT_ACCOUNT_GROUPS`). Globally-scoped services
(`CompanyService`, `AuthService`) instead initialize from storage in field initializers.

### Routing & guards
All routes lazy-load via `loadComponent`/`loadChildren` (`app.routes.ts`). Two shells:
`auth-layout` (under `/auth`) and `main-layout` (under `/app`, behind `authGuard`). Most
accounting modules are nested under a child route with `canActivateChild: [companyGuard]`,
which redirects to `/app/company/create` when no company is active — so **company
create/settings are deliberately NOT company-guarded** (that's where the first company is made).

Not-yet-built screens are wired into nav as placeholders via the `stub()` helper →
`FeaturePlaceholderComponent`. **Currently stubbed (not real):** Balance Sheet, Trading
Account, Profit & Loss, Trial Balance, and the Fixed-Assets sub-pages (plant-machinery,
land-building, depreciation, lease-hold). Built reports: Assets & Liabilities. Replace a
`stub(...)` with a real `loadComponent` route when implementing one.

### Layered structure
- `core/` — `guards/`, `interceptors/`, `models/` (interfaces; barrel at `core/models/index.ts`),
  `services/` (signal stores), `constants/` (seed data: `account-groups`, `gst-rates`,
  `currencies`, `vouchers`, `nav-config`).
- `shared/` — reusable `components/`, `pipes/` (`indianNumber`, `currencyIn`, `debitCredit`),
  `directives/` (`numberOnly`, `upperCase`, `decimalTwo`), and `validators/statutory.validators.ts`
  (`pan`, `gstin`, `ifsc`, `cin`, `tan`, `pincode`, `indianPhone`, `aadhaar`, `url`,
  `passwordStrength`, `match`).
- `features/` — one folder per spec module; each screen is a standalone component.
- `layout/` — `main-layout` (sidebar + topbar + outlet) and `auth-layout`.

### Cross-cutting UI services
- `UiService` — global loading counter (incremented by `loadingInterceptor`), sidebar
  collapse/mobile state, and transient toasts. Use `ui.toast(text, type)` for user feedback.
- `UtilityBus` (an `EventEmitter<'calculator'|'pdf'|'excel'|'print'>`) decouples sidebar/topbar
  utility buttons from the layout handler.
- `ExportService` — PDF via jsPDF + html2canvas (`toPdf(element)`), Excel via SheetJS
  (`toExcel(rows)`).
- Sidebar nav is data-driven from `core/constants/nav-config.ts` (`NAV_GROUPS`).

## Conventions (enforced — match existing code)

- **Single-file components.** Components are `.ts` only, with **inline `template` and inline
  `styles`** — there are no separate `.html`/`.scss`/`.spec.ts` files. `angular.json` sets
  `inlineStyleLanguage: scss`. Follow this when adding components. Selector prefix is `app`.
- **Angular style is strict and non-negotiable:** `standalone: true`, `ChangeDetectionStrategy.OnPush`,
  `inject()` (never constructor injection), `signal()/computed()/effect()` for state (no
  `BehaviorSubject` for UI state), new control flow only (`@if`/`@for` with `track`/`@switch`,
  never `*ngIf`/`*ngFor`), `takeUntilDestroyed()` for subscriptions, `crypto.randomUUID()` for ids,
  ISO date strings in stored models.
- **TypeScript is strict** (`strict`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`,
  `strictTemplates`, etc.). No `any`.
- **jQuery is for DataTables only.** It's loaded globally via `angular.json` `scripts` (jQuery,
  Bootstrap bundle, DataTables). Components that need it `declare const $` locally, enhance the
  table in `ngAfterViewInit`, and `destroy()` it in `ngOnDestroy` (see `ledger-list.component.ts`).
  Bootstrap 5, Bootstrap Icons, and Font Awesome CSS are also global via `angular.json`.
- **Styling:** global brand system in `src/styles/` (entry `main.scss`; tokens in `_variables.scss`).
  Use the CSS variables (`--primary`, `--accent`, `--success`, `--danger`, `--font-mono`, …),
  not hard-coded colors. Accounting color convention is mandatory: **Debit → success/green,
  Credit → danger/red**; amounts use `var(--font-mono)`.

## Model naming gotcha

The on-disk models differ from the interface sketches in the spec. The chart-of-accounts type
is **`AccountGroup`** (not `LedgerGroup`), with `type: AccountType` (`'Asset' | 'Liability' |
'Capital' | 'Income' | 'Expense'`) and `nature: BalanceNature` (`'Dr' | 'Cr'`). `Voucher` uses
`voucherType`. When spec and code disagree, **follow the code in `core/models/`.**
 `