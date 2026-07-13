import { TestBed } from '@angular/core/testing';
import { SessionAlertService } from './session-alert.service';

describe('SessionAlertService', () => {
  let service: SessionAlertService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionAlertService);
  });

  it('starts with no alert', (done) => {
    service.alert$.subscribe((v) => {
      expect(v).toBeNull();
      done();
    });
  });

  it('show() sets the alert type', (done) => {
    service.show('TOKEN_EXPIRED');
    service.alert$.subscribe((v) => {
      expect(v).toBe('TOKEN_EXPIRED');
      done();
    });
  });

  it('show() with SESSION_OVERRIDDEN sets that type', (done) => {
    service.show('SESSION_OVERRIDDEN');
    service.alert$.subscribe((v) => {
      expect(v).toBe('SESSION_OVERRIDDEN');
      done();
    });
  });

  it('dismiss() clears the alert back to null', (done) => {
    service.show('TOKEN_EXPIRED');
    service.dismiss();
    service.alert$.subscribe((v) => {
      expect(v).toBeNull();
      done();
    });
  });
});
