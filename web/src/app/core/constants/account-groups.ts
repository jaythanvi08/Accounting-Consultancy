import { AccountGroup, AccountType } from '../models';

/**
 * Default Chart of Accounts — primary groups following the NCERT
 * Class 11-12 accounting framework. Four reporting categories
 * (Assets, Liabilities, Income, Expenses); Capital is reported
 * under Liabilities.
 */
export const DEFAULT_ACCOUNT_GROUPS: ReadonlyArray<AccountGroup> = [
  // ───── Assets (Dr) ─────
  { id: 'fixed-assets', name: 'Fixed Assets', parentId: null, type: 'Asset', nature: 'Dr', isPrimary: true },
  { id: 'current-assets', name: 'Current Assets', parentId: null, type: 'Asset', nature: 'Dr', isPrimary: true },
  { id: 'investments', name: 'Investments', parentId: null, type: 'Asset', nature: 'Dr', isPrimary: true },

  // ───── Liabilities (Cr) ─────
  { id: 'long-term-liabilities', name: 'Long-term Liabilities', parentId: null, type: 'Liability', nature: 'Cr', isPrimary: true },
  { id: 'current-liabilities', name: 'Current Liabilities', parentId: null, type: 'Liability', nature: 'Cr', isPrimary: true },
  { id: 'capital-account', name: 'Capital Account', parentId: null, type: 'Capital', nature: 'Cr', isPrimary: true },

  // ───── Income (Cr) ─────
  { id: 'direct-income', name: 'Direct Income', parentId: null, type: 'Income', nature: 'Cr', isPrimary: true },
  { id: 'indirect-income', name: 'Indirect Income', parentId: null, type: 'Income', nature: 'Cr', isPrimary: true },

  // ───── Expenses (Dr) ─────
  { id: 'direct-expenses', name: 'Direct Expenses', parentId: null, type: 'Expense', nature: 'Dr', isPrimary: true },
  { id: 'indirect-expenses', name: 'Indirect Expenses', parentId: null, type: 'Expense', nature: 'Dr', isPrimary: true }
];

/** Four reporting categories used for the colour-coded tree view. */
export type LedgerCategory = 'Assets' | 'Liabilities' | 'Income' | 'Expense';

export interface CategoryMeta {
  key: LedgerCategory;
  label: string;
  icon: string;
  /** CSS variable used for the accent colour. */
  color: string;
}

export const LEDGER_CATEGORIES: ReadonlyArray<CategoryMeta> = [
  { key: 'Assets', label: 'Assets', icon: 'bi-box-seam', color: 'var(--info)' }, // blue
  { key: 'Liabilities', label: 'Liabilities', icon: 'bi-bank', color: 'var(--danger)' }, // red
  { key: 'Income', label: 'Income', icon: 'bi-graph-up-arrow', color: 'var(--success)' }, // green
  { key: 'Expense', label: 'Expenses', icon: 'bi-graph-down-arrow', color: 'var(--warning)' } // orange
];

/** Map a fundamental account type to its reporting category (Capital → Liabilities). */
export function categoryOf(type: AccountType): LedgerCategory {
  switch (type) {
    case 'Asset':
      return 'Assets';
    case 'Liability':
    case 'Capital':
      return 'Liabilities';
    case 'Income':
      return 'Income';
    case 'Expense':
      return 'Expense';
  }
}
