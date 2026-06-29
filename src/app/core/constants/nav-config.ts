export interface NavItem {
  label: string;
  icon?: string; // bootstrap-icons class
  route?: string;
  children?: NavItem[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Sidebar navigation model (mirrors the spec's information architecture). */
export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', icon: 'bi-house-door', route: '/app/dashboard' }]
  },
  {
    title: 'Company',
    items: [
      {
        label: 'Company',
        icon: 'bi-building',
        children: [
          { label: 'Create Company', icon: 'bi-plus-square', route: '/app/company/create' },
          { label: 'Company Settings', icon: 'bi-gear', route: '/app/company/settings' }
        ]
      }
    ]
  },
  {
    title: 'Master',
    items: [
      {
        label: 'Master',
        icon: 'bi-journal-bookmark',
        children: [
          { label: 'Ledger Groups', icon: 'bi-diagram-3', route: '/app/ledger/groups' },
          { label: 'Ledgers', icon: 'bi-journals', route: '/app/ledger/list' },
          { label: 'Accounts', icon: 'bi-wallet2', route: '/app/accounts' }
        ]
      }
    ]
  },
  {
    title: 'Books of Account',
    items: [
      {
        label: 'Books of Account',
        icon: 'bi-book',
        children: [
          { label: 'Purchase Book', icon: 'bi-cart', route: '/app/books/purchase' },
          { label: 'Sales Book', icon: 'bi-bag', route: '/app/books/sales' },
          { label: 'Cash Book', icon: 'bi-cash-stack', route: '/app/books/cash' },
          { label: 'Finance Book', icon: 'bi-bank', route: '/app/books/finance' }
        ]
      }
    ]
  },
  {
    title: 'Vouchers',
    items: [
      {
        label: 'Vouchers',
        icon: 'bi-receipt',
        children: [
          { label: 'All Vouchers', icon: 'bi-card-list', route: '/app/vouchers/list' },
          { label: 'Journal Entry', icon: 'bi-journal-text', route: '/app/vouchers/journal' },
          { label: 'Payment Voucher', icon: 'bi-arrow-up-circle', route: '/app/vouchers/payment' },
          { label: 'Receipt Voucher', icon: 'bi-arrow-down-circle', route: '/app/vouchers/receipt' },
          { label: 'Contra Voucher', icon: 'bi-arrow-left-right', route: '/app/vouchers/contra' },
          { label: 'Purchase Voucher', icon: 'bi-cart-plus', route: '/app/vouchers/purchase' },
          { label: 'Sales Voucher', icon: 'bi-bag-plus', route: '/app/vouchers/sales' }
        ]
      }
    ]
  },
  {
    title: 'Inventory',
    items: [
      {
        label: 'Stock Management',
        icon: 'bi-box-seam',
        children: [
          { label: 'Items', icon: 'bi-box', route: '/app/stock/items' },
          { label: 'Transactions', icon: 'bi-arrow-left-right', route: '/app/stock/transactions' },
          { label: 'Stock Register', icon: 'bi-card-list', route: '/app/stock/register' },
          { label: 'Summary', icon: 'bi-clipboard-data', route: '/app/stock/summary' }
        ]
      }
    ]
  },
  {
    title: 'Sales',
    items: [
      {
        label: 'Sales',
        icon: 'bi-graph-up-arrow',
        children: [
          { label: 'Cash Sales', icon: 'bi-cash', route: '/app/sales/cash' },
          { label: 'Credit Sales', icon: 'bi-credit-card', route: '/app/sales/credit' },
          { label: 'Sales Return', icon: 'bi-arrow-return-left', route: '/app/sales/return' },
          { label: 'Turnover Report', icon: 'bi-bar-chart', route: '/app/sales/turnover' },
          { label: 'COGS', icon: 'bi-calculator', route: '/app/sales/cogs' }
        ]
      }
    ]
  },
  {
    title: 'Purchase',
    items: [
      {
        label: 'Purchase',
        icon: 'bi-cart3',
        children: [
          { label: 'Cash Purchase', icon: 'bi-cash', route: '/app/purchase/cash' },
          { label: 'Credit Purchase', icon: 'bi-credit-card', route: '/app/purchase/credit' },
          { label: 'Purchase Discount', icon: 'bi-percent', route: '/app/purchase/discount' },
          { label: 'Purchase Return', icon: 'bi-arrow-return-right', route: '/app/purchase/return' }
        ]
      }
    ]
  },
  {
    title: 'Fixed Assets',
    items: [
      {
        label: 'Fixed Assets',
        icon: 'bi-building-gear',
        children: [
          { label: 'Plant & Machinery', icon: 'bi-gear-wide-connected', route: '/app/assets/plant-machinery' },
          { label: 'Land & Building', icon: 'bi-houses', route: '/app/assets/land-building' },
          { label: 'Depreciation', icon: 'bi-graph-down-arrow', route: '/app/assets/depreciation' },
          { label: 'Lease Hold Assets', icon: 'bi-file-earmark-lock', route: '/app/assets/lease-hold' }
        ]
      }
    ]
  },
  {
    title: 'Reports',
    items: [
      {
        label: 'Reports',
        icon: 'bi-clipboard-data',
        children: [
          { label: 'Balance Sheet', icon: 'bi-file-earmark-bar-graph', route: '/app/reports/balance-sheet' },
          { label: 'Trading Account', icon: 'bi-shop', route: '/app/reports/trading-account' },
          { label: 'Profit & Loss A/c', icon: 'bi-cash-coin', route: '/app/reports/profit-loss' },
          { label: 'Assets & Liabilities', icon: 'bi-columns-gap', route: '/app/reports/assets-liabilities' },
          { label: 'Trial Balance', icon: 'bi-list-columns', route: '/app/reports/trial-balance' }
        ]
      }
    ]
  }
];
