import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { SwUpdate, VersionEvent, UnrecoverableStateEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService, APP_NAVIGATE_HARD } from './app-update.service';

describe('AppUpdateService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<UnrecoverableStateEvent>;
  let routerEvents: Subject<unknown>;
  let navigateHard: jasmine.Spy;
  let isEnabled: boolean;

  function setup(): AppUpdateService {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: { isEnabled, versionUpdates, unrecoverable },
        },
        { provide: Router, useValue: { events: routerEvents } },
        { provide: APP_NAVIGATE_HARD, useValue: navigateHard },
      ],
    });
    const service = TestBed.inject(AppUpdateService);
    service.init();
    return service;
  }

  const versionReady = (): VersionEvent => ({
    type: 'VERSION_READY',
    currentVersion: { hash: 'old' },
    latestVersion: { hash: 'new' },
  });

  beforeEach(() => {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    routerEvents = new Subject();
    navigateHard = jasmine.createSpy('navigateHard');
    isEnabled = true;
  });

  it('does not reload while no new version is ready', () => {
    setup();
    routerEvents.next(new NavigationStart(1, '/app/cash-register'));
    expect(navigateHard).not.toHaveBeenCalled();
  });

  it('loads the next route from the server once a new version is ready', () => {
    setup();
    versionUpdates.next(versionReady());
    expect(navigateHard).not.toHaveBeenCalled();

    routerEvents.next(new NavigationStart(1, '/app/cash-register'));
    expect(navigateHard).toHaveBeenCalledOnceWith('/app/cash-register');
  });

  it('ignores version events other than VERSION_READY', () => {
    setup();
    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } });
    routerEvents.next(new NavigationStart(1, '/app/pos'));
    expect(navigateHard).not.toHaveBeenCalled();
  });

  it('reloads the current page when the service worker is unrecoverable', () => {
    setup();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'broken cache' });
    expect(navigateHard).toHaveBeenCalledOnceWith(null);
  });

  it('does nothing when the service worker is disabled', () => {
    isEnabled = false;
    setup();
    versionUpdates.next(versionReady());
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'x' });
    routerEvents.next(new NavigationStart(1, '/app/pos'));
    expect(navigateHard).not.toHaveBeenCalled();
  });
});
