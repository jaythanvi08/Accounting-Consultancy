export type FinancialYearStart = string; // ISO date (YYYY-MM-DD)

export type BusinessType =
  | 'Proprietorship'
  | 'Partnership'
  | 'Private Limited'
  | 'Public Limited'
  | 'LLP'
  | 'HUF'
  | 'Trust'
  | 'NGO'
  | 'Other';

export type MaintainBooks = 'Accounts Only' | 'Accounts with Inventory';

export type AccountingMethod = 'Accrual' | 'Cash';

export interface Company {
  id: string;
  /** Required core identity */
  name: string;
  mailingName: string;
  businessType: BusinessType;
  incorporationDate?: FinancialYearStart;
  financialYearStart: FinancialYearStart;
  booksBeginFrom: FinancialYearStart;
  baseCurrency: string; // ISO code, e.g. INR
  maintain: MaintainBooks;
  accountingMethod?: AccountingMethod;

  /** Address */
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  stateCode?: string; // 2-digit GST state code, auto-filled from state
  pincode?: string;
  country: string;

  /** Statutory (India) */
  pan?: string;
  aadhaar?: string;
  gstin?: string;
  cin?: string;
  tan?: string;

  /** Contact */
  phoneIsd?: string; // ISD code e.g. +91
  phone?: string;
  email?: string;
  website?: string;

  /** Banking */
  bankName?: string;
  bankAccountNo?: string;
  ifsc?: string;
  branchName?: string;

  /** Ownership & access */
  ownerName?: string; // Owner / Director name
  accessPassword?: string; // company-level access control (mock, stored locally)
  logo?: string; // data URL (PNG/JPG)

  createdAt: string;
  ownerId: string;
}
