import { AccountingMethod, BusinessType, MaintainBooks } from '../models';
import { Profession, Gender } from '../models';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: ReadonlyArray<Currency> = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' }
];

export const BUSINESS_TYPES: ReadonlyArray<BusinessType> = [
  'Private Limited',
  'Public Limited',
  'LLP',
  'Proprietorship',
  'Partnership',
  'HUF',
  'Trust',
  'NGO',
  'Other'
];

export const MAINTAIN_OPTIONS: ReadonlyArray<MaintainBooks> = [
  'Accounts Only',
  'Accounts with Inventory'
];

export const ACCOUNTING_METHODS: ReadonlyArray<AccountingMethod> = ['Accrual', 'Cash'];

export interface IsdCode {
  code: string; // e.g. +91
  country: string;
}

export const ISD_CODES: ReadonlyArray<IsdCode> = [
  { code: '+91', country: 'India' },
  { code: '+1', country: 'USA / Canada' },
  { code: '+44', country: 'UK' },
  { code: '+971', country: 'UAE' },
  { code: '+61', country: 'Australia' },
  { code: '+65', country: 'Singapore' }
];

export const PROFESSIONS: ReadonlyArray<Profession> = [
  'Accountant',
  'CA',
  'Business Owner',
  'Student',
  'Other'
];

export const GENDERS: ReadonlyArray<Gender> = ['Male', 'Female', 'Other'];
