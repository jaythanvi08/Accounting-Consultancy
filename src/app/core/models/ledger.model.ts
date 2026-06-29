export type BalanceNature = 'Dr' | 'Cr';

/** The five fundamental account types (NCERT). */
export type AccountType = 'Asset' | 'Liability' | 'Capital' | 'Income' | 'Expense';

export interface AccountGroup {
  id: string;
  name: string;
  /** Parent group id for nested groups (null for primary groups). */
  parentId: string | null;
  type: AccountType;
  /** Natural balance side for accounts under this group. */
  nature: BalanceNature;
  isPrimary: boolean;
  description?: string;
}

export interface Ledger {
  id: string;
  name: string;
  groupId: string;
  openingBalance: number;
  openingNature: BalanceNature;
  /** Statutory / contact fields, optional */
  gstin?: string;
  pan?: string;
  notes?: string;
  createdAt: string;
}
