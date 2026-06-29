import { Pipe, PipeTransform } from '@angular/core';
import { AccountType } from '../../core/models';

/** Format account type (Asset/Liability/Capital/Income/Expense) with label and icon. */
@Pipe({ name: 'accountType', standalone: true })
export class AccountTypePipe implements PipeTransform {
  transform(value: AccountType | null | undefined, format: 'label' | 'icon' | 'color' = 'label'): string {
    if (!value) return '';

    const meta = this.getTypeMeta(value);
    return format === 'icon' ? meta.icon : format === 'color' ? meta.color : meta.label;
  }

  private getTypeMeta(type: AccountType): { label: string; icon: string; color: string } {
    switch (type) {
      case 'Asset':
        return { label: 'Asset', icon: 'bi-box-seam', color: 'var(--info)' };
      case 'Liability':
        return { label: 'Liability', icon: 'bi-bank', color: 'var(--danger)' };
      case 'Capital':
        return { label: 'Capital', icon: 'bi-person-badge', color: 'var(--success)' };
      case 'Income':
        return { label: 'Income', icon: 'bi-graph-up-arrow', color: 'var(--success)' };
      case 'Expense':
        return { label: 'Expense', icon: 'bi-graph-down-arrow', color: 'var(--warning)' };
      default:
        return { label: type, icon: 'bi-question-circle', color: 'var(--text-muted)' };
    }
  }
}
