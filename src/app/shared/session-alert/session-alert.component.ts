import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  SessionAlertService,
  SessionAlertType,
} from '../../core/services/session-alert.service';
import { AuthService } from '../../core/services/auth.service';
import { NgClass } from '@angular/common';

@Component({
    selector: 'app-session-alert',
    templateUrl: './session-alert.component.html',
    imports: [NgClass],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionAlertComponent implements OnInit, OnDestroy {
  private sessionAlertService = inject(SessionAlertService);
  private authService = inject(AuthService);

  visible = signal(false);
  alertType = signal<SessionAlertType>(null);

  private sub = new Subscription();

  ngOnInit(): void {
    this.sub.add(
      this.sessionAlertService.alert$
        .pipe(filter((t) => t !== null))
        .subscribe((type) => {
          this.alertType.set(type);
          this.visible.set(true);
        }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  title = computed(() =>
    this.alertType() === 'SESSION_OVERRIDDEN' ? 'Sesión cerrada' : 'Sesión expirada',
  );

  message = computed(() =>
    this.alertType() === 'SESSION_OVERRIDDEN'
      ? 'Tu sesión fue cerrada porque se detectó un inicio de sesión en otro dispositivo.'
      : 'Tu sesión ha expirado por inactividad. Por favor, volvé a ingresar.',
  );

  iconColor = computed(() =>
    this.alertType() === 'SESSION_OVERRIDDEN' ? 'text-amber-500' : 'text-blue-500',
  );

  confirm(): void {
    this.visible.set(false);
    this.sessionAlertService.dismiss();
    this.authService.logout();
  }
}
