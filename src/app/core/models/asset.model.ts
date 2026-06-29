/** Fixed-asset accounting & depreciation (Module 7). */

export type AssetType =
  | 'Plant & Machinery'
  | 'Land'
  | 'Building'
  | 'Leasehold Assets'
  | 'Furniture & Fixtures'
  | 'Vehicles'
  | 'Computer Equipment';

export type DepreciationMethod = 'SLM' | 'WDV' | 'None';

export type AssetStatus = 'Active' | 'Sold' | 'Scrapped';

export interface AssetAccount {
  id: string;
  name: string;
  type: AssetType;
  purchaseDate: string; // ISO
  cost: number;
  method: DepreciationMethod;
  usefulLife: number; // years
  residualValue: number;
  rate: number; // % (WDV; derived for SLM)
  gstPaid?: number;
  vendorLedger?: string;
  status: AssetStatus;
  /** Number of annual depreciation entries already posted as vouchers. */
  postedYears: number;
  disposalDate?: string;
  disposalValue?: number;
  createdAt: string;
}

/** One row of a year-by-year depreciation schedule. */
export interface DepYearRow {
  year: number;
  opening: number;
  depreciation: number;
  closing: number;
}
