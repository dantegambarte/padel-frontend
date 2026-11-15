import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/services/auth.service';

@Component({ selector: 'app-dashboard-admin', template: '' })
class DashboardAdminStub {}

@Component({ selector: 'app-dashboard-employee', template: '' })
class DashboardEmployeeStub {}

describe('DashboardComponent', () => {
  const isAdminSignal = signal(false);

  beforeEach(async () => {
    isAdminSignal.set(false);
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: AuthService, useValue: { isAdminSignal } }],
    })
      .overrideComponent(DashboardComponent, {
        set: { imports: [DashboardAdminStub, DashboardEmployeeStub] },
      })
      .compileComponents();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the employee dashboard for non-admin users', () => {
    const el = render();
    expect(el.querySelector('app-dashboard-employee')).not.toBeNull();
    expect(el.querySelector('app-dashboard-admin')).toBeNull();
  });

  it('renders the admin dashboard for admin users', () => {
    isAdminSignal.set(true);
    const el = render();
    expect(el.querySelector('app-dashboard-admin')).not.toBeNull();
    expect(el.querySelector('app-dashboard-employee')).toBeNull();
  });
});
