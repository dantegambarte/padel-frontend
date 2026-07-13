import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';
import { ToastComponent } from './toast.component';
import { ToastService, ToastMessage } from '../../core/services/toast.service';

describe('ToastComponent', () => {
  let toastsSubject: BehaviorSubject<ToastMessage[]>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['dismiss'], {
      toasts$: toastsSubject.asObservable(),
    });

    await TestBed.configureTestingModule({
    imports: [NoopAnimationsModule, ToastComponent],
    providers: [{ provide: ToastService, useValue: toastServiceSpy }],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('mirrors the toasts$ stream', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    fixture.detectChanges();

    const toast: ToastMessage = { id: 1, title: 'Hola', variant: 'success' };
    toastsSubject.next([toast]);

    expect(fixture.componentInstance.toasts).toEqual([toast]);
  });

  it('dismiss() delegates to the service', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    fixture.detectChanges();
    fixture.componentInstance.dismiss(1);
    expect(toastServiceSpy.dismiss).toHaveBeenCalledWith(1);
  });

  it('variant class helpers return a class for each known variant', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    (['default', 'success', 'destructive'] as const).forEach((variant) => {
      expect(component.iconClass(variant)).toBeTruthy();
      expect(component.accentBarClass(variant)).toBeTruthy();
      expect(component.cardBgClass(variant)).toBeTruthy();
      expect(component.titleClass(variant)).toBeTruthy();
      expect(component.descClass(variant)).toBeTruthy();
      expect(component.closeClass(variant)).toBeTruthy();
    });
  });

  it('trackById() returns the toast id', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.trackById(0, { id: 5 } as ToastMessage)).toBe(5);
  });
});
