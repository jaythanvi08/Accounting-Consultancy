import { BalanceNature } from './ledger.model';

export type VoucherType =
  | 'Journal'
  | 'Payment'
  | 'Receipt'
  | 'Contra'
  | 'Purchase'
  | 'Sales';

/** Golden Rules classification (Personal / Real / Nominal account). */
export type GoldenRuleType = 'personal' | 'real' | 'nominal';

export interface VoucherLine {
  ledgerId: string;
  ledgerName: string;
  type: BalanceNature; // Dr / Cr
  amount: number;
  accountType?: GoldenRuleType; // golden rule classification
  narration?: string;
}

export interface Voucher {
  id: string;
  voucherType: VoucherType;
  voucherNo: string;
  date: string; // ISO
  reference?: string;
  narration?: string;
  lines: VoucherLine[];
  /** Sum of debit lines — must equal total credit for a valid entry. */
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
}
