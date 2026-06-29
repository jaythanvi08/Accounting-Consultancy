import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { CompanyService } from './company.service';
import { DEFAULT_ACCOUNT_GROUPS } from '../constants/account-groups';
import { AccountGroup, AccountType, BalanceNature, Ledger } from '../models';

const DEFAULT_GROUP_IDS: ReadonlySet<string> = new Set(DEFAULT_ACCOUNT_GROUPS.map((g) => g.id));

export interface NewGroupInput {
  name: string;
  parentId: string;
  nature: BalanceNature;
  description?: string;
}

export type CategoryTotals = Record<AccountType, number>;

/**
 * Per-company store for the Chart of Accounts (groups) and ledgers.
 * Mock backend: signals + localStorage (keys `ledgerai.groups.<companyId>`,
 * `ledgerai.ledgers.<companyId>`). Call {@link sync} from a feature
 * component before reading, so the active company's data is loaded.
 */
@Injectable({ providedIn: 'root' })
export class LedgerService {
  private readonly storage = inject(StorageService);
  private readonly companies = inject(CompanyService);

  private readonly _groups = signal<AccountGroup[]>([]);
  private readonly _ledgers = signal<Ledger[]>([]);

  readonly groups = this._groups.asReadonly();
  readonly ledgers = this._ledgers.asReadonly();

  readonly ledgerCount = computed(() => this._ledgers().length);

  private companyId(): string {
    return this.companies.activeCompany()?.id ?? 'none';
  }
  private groupsKey(): string {
    return `ledgerai.groups.${this.companyId()}`;
  }
  private ledgersKey(): string {
    return `ledgerai.ledgers.${this.companyId()}`;
  }

  /** Load (and seed on first use) the active company's groups + ledgers into the signals. */
  sync(): void {
    let groups = this.storage.get<AccountGroup[]>(this.groupsKey());
    if (!groups || groups.length === 0) {
      groups = DEFAULT_ACCOUNT_GROUPS.map((g) => ({ ...g }));
      this.storage.set(this.groupsKey(), groups);
    }
    this._groups.set(groups);
    this._ledgers.set(this.storage.get<Ledger[]>(this.ledgersKey()) ?? []);
  }

  // ───────── Lookups ─────────
  getGroup(id: string): AccountGroup | undefined {
    return this._groups().find((g) => g.id === id);
  }
  getLedger(id: string): Ledger | undefined {
    return this._ledgers().find((l) => l.id === id);
  }
  groupName(id: string): string {
    return this.getGroup(id)?.name ?? '—';
  }
  childGroups(parentId: string | null): AccountGroup[] {
    return this._groups().filter((g) => g.parentId === parentId);
  }
  ledgersByGroup(groupId: string): Ledger[] {
    return this._ledgers().filter((l) => l.groupId === groupId);
  }

  /** Seeded default groups are protected from deletion. */
  isDefaultGroup(id: string): boolean {
    return DEFAULT_GROUP_IDS.has(id);
  }

  /** All descendant group ids (children, grandchildren …) for a group. */
  descendantGroupIds(groupId: string): string[] {
    const out: string[] = [];
    const walk = (id: string): void => {
      for (const child of this.childGroups(id)) {
        out.push(child.id);
        walk(child.id);
      }
    };
    walk(groupId);
    return out;
  }

  /** Ledger count for a group including all of its sub-groups. */
  groupLedgerCount(groupId: string): number {
    const ids = [groupId, ...this.descendantGroupIds(groupId)];
    return this._ledgers().filter((l) => ids.includes(l.groupId)).length;
  }

  /** Net opening balance (Dr +, Cr −) for a group including its sub-groups. */
  groupBalance(groupId: string): number {
    const ids = [groupId, ...this.descendantGroupIds(groupId)];
    return this._ledgers()
      .filter((l) => ids.includes(l.groupId))
      .reduce((sum, l) => sum + this.signedOpening(l), 0);
  }

  /** Sum of opening balances grouped by fundamental account type. */
  categoryTotals(): CategoryTotals {
    const totals: CategoryTotals = { Asset: 0, Liability: 0, Capital: 0, Income: 0, Expense: 0 };
    for (const l of this._ledgers()) {
      const type = this.getGroup(l.groupId)?.type;
      if (type) {
        totals[type] += l.openingBalance;
      }
    }
    return totals;
  }

  // ───────── Mutations ─────────
  createGroup(input: NewGroupInput): AccountGroup {
    const parent = this.getGroup(input.parentId);
    const group: AccountGroup = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      parentId: input.parentId,
      type: parent?.type ?? 'Asset',
      nature: input.nature,
      isPrimary: false,
      description: input.description?.trim() || undefined
    };
    this._groups.update((list) => [...list, group]);
    this.storage.set(this.groupsKey(), this._groups());
    return group;
  }

  /** Delete a non-default, empty group. Returns an error message, or null on success. */
  deleteGroup(id: string): string | null {
    if (this.isDefaultGroup(id)) {
      return 'Default groups cannot be deleted.';
    }
    if (this.childGroups(id).length > 0) {
      return 'Remove the sub-groups first.';
    }
    if (this.ledgersByGroup(id).length > 0) {
      return 'This group still has ledgers.';
    }
    this._groups.update((list) => list.filter((g) => g.id !== id));
    this.storage.set(this.groupsKey(), this._groups());
    return null;
  }

  createLedger(data: Omit<Ledger, 'id' | 'createdAt'>): Ledger {
    const ledger: Ledger = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this._ledgers.update((list) => [...list, ledger]);
    this.storage.set(this.ledgersKey(), this._ledgers());
    return ledger;
  }

  updateLedger(id: string, patch: Partial<Ledger>): void {
    this._ledgers.update((list) => list.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    this.storage.set(this.ledgersKey(), this._ledgers());
  }

  deleteLedger(id: string): void {
    this._ledgers.update((list) => list.filter((l) => l.id !== id));
    this.storage.set(this.ledgersKey(), this._ledgers());
  }

  /** Signed opening balance: +Dr / -Cr, useful for trial balance maths. */
  signedOpening(l: Ledger): number {
    return l.openingNature === 'Dr' ? l.openingBalance : -l.openingBalance;
  }

  natureOf(nature: BalanceNature): string {
    return nature === 'Dr' ? 'Debit' : 'Credit';
  }
}
