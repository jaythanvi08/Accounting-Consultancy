import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// ---- Indian statutory ID formats ----
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const INDIAN_PHONE_RE = /^[6-9][0-9]{9}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const AADHAAR_RE = /^[2-9][0-9]{11}$/; // 12 digits, first digit 2-9
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;

function patternValidator(re: RegExp, errorKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim().toUpperCase();
    if (!value) {
      return null; // empty is handled by Validators.required
    }
    return re.test(value) ? null : { [errorKey]: true };
  };
}

export const panValidator = (): ValidatorFn => patternValidator(PAN_RE, 'pan');
export const gstinValidator = (): ValidatorFn => patternValidator(GSTIN_RE, 'gstin');
export const ifscValidator = (): ValidatorFn => patternValidator(IFSC_RE, 'ifsc');
export const cinValidator = (): ValidatorFn => patternValidator(CIN_RE, 'cin');
export const tanValidator = (): ValidatorFn => patternValidator(TAN_RE, 'tan');
export const pincodeValidator = (): ValidatorFn => patternValidator(PINCODE_RE, 'pincode');

/** 10-digit Indian mobile number starting 6-9. */
export const indianPhoneValidator = (): ValidatorFn =>
  patternValidator(INDIAN_PHONE_RE, 'phone');

/** 12-digit Aadhaar number (first digit 2-9). */
export const aadhaarValidator = (): ValidatorFn => patternValidator(AADHAAR_RE, 'aadhaar');

/** Optional website URL (http/https optional). */
export const urlValidator = (): ValidatorFn => patternValidator(URL_RE, 'url');

/** Strong password: min 8, ≥1 upper, ≥1 digit, ≥1 special character. */
export const passwordStrengthValidator = (): ValidatorFn => {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    if (!value) {
      return null;
    }
    const errors: ValidationErrors = {};
    if (value.length < 8) {
      errors['minlength'] = true;
    }
    if (!/[A-Z]/.test(value)) {
      errors['upper'] = true;
    }
    if (!/[0-9]/.test(value)) {
      errors['digit'] = true;
    }
    if (!/[^A-Za-z0-9]/.test(value)) {
      errors['special'] = true;
    }
    return Object.keys(errors).length ? { passwordStrength: errors } : null;
  };
};

/** Cross-field validator: confirm field must match the source field. */
export const matchValidator = (source: string, confirm: string): ValidatorFn => {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(source)?.value;
    const b = group.get(confirm)?.value;
    if (a == null || b == null || b === '') {
      return null;
    }
    return a === b ? null : { mismatch: true };
  };
};
