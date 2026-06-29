import { Directive, HostListener } from '@angular/core';

/** Forces input value to uppercase — used for PAN, GSTIN, IFSC, CIN fields. */
@Directive({ selector: '[appUpperCase]', standalone: true })
export class UpperCaseDirective {
  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toUpperCase();
    if (upper !== input.value) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = upper;
      input.setSelectionRange(start, end);
      input.dispatchEvent(new Event('input', { bubbles: false }));
    }
  }
}
