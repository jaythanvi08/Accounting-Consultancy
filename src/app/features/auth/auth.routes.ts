import { Routes } from '@angular/router';
import { AuthComponent } from './auth.component';
import { ForgotPasswordComponent } from './forgot-password.component';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: AuthComponent, data: { mode: 'login' }, title: 'Login · LedgerAI' },
  { path: 'register', component: AuthComponent, data: { mode: 'register' }, title: 'Register · LedgerAI' },
  { path: 'forgot-password', component: ForgotPasswordComponent, title: 'Reset Password · LedgerAI' },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];
