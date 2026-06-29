import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { UiService } from '../services/ui.service';

/** Increments/decrements the global loading counter around HTTP traffic. */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const ui = inject(UiService);
  ui.loadingStart();
  return next(req).pipe(finalize(() => ui.loadingStop()));
};
