import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'padelsys-theme';

  isDark$ = new BehaviorSubject<boolean>(false);

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    this.applyTheme(isDark);
  }

  /** Alterna entre tema claro y oscuro. */
  toggle(): void {
    this.applyTheme(!this.isDark$.value);
  }

  /** Aplica el tema al DOM, persiste la preferencia y notifica el BehaviorSubject. */
  private applyTheme(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
    this.isDark$.next(dark);
  }
}
