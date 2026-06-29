import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { CompanyService } from '../services/company.service';

/**
 * Ensures a company exists & is selected before entering accounting modules.
 * Routes the user to company creation otherwise.
 */
export const companyGuard: CanActivateFn = () => {
  const company = inject(CompanyService);
  const router = inject(Router);

  if (company.activeCompany()) {
    return true;
  }
  return router.createUrlTree(['/app/company/create']);
};
