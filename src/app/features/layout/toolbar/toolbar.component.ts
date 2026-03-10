import { Component, EventEmitter, Input, Output } from '@angular/core';

import { User } from '../../../core/models/user.model';
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

  constructor(public calcService: CalculatorService) {}

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

  toggleNotif(): void {
    this.isNotifOpen = !this.isNotifOpen;
  }

  closeNotif(): void {
    this.isNotifOpen = false;
  }
}
