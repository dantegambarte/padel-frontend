import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { Router } from '@angular/router';

import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { CalculatorService } from '../../../core/services/calculator.service';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
})
export class ToolbarComponent {
  @Input() title = '';
  @Input() currentUser: User | null = null;
  @Output() toggleMenu = new EventEmitter<void>();

  isNotifOpen = false;
  isUserMenuOpen = false;

  constructor(
    public calcService: CalculatorService,
    private router: Router,
    public authService: AuthService,
  ) {}

  /** Devuelve las dos primeras iniciales del nombre completo del usuario, en mayúsculas. */
  get userInitials(): string {
    const name = this.currentUser?.fullName ?? '';
    return name
      .trim()
      .split(/\s+/)
      .filter((n) => n.length > 0)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /** Navega a la página de cuenta del usuario. */
  goToAccount(): void {
    this.isUserMenuOpen = false;
    this.router.navigate(['/app/account']);
  }

  /** Alterna el menú desplegable del usuario. */
  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
    if (this.isUserMenuOpen) this.isNotifOpen = false;
  }

  /** Cierra el menú desplegable del usuario. */
  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  /** Cierra la sesión del usuario. */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isUserMenuOpen = false;
    this.isNotifOpen = false;
  }

  /** Alterna la visibilidad del panel de notificaciones. */
  toggleNotif(): void {
    this.isNotifOpen = !this.isNotifOpen;
  }

  /** Cierra el panel de notificaciones. */
  closeNotif(): void {
    this.isNotifOpen = false;
  }
}
