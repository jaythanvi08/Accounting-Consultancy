import { Pipe, PipeTransform } from '@angular/core';
import { BalanceNature } from '../../core/models';

/**
 * Renders an amount with its Dr/Cr suffix in accounting convention:
 *   (5000, 'Dr') -> "5,000.00 Dr"
 */
@Pipe({ name: 'debitCredit', standalone: true })
export class DebitCreditPipe implements PipeTransform {
  transform(value: number | null | undefined, nature: BalanceNature = 'Dr'): string {
    if (value === null || value === undefined) {
      return '';
    }
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(value));
    return `${formatted} ${nature}`;
  }
}
