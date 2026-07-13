import { Component, Input } from '@angular/core';

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
  standalone: false,
  selector: 'app-stat-card',
  templateUrl: './stat-card.component.html',
})
export class StatCardComponent {
  @Input() title = '';
  @Input() value = '';
  @Input() icon: StatCardIcon = 'dollar-sign';
  @Input() trend?: StatCardTrend;
  /** Clases extra para el borde/fondo del card (ej. 'border-destructive/50'). */
  @Input() extraClass = '';
}
