import { Directive, HostListener } from '@angular/core';

/** Restricts an input to digits only (e.g. phone, pincode, account no). */
@Directive({ selector: '[appNumberOnly]', standalone: true })
export class NumberOnlyDirective {
  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[^0-9]/g, '');
    if (cleaned !== input.value) {
      input.value = cleaned;
      input.dispatchEvent(new Event('input', { bubbles: false }));
    }
  }
}
