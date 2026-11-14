import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/**
 * Full page load bypassing the Angular router: `url` loads that path from the
 * server, `null` reloads the current page. Injectable so tests can spy on it.
 */
export const APP_NAVIGATE_HARD = new InjectionToken<(url: string | null) => void>(
  'APP_NAVIGATE_HARD',
  {
    providedIn: 'root',
    factory: () => {
      const location = inject(DOCUMENT).location;
      return (url) => (url === null ? location.reload() : location.assign(url));
    },
  },
);

/**
 * Moves clients off a stale bundle after a deploy. A new version is applied on
 * the next in-app navigation (not immediately) so a form or sale in progress
 * is not wiped; an unrecoverable service worker reloads right away.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly router = inject(Router);
  private readonly navigateHard = inject(APP_NAVIGATE_HARD);
  private readonly destroyRef = inject(DestroyRef);
  private updateReady = false;

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(
        filter((event) => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => (this.updateReady = true));

    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.navigateHard(null));

    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        filter(() => this.updateReady),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.navigateHard(event.url));
  }
}
