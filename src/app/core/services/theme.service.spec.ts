import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let matchMediaSpy: jasmine.Spy;

  function mockMatchMedia(prefersDark: boolean): void {
    matchMediaSpy = spyOn(window, 'matchMedia').and.returnValue({
      matches: prefersDark,
    } as MediaQueryList);
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('falls back to the OS preference when nothing is persisted (dark)', () => {
    mockMatchMedia(true);
    const service = TestBed.inject(ThemeService);
    expect(service.isDark$.value).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('falls back to the OS preference when nothing is persisted (light)', () => {
    mockMatchMedia(false);
    const service = TestBed.inject(ThemeService);
    expect(service.isDark$.value).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('prefers the persisted value over the OS preference', () => {
    mockMatchMedia(false);
    localStorage.setItem('padelsys-theme', 'dark');
    const service = TestBed.inject(ThemeService);
    expect(service.isDark$.value).toBe(true);
  });

  it('toggle() flips the theme, updates the DOM class and persists it', () => {
    mockMatchMedia(false);
    const service = TestBed.inject(ThemeService);

    service.toggle();
    expect(service.isDark$.value).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('padelsys-theme')).toBe('dark');

    service.toggle();
    expect(service.isDark$.value).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('padelsys-theme')).toBe('light');
  });
});
