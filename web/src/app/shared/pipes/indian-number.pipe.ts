import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a number with the Indian digit grouping system (lakh / crore):
 *   1234567.5  ->  "12,34,567.50"
 */
@Pipe({ name: 'indianNumber', standalone: true })
export class IndianNumberPipe implements PipeTransform {
  transform(value: number | string | null | undefined, fractionDigits = 2): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const num = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(num)) {
      return '';
    }
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(num);
  }
}
