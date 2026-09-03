import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * CoreModule — instanciado UNA sola vez en AppModule.
 *
 * El JwtInterceptor se registra como `HttpInterceptorFn` funcional vía
 * `provideHttpClient(withInterceptors([jwtInterceptor]))` en `main.ts`,
 * no aquí.
 *
 * Servicios (AuthService, guards funcionales) usan providedIn: 'root'
 * → no necesitan declararse aquí.
 */
@NgModule({
  imports: [CommonModule],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule ya fue cargado. Solo importar en AppModule.');
    }
  }
}
