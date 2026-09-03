import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';

import { ToastComponent } from './shared/toast/toast.component';
import { CalculatorComponent } from './shared/calculator/calculator.component';
import { SessionAlertComponent } from './shared/session-alert/session-alert.component';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [
    RouterOutlet,
    ToastComponent,
    CalculatorComponent,
    SessionAlertComponent
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'padel-frontend';
  readonly isRouting = signal(false);

  private sub = new Subscription();

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.sub.add(
      this.router.events.subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.isRouting.set(true);
        } else if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          this.isRouting.set(false);
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
