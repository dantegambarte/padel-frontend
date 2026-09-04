import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'padelsys-theme';

  private readonly isDarkSignal = signal<boolean>(false);

  /** Signal readonly con el estado actual del tema (true = oscuro). */
  readonly isDark = this.isDarkSignal.asReadonly();

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
    this.applyTheme(!this.isDarkSignal());
  }

  /** Aplica el tema al DOM, persiste la preferencia y notifica el signal. */
  private applyTheme(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
    this.isDarkSignal.set(dark);
  }
}
