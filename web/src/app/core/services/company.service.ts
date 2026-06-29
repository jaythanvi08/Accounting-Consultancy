import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { Company } from '../models';

const COMPANIES_KEY = 'ledgerai.companies';
const ACTIVE_KEY = 'ledgerai.activeCompany';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);

  private readonly _companies = signal<Company[]>(this.storage.get<Company[]>(COMPANIES_KEY) ?? []);
  private readonly _activeId = signal<string | null>(this.storage.get<string>(ACTIVE_KEY));

  /** Companies owned by the signed-in user. */
  readonly companies = computed(() => {
    const uid = this.auth.currentUser()?.id;
    return this._companies().filter((c) => !uid || c.ownerId === uid);
  });

  readonly activeCompany = computed<Company | null>(
    () => this.companies().find((c) => c.id === this._activeId()) ?? null
  );

  readonly hasCompany = computed(() => this.companies().length > 0);

  create(data: Omit<Company, 'id' | 'createdAt' | 'ownerId'>): Company {
    const company: Company = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ownerId: this.auth.currentUser()?.id ?? 'anonymous'
    };
    const next = [...this._companies(), company];
    this._companies.set(next);
    this.storage.set(COMPANIES_KEY, next);
    this.select(company.id);
    return company;
  }

  update(id: string, patch: Partial<Company>): void {
    const next = this._companies().map((c) => (c.id === id ? { ...c, ...patch } : c));
    this._companies.set(next);
    this.storage.set(COMPANIES_KEY, next);
  }

  select(id: string): void {
    this._activeId.set(id);
    this.storage.set(ACTIVE_KEY, id);
  }

  remove(id: string): void {
    const next = this._companies().filter((c) => c.id !== id);
    this._companies.set(next);
    this.storage.set(COMPANIES_KEY, next);
    if (this._activeId() === id) {
      this._activeId.set(next[0]?.id ?? null);
      this.storage.set(ACTIVE_KEY, this._activeId());
    }
  }
}
