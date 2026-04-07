import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  SessionAlertService,
  SessionAlertType,
} from '../../core/services/session-alert.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-session-alert',
  templateUrl: './session-alert.component.html',
})
export class SessionAlertComponent implements OnInit, OnDestroy {
  visible = false;
  alertType: SessionAlertType = null;

  private sub = new Subscription();

  constructor(
    private sessionAlertService: SessionAlertService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.sessionAlertService.alert$
        .pipe(filter((t) => t !== null))
        .subscribe((type) => {
          this.alertType = type;
          this.visible = true;
        }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get title(): string {
    return this.alertType === 'SESSION_OVERRIDDEN'
      ? 'Sesión cerrada'
      : 'Sesión expirada';
  }

  get message(): string {
    return this.alertType === 'SESSION_OVERRIDDEN'
      ? 'Tu sesión fue cerrada porque se detectó un inicio de sesión en otro dispositivo.'
      : 'Tu sesión ha expirado por inactividad. Por favor, volvé a ingresar.';
  }

  get iconColor(): string {
    return this.alertType === 'SESSION_OVERRIDDEN'
      ? 'text-amber-500'
      : 'text-blue-500';
  }

  confirm(): void {
    this.visible = false;
    this.sessionAlertService.dismiss();
    this.authService.logout();
  }
}
