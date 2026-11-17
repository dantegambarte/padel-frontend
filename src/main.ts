import { registerLocaleData } from '@angular/common';
import localeEsAR from '@angular/common/locales/es-AR';
import {
  LOCALE_ID,
  inject,
  isDevMode,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { jwtInterceptor } from './app/core/interceptors/jwt.interceptor';
import { timeoutInterceptor } from './app/core/interceptors/timeout.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { providePrimeNG } from 'primeng/config';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { AuthService } from './app/core/services/auth.service';

registerLocaleData(localeEsAR);

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    provideHttpClient(withInterceptors([jwtInterceptor, timeoutInterceptor])),
    provideCharts(withDefaultRegisterables()),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    { provide: LOCALE_ID, useValue: 'es-AR' },
    // The access token lives only in memory, so after a reload trade the
    // HttpOnly refresh cookie for a new one before the first navigation.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // 'none' = sin CSS de tema propio; los componentes PrimeNG heredan
    // exclusivamente las variables --accent/--background/etc. de styles.scss.
    providePrimeNG({ theme: 'none' }),
  ],
}).catch((err) => console.error(err));
