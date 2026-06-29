import { Pipe, PipeTransform } from '@angular/core';

/** Format ISO date strings to locale-specific formats. */
@Pipe({ name: 'dateFormat', standalone: true })
export class DateFormatPipe implements PipeTransform {
  transform(value: string | Date | null | undefined, format: 'short' | 'long' | 'time' = 'short'): string {
    if (!value) return '';

    const date = typeof value === 'string' ? new Date(value) : value;
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';

    switch (format) {
      case 'short':
        // DD/MM/YYYY
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      case 'long':
        // D MMMM YYYY (e.g. "25 June 2026")
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      case 'time':
        // HH:mm:ss
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      default:
        return date.toLocaleDateString('en-IN');
    }
  }
}
