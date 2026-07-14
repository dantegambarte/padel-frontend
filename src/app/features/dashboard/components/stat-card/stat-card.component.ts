import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass, NgSwitch, NgSwitchCase, NgIf } from '@angular/common';

export type StatCardIcon =
  | 'dollar-sign'
  | 'trending-up'
  | 'calendar'
  | 'users'
  | 'clock'
  | 'alert-triangle'
  | 'shopping-cart';

export interface StatCardTrend {
  value: string;
  positive: boolean;
}

@Component({
    selector: 'app-stat-card',
    templateUrl: './stat-card.component.html',
    imports: [
        NgClass,
        NgSwitch,
        NgSwitchCase,
        NgIf,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  @Input() title = '';
  @Input() value = '';
  @Input() icon: StatCardIcon = 'dollar-sign';
  @Input() trend?: StatCardTrend;
  /** Clases extra para el borde/fondo del card (ej. 'border-destructive/50'). */
  @Input() extraClass = '';
}
