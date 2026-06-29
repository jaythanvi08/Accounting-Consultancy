import { Directive, HostListener } from '@angular/core';

/** Restricts input to a non-negative number with at most two decimal places. */
@Directive({ selector: '[appDecimalTwo]', standalone: true })
export class DecimalTwoDirective {
  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9.]/g, '');

    // keep only the first decimal point
    const firstDot = value.indexOf('.');
    if (firstDot !== -1) {
      value =
        value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, '');
      // clamp to two decimals
      const [intPart, decPart] = value.split('.');
      value = `${intPart}.${decPart.slice(0, 2)}`;
    }

    if (value !== input.value) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: false }));
    }
  }
}
