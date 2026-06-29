import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { UiService } from '../services/ui.service';

/** Surfaces HTTP errors as toasts and rethrows for local handling. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const ui = inject(UiService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const message =
        err.error?.message ??
        (err.status === 0
          ? 'Network error — please check your connection.'
          : `Request failed (${err.status}).`);
      ui.toast(message, 'danger');
      return throwError(() => err);
    })
  );
};
