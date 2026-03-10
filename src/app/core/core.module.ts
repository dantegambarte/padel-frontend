import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { JwtInterceptor } from './interceptors/jwt.interceptor';

/**
 * CoreModule — instanciado UNA sola vez en AppModule.
 * Registra el JwtInterceptor globalmente.
 *
 * Servicios (AuthService, AuthGuard) usan providedIn: 'root'
 * → no necesitan declararse aquí.
 */
@NgModule({
  imports: [CommonModule],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true,
    },
  ],
})
export class CoreModule {
  // Previene importación accidental en feature modules
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule ya fue cargado. Solo importar en AppModule.');
    }
  }
}
