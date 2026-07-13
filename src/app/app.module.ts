import { registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import localeEsAR from '@angular/common/locales/es-AR';
import { LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { ToastComponent } from './shared/toast/toast.component';
import { CalculatorComponent } from './shared/calculator/calculator.component';
import { SessionAlertComponent } from './shared/session-alert/session-alert.component';


registerLocaleData(localeEsAR);

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    CoreModule,
    ToastComponent,
    CalculatorComponent,
    SessionAlertComponent,
],
  providers: [{ provide: LOCALE_ID, useValue: 'es-AR' }],
  bootstrap: [AppComponent],
})
export class AppModule {}
