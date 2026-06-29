import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LedgerService } from '../../core/services/ledger.service';
import { UiService } from '../../core/services/ui.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IndianNumberPipe } from '../../shared/pipes/indian-number.pipe';
import {
  CategoryMeta,
  LEDGER_CATEGORIES,
  LedgerCategory,
  categoryOf
} from '../../core/constants/account-groups';
import { AccountGroup, BalanceNature } from '../../core/models';

interface CategoryNode {
  meta: CategoryMeta;
  groups: AccountGroup[];
}

@Component({
  selector: 'app-ledger-groups',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, IndianNumberPipe],
  styles: [
    `
      /* ── Accounting equation ── */
      .equation {
        display: grid;
        grid-template-columns: 1fr auto 1fr auto 1fr;
        gap: 0.75rem;
        align-items: stretch;
        margin-bottom: 1.25rem;
      }
      .eq-box {
        border-radius: var(--radius);
        padding: 0.9rem 1rem;
        text-align: center;
        border: 1px solid var(--border);
        box-shadow: var(--shadow-sm);
      }
      .eq-box small { display: block; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.8; }
      .eq-box .val { font-family: var(--font-mono); font-size: 1.25rem; font-weight: 700; }
      .eq-op { display: flex; align-items: center; font-size: 1.6rem; font-weight: 700; color: var(--text-secondary); }
      .eq-a { background: rgba(46, 95, 138, 0.1); color: var(--info); }
      .eq-l { background: rgba(178, 34, 34, 0.1); color: var(--danger); }
      .eq-c { background: rgba(26, 122, 74, 0.1); color: var(--success); }
      @media (max-width: 720px) {
        .equation { grid-template-columns: 1fr; }
        .eq-op { justify-content: center; }
      }

      /* ── Tree ── */
      .tree-cat { border-left: 4px solid var(--cat); border-radius: var(--radius-sm); background: var(--card-bg); margin-bottom: 0.75rem; box-shadow: var(--shadow-sm); overflow: hidden; }
      .tree-cat__head { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 0.9rem; font-family: var(--font-heading); font-weight: 600; color: var(--cat); cursor: pointer; user-select: none; }
      .tree-cat__count { margin-left: auto; font-size: 0.72rem; font-weight: 600; color: var(--text-muted); background: var(--surface); border-radius: 999px; padding: 0.1rem 0.55rem; }
      .tree-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.9rem 0.5rem 2.2rem; border-top: 1px solid var(--border); }
      .tree-row.sel { background: var(--surface); }
      .tree-row__name { font-weight: 500; cursor: pointer; }
      .tree-row__name:hover { color: var(--primary); text-decoration: underline; }
      .tree-leaf { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.9rem 0.4rem 3.6rem; border-top: 1px dashed var(--border); font-size: 0.88rem; }
      .tree-empty { padding: 0.4rem 0.9rem 0.5rem 3.6rem; border-top: 1px dashed var(--border); color: var(--text-muted); font-size: 0.82rem; font-style: italic; }
      .chev { transition: transform var(--transition); cursor: pointer; }
      .chev.open { transform: rotate(90deg); }

      /* ── Modal ── */
      .modal-backdrop-c { position: fixed; inset: 0; background: rgba(15, 34, 56, 0.45); display: grid; place-items: center; z-index: 1060; padding: 1rem; }
      .modal-card { background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; max-width: 480px; }
      .modal-card__head { padding: 0.9rem 1.1rem; border-bottom: 1px solid var(--border); font-family: var(--font-heading); font-weight: 600; display: flex; align-items: center; justify-content: space-between; }
      .modal-card__body { padding: 1.1rem; }
      .modal-card__foot { padding: 0.8rem 1.1rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 0.5rem; }
    `
  ],
  template: `
    <div class="fade-in">
      <app-page-header
        title="Ledger Groups"
        subtitle="Classify ledgers per NCERT — Accounting Equation: A = L + C"
        icon="bi-diagram-3"
      >
        <button class="btn btn-primary btn-sm" (click)="openNewGroup(null)">
          <i class="bi bi-plus-lg me-1"></i>New Group
        </button>
      </app-page-header>

      <!-- ── Live Accounting Equation widget ── -->
      <div class="equation">
        <div class="eq-box eq-a">
          <small>A · Assets</small>
          <span class="val">₹{{ assets() | indianNumber: 0 }}</span>
        </div>
        <div class="eq-op">=</div>
        <div class="eq-box eq-l">
          <small>L · Liabilities</small>
          <span class="val">₹{{ liabilities() | indianNumber: 0 }}</span>
        </div>
        <div class="eq-op">+</div>
        <div class="eq-box eq-c">
          <small>C · Capital</small>
          <span class="val">₹{{ capital() | indianNumber: 0 }}</span>
        </div>
      </div>
      <p class="small mb-3" [class.text-success]="balanced()" [class.text-danger]="!balanced()">
        <i class="bi" [class.bi-check-circle-fill]="balanced()" [class.bi-exclamation-triangle-fill]="!balanced()"></i>
        @if (balanced()) { Equation balances. }
        @else { Difference of ₹{{ difference() | indianNumber }} (Capital includes Income − Expenses). }
      </p>

      <!-- ── Group Summary card (when a group is selected) ── -->
      @if (selected(); as g) {
        <div class="card mb-3" [style.border-left]="'4px solid ' + colorOf(g)">
          <div class="card-body d-flex flex-wrap align-items-center gap-4">
            <div>
              <div class="text-muted small">Group</div>
              <div class="h6 mb-0">{{ g.name }}
                @if (ledgers.isDefaultGroup(g.id)) {<span class="badge bg-soft-primary text-primary ms-1">default</span>}
              </div>
              @if (g.description) {<div class="small text-muted">{{ g.description }}</div>}
            </div>
            <div><div class="text-muted small">Category</div><div class="fw-semibold" [style.color]="colorOf(g)">{{ categoryLabel(g) }}</div></div>
            <div><div class="text-muted small">Nature</div><div class="fw-semibold">{{ g.nature === 'Dr' ? 'Debit' : 'Credit' }}</div></div>
            <div><div class="text-muted small">Total Ledgers</div><div class="fw-semibold mono">{{ ledgers.groupLedgerCount(g.id) }}</div></div>
            <div><div class="text-muted small">Total Balance</div><div class="fw-semibold mono">₹{{ absBalance(g.id) | indianNumber }} {{ balanceSide(g.id) }}</div></div>
            <div class="ms-auto d-flex gap-2">
              <button class="btn btn-outline-primary btn-sm" (click)="drill(g.id)"><i class="bi bi-box-arrow-up-right me-1"></i>View Ledgers</button>
              <button class="btn btn-outline-secondary btn-sm" (click)="openNewGroup(g.id)"><i class="bi bi-plus-lg me-1"></i>Sub-Group</button>
              @if (!ledgers.isDefaultGroup(g.id)) {
                <button class="btn btn-outline-danger btn-sm" (click)="remove(g)"><i class="bi bi-trash"></i></button>
              }
            </div>
          </div>
        </div>
      }

      <!-- ── Tree ── -->
      @for (cat of tree(); track cat.meta.key) {
        <div class="tree-cat" [style.--cat]="cat.meta.color">
          <div class="tree-cat__head" (click)="toggle(cat.meta.key)">
            <i class="bi bi-chevron-right chev" [class.open]="isOpen(cat.meta.key)"></i>
            <i class="bi {{ cat.meta.icon }}"></i>
            {{ cat.meta.label }}
            <span class="tree-cat__count">{{ cat.groups.length }} groups</span>
          </div>

          @if (isOpen(cat.meta.key)) {
            @for (g of cat.groups; track g.id) {
              <div class="tree-row" [class.sel]="selected()?.id === g.id">
                <i class="bi bi-chevron-right chev" [class.open]="isOpen(g.id)" (click)="toggle(g.id)"></i>
                <i class="bi bi-folder2-open" [style.color]="cat.meta.color"></i>
                <span class="tree-row__name" (click)="select(g)">{{ g.name }}</span>
                @if (!g.isPrimary) {<span class="badge bg-soft-primary text-primary ms-1">sub</span>}
                <span class="ms-auto d-flex gap-2 align-items-center">
                  <span class="badge bg-soft-accent text-accent">{{ ledgers.groupLedgerCount(g.id) }} ledgers</span>
                  <button class="btn btn-outline-secondary btn-sm py-0" (click)="openNewGroup(g.id)" title="Add sub-group">
                    <i class="bi bi-plus-lg"></i>
                  </button>
                </span>
              </div>

              @if (isOpen(g.id)) {
                @for (sg of ledgers.childGroups(g.id); track sg.id) {
                  <div class="tree-leaf">
                    <i class="bi bi-folder" [style.color]="cat.meta.color"></i>
                    <span class="fw-medium tree-row__name" (click)="select(sg)">{{ sg.name }}</span>
                    @if (!ledgers.isDefaultGroup(sg.id)) {
                      <button class="btn btn-outline-danger btn-sm py-0 ms-1" (click)="remove(sg)" title="Delete"><i class="bi bi-trash"></i></button>
                    }
                    <span class="badge bg-soft-accent text-accent ms-1">{{ ledgers.ledgersByGroup(sg.id).length }}</span>
                  </div>
                }
                @for (l of ledgers.ledgersByGroup(g.id); track l.id) {
                  <div class="tree-leaf">
                    <i class="bi bi-journal-text text-muted"></i>
                    <a [routerLink]="['/app/ledger/statement', l.id]" class="text-decoration-none">{{ l.name }}</a>
                    <span class="ms-auto mono">{{ l.openingBalance | indianNumber }}
                      <span class="badge" [class.bg-soft-success]="l.openingNature === 'Dr'" [class.text-success]="l.openingNature === 'Dr'"
                            [class.bg-soft-danger]="l.openingNature === 'Cr'" [class.text-danger]="l.openingNature === 'Cr'">{{ l.openingNature }}</span>
                    </span>
                  </div>
                }
                @if (ledgers.childGroups(g.id).length === 0 && ledgers.ledgersByGroup(g.id).length === 0) {
                  <div class="tree-empty">No ledgers yet — add one from “New Ledger”.</div>
                }
              }
            }
          }
        </div>
      }
    </div>

    <!-- ── New Group modal ── -->
    @if (showModal()) {
      <div class="modal-backdrop-c" (click)="closeModal()">
        <form class="modal-card" [formGroup]="form" (ngSubmit)="saveGroup()" (click)="$event.stopPropagation()">
          <div class="modal-card__head">
            <span><i class="bi bi-diagram-3 me-2 text-accent"></i>New Group</span>
            <button type="button" class="btn-close" (click)="closeModal()"></button>
          </div>
          <div class="modal-card__body">
            <div class="mb-3">
              <label class="form-label">Group Name<span class="required-mark">*</span></label>
              <input class="form-control" formControlName="name" placeholder="e.g. Vehicles, Sundry Creditors"
                     [class.is-invalid]="invalid('name')" />
              @if (invalid('name')) {<div class="invalid-feedback d-block">Group name is required.</div>}
            </div>
            <div class="mb-3">
              <label class="form-label">Parent Group<span class="required-mark">*</span></label>
              <select class="form-select" formControlName="parentId" (change)="onParentChange()"
                      [class.is-invalid]="invalid('parentId')">
                <option value="" disabled>Select parent…</option>
                @for (opt of parentOptions(); track opt.category) {
                  <optgroup [label]="opt.category">
                    @for (g of opt.groups; track g.id) {<option [value]="g.id">{{ g.name }}</option>}
                  </optgroup>
                }
              </select>
              @if (invalid('parentId')) {<div class="invalid-feedback d-block">Select a parent group.</div>}
            </div>
            <div class="mb-3">
              <label class="form-label d-block">Nature</label>
              <div class="d-flex gap-4 pt-1">
                <label class="d-inline-flex align-items-center gap-2">
                  <input class="form-check-input mt-0" type="radio" formControlName="nature" value="Dr" /> Debit (Dr)
                </label>
                <label class="d-inline-flex align-items-center gap-2">
                  <input class="form-check-input mt-0" type="radio" formControlName="nature" value="Cr" /> Credit (Cr)
                </label>
              </div>
            </div>
            <div>
              <label class="form-label">Description</label>
              <textarea class="form-control" rows="2" formControlName="description"></textarea>
            </div>
          </div>
          <div class="modal-card__foot">
            <button type="button" class="btn btn-outline-secondary" (click)="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary"><i class="bi bi-check2 me-1"></i>Create Group</button>
          </div>
        </form>
      </div>
    }
  `
})
export class LedgerGroupsComponent {
  readonly ledgers = inject(LedgerService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  private readonly expanded = signal<Set<string>>(new Set(LEDGER_CATEGORIES.map((c) => c.key)));
  readonly selected = signal<AccountGroup | null>(null);
  readonly showModal = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    parentId: ['', [Validators.required]],
    nature: ['Dr' as BalanceNature, [Validators.required]],
    description: ['']
  });

  readonly tree = computed<CategoryNode[]>(() => {
    const primary = this.ledgers.groups().filter((g) => g.parentId === null);
    return LEDGER_CATEGORIES.map((meta) => ({
      meta,
      groups: primary.filter((g) => categoryOf(g.type) === (meta.key as LedgerCategory))
    }));
  });

  readonly parentOptions = computed(() => {
    const all = this.ledgers.groups();
    return LEDGER_CATEGORIES.map((c) => ({
      category: c.label,
      groups: all.filter((g) => categoryOf(g.type) === c.key)
    })).filter((o) => o.groups.length > 0);
  });

  // ── Live accounting equation ──
  readonly assets = computed(() => this.ledgers.categoryTotals().Asset);
  readonly liabilities = computed(() => this.ledgers.categoryTotals().Liability);
  readonly capital = computed(() => {
    const t = this.ledgers.categoryTotals();
    return t.Capital + t.Income - t.Expense; // closing capital incl. P&L
  });
  readonly difference = computed(() => Math.abs(this.assets() - (this.liabilities() + this.capital())));
  readonly balanced = computed(() => this.difference() < 1);

  constructor() {
    this.ledgers.sync();
  }

  isOpen(id: string): boolean {
    return this.expanded().has(id);
  }
  toggle(id: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  select(g: AccountGroup): void {
    this.selected.set(this.selected()?.id === g.id ? null : g);
  }

  colorOf(g: AccountGroup): string {
    return LEDGER_CATEGORIES.find((c) => c.key === categoryOf(g.type))?.color ?? 'var(--primary)';
  }
  categoryLabel(g: AccountGroup): string {
    return LEDGER_CATEGORIES.find((c) => c.key === categoryOf(g.type))?.label ?? '';
  }
  absBalance(groupId: string): number {
    return Math.abs(this.ledgers.groupBalance(groupId));
  }
  balanceSide(groupId: string): string {
    const b = this.ledgers.groupBalance(groupId);
    return b === 0 ? '' : b > 0 ? 'Dr' : 'Cr';
  }

  drill(groupId: string): void {
    this.router.navigate(['/app/ledger/list'], { queryParams: { group: groupId } });
  }

  // ── Modal ──
  openNewGroup(parentId: string | null): void {
    this.form.reset({ name: '', parentId: parentId ?? '', nature: 'Dr', description: '' });
    if (parentId) {
      this.onParentChange();
    }
    this.showModal.set(true);
  }
  closeModal(): void {
    this.showModal.set(false);
  }
  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }
  onParentChange(): void {
    const parent = this.ledgers.getGroup(this.form.controls.parentId.value);
    if (parent) {
      this.form.controls.nature.setValue(parent.nature);
    }
  }
  saveGroup(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.ui.toast('Please complete the required fields.', 'warning');
      return;
    }
    const v = this.form.getRawValue();
    const g = this.ledgers.createGroup({
      name: v.name,
      parentId: v.parentId,
      nature: v.nature,
      description: v.description
    });
    this.ui.toast(`Group “${g.name}” created.`, 'success');
    this.expanded.update((set) => new Set(set).add(v.parentId));
    this.closeModal();
  }

  remove(g: AccountGroup): void {
    if (!confirm(`Delete group “${g.name}”?`)) {
      return;
    }
    const error = this.ledgers.deleteGroup(g.id);
    if (error) {
      this.ui.toast(error, 'danger');
      return;
    }
    if (this.selected()?.id === g.id) {
      this.selected.set(null);
    }
    this.ui.toast(`Group “${g.name}” deleted.`, 'info');
  }
}
