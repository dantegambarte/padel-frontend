import { TestBed } from '@angular/core/testing';
import { HolidayService } from './holiday.service';

describe('HolidayService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to false when nothing is persisted', () => {
    const service = TestBed.inject(HolidayService);
    expect(service.isHoliday).toBe(false);
  });

  it('reads the persisted value on construction', () => {
    localStorage.setItem('padelsys-holiday-mode', 'true');
    const service = TestBed.inject(HolidayService);
    expect(service.isHoliday).toBe(true);
  });

  it('toggle() flips the state and persists it', () => {
    const service = TestBed.inject(HolidayService);
    service.toggle();
    expect(service.isHoliday).toBe(true);
    expect(localStorage.getItem('padelsys-holiday-mode')).toBe('true');

    service.toggle();
    expect(service.isHoliday).toBe(false);
    expect(localStorage.getItem('padelsys-holiday-mode')).toBe('false');
  });

  it('isHoliday$ emits the toggled value', (done) => {
    const service = TestBed.inject(HolidayService);
    service.toggle();
    service.isHoliday$.subscribe((v) => {
      expect(v).toBe(true);
      done();
    });
  });
});
