import { Pipe, PipeTransform } from '@angular/core';

/**
 * Indian-locale currency formatting with a configurable symbol (default ₹):
 *   125000  ->  "₹1,25,000.00"
 */
@Pipe({ name: 'currencyIn', standalone: true })
export class CurrencyInPipe implements PipeTransform {
  transform(
    value: number | string | null | undefined,
    symbol = '₹',
    fractionDigits = 2
  ): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const num = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(num)) {
      return '';
    }
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(Math.abs(num));
    const sign = num < 0 ? '-' : '';
    return `${sign}${symbol}${formatted}`;
  }
}
