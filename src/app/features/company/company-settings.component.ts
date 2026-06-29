import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CompanyService } from '../../core/services/company.service';
import { UiService } from '../../core/services/ui.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { indianPhoneValidator } from '../../shared/validators/statutory.validators';

@Component({
  selector: 'app-company-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeaderComponent, RouterLink],
  template: `
    <div class="fade-in">
      <app-page-header title="Company Settings" subtitle="Manage the active company profile" icon="bi-gear" />

      @if (company.activeCompany(); as c) {
        <form [formGroup]="form" (ngSubmit)="save()" class="card">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-8">
                <label class="form-label">Company Name<span class="required-mark">*</span></label>
                <input class="form-control" formControlName="name" />
              </div>
              <div class="col-md-4">
                <label class="form-label">Base Currency</label>
                <input class="form-control" [value]="c.baseCurrency" disabled />
              </div>
              <div class="col-md-8">
                <label class="form-label">Mailing Name<span class="required-mark">*</span></label>
                <input class="form-control" formControlName="mailingName" />
              </div>
              <div class="col-md-4">
                <label class="form-label">Phone</label>
                <input class="form-control" formControlName="phone" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Email</label>
                <input class="form-control" formControlName="email" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Website</label>
                <input class="form-control" formControlName="website" />
              </div>
            </div>
          </div>
          <div class="card-footer d-flex justify-content-between">
            <a routerLink="/app/company/create" class="btn btn-outline-primary btn-sm">
              <i class="bi bi-plus-lg me-1"></i>Create another company
            </a>
            <button class="btn btn-primary" type="submit"><i class="bi bi-save me-1"></i>Save changes</button>
          </div>
        </form>
      } @else {
        <div class="surface-card p-5 text-center">
          <p class="mb-3">No active company yet.</p>
          <a routerLink="/app/company/create" class="btn btn-primary">Create your first company</a>
        </div>
      }
    </div>
  `
})
export class CompanySettingsComponent {
  private readonly fb = inject(FormBuilder);
  readonly company = inject(CompanyService);
  private readonly ui = inject(UiService);

  private readonly active = this.company.activeCompany();

  readonly form = this.fb.nonNullable.group({
    name: [this.active?.name ?? '', [Validators.required]],
    mailingName: [this.active?.mailingName ?? '', [Validators.required]],
    phone: [this.active?.phone ?? '', [indianPhoneValidator()]],
    email: [this.active?.email ?? '', [Validators.email]],
    website: [this.active?.website ?? '']
  });

  save(): void {
    if (!this.active || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.company.update(this.active.id, this.form.getRawValue());
    this.ui.toast('Company settings saved.', 'success');
  }
}
