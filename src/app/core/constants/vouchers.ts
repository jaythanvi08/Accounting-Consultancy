import { AccountType, VoucherType } from '../models';

export interface VoucherMeta {
  label: string;
  prefix: string; // voucher-number prefix, e.g. JV
  icon: string; // bootstrap-icon
  hint: string;
}

/** Per-type configuration for the 6 voucher kinds (NCERT). */
export const VOUCHER_META: Record<VoucherType, VoucherMeta> = {
  Journal: { label: 'Journal Voucher', prefix: 'JV', icon: 'bi-journal-text', hint: 'General double-entry — any account type' },
  Payment: { label: 'Payment Voucher', prefix: 'PV', icon: 'bi-arrow-up-circle', hint: 'Cash / bank payments' },
  Receipt: { label: 'Receipt Voucher', prefix: 'RV', icon: 'bi-arrow-down-circle', hint: 'Cash / bank receipts' },
  Contra: { label: 'Contra Voucher', prefix: 'CV', icon: 'bi-arrow-left-right', hint: 'Cash ↔ Bank transfers' },
  Purchase: { label: 'Purchase Voucher', prefix: 'PUR', icon: 'bi-cart-plus', hint: 'Goods bought on credit' },
  Sales: { label: 'Sales Voucher', prefix: 'SV', icon: 'bi-bag-plus', hint: 'Goods sold on credit' }
};

export const VOUCHER_TYPES: ReadonlyArray<VoucherType> = [
  'Journal',
  'Payment',
  'Receipt',
  'Contra',
  'Purchase',
  'Sales'
];

// ─────────────── NCERT Golden Rules of Accounting ───────────────
export type AccountNature = 'Personal' | 'Real' | 'Nominal';

/** Classify a fundamental account type into the NCERT three-fold scheme. */
export function accountNatureOf(type: AccountType): AccountNature {
  switch (type) {
    case 'Income':
    case 'Expense':
      return 'Nominal';
    case 'Asset':
      return 'Real';
    case 'Liability':
    case 'Capital':
      return 'Personal';
  }
}

export interface GoldenRule {
  nature: AccountNature;
  dr: string;
  cr: string;
}

export const GOLDEN_RULES: Record<AccountNature, GoldenRule> = {
  Personal: { nature: 'Personal', dr: 'Debit the Receiver', cr: 'Credit the Giver' },
  Real: { nature: 'Real', dr: 'Debit what comes in', cr: 'Credit what goes out' },
  Nominal: { nature: 'Nominal', dr: 'Debit all expenses & losses', cr: 'Credit all incomes & gains' }
};
