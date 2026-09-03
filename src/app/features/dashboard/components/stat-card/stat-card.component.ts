import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

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
    NgClass
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  readonly title = input('');
  readonly value = input('');
  readonly icon = input<StatCardIcon>('dollar-sign');
  readonly trend = input<StatCardTrend>();
  /** Clases extra para el borde/fondo del card (ej. 'border-destructive/50'). */
  readonly extraClass = input('');
}
