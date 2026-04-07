import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'padel-frontend';
  isRouting = false;

  private sub = new Subscription();

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.sub.add(
      this.router.events.subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.isRouting = true;
        } else if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          this.isRouting = false;
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
