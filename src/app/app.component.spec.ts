import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { SwUpdate } from '@angular/service-worker';
import { AppComponent } from './app.component';

@Component({ selector: 'app-toast', template: '' })
class ToastStubComponent {}

@Component({ selector: 'app-calculator', template: '' })
class CalculatorStubComponent {}

@Component({ selector: 'app-session-alert', template: '' })
class SessionAlertStubComponent {}

describe('AppComponent', () => {
  beforeEach(async () => {
    TestBed.overrideComponent(AppComponent, {
      set: {
        imports: [RouterOutlet, ToastStubComponent, CalculatorStubComponent, SessionAlertStubComponent],
      },
    });
    await TestBed.configureTestingModule({
    imports: [RouterTestingModule, AppComponent],
    providers: [{ provide: SwUpdate, useValue: { isEnabled: false } }],
}).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'padel-frontend'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('padel-frontend');
  });

  it('renders the router progress bar only while routing', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.animate-router-progress')).toBeNull();

    fixture.componentInstance.isRouting.set(true);
    fixture.detectChanges();
    expect(el.querySelector('.animate-router-progress')).not.toBeNull();
  });
});
