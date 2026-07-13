import { registerLocaleData } from '@angular/common';
import localeEsAR from '@angular/common/locales/es-AR';
import { LOCALE_ID, importProvidersFrom } from '@angular/core';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app/app-routing.module';
import { CoreModule } from './app/core/core.module';
import { AppComponent } from './app/app.component';

registerLocaleData(localeEsAR);

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(BrowserModule, BrowserAnimationsModule, HttpClientModule, AppRoutingModule, CoreModule),
        { provide: LOCALE_ID, useValue: 'es-AR' }
    ]
})
  .catch((err) => console.error(err));
