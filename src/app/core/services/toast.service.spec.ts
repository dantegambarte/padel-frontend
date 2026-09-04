import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('starts with no toasts', () => {
    expect(service['toastsSubject'].value).toEqual([]);
  });

  it('show() appends a toast with an incrementing id', () => {
    service.show({ title: 'A', variant: 'default' });
    service.show({ title: 'B', variant: 'default' });
    const toasts = service['toastsSubject'].value;
    expect(toasts.length).toBe(2);
    expect(toasts[0].title).toBe('A');
    expect(toasts[1].title).toBe('B');
    expect(toasts[1].id).toBeGreaterThan(toasts[0].id);
  });

  it('show() ignores a duplicate (same title + description) while one is active', () => {
    service.show({ title: 'Dup', description: 'same', variant: 'default' });
    service.show({ title: 'Dup', description: 'same', variant: 'default' });
    expect(service['toastsSubject'].value.length).toBe(1);
  });

  it('success()/error()/info() set the corresponding variant', () => {
    service.success('ok');
    service.error('bad');
    service.info('fyi');
    const [t1, t2, t3] = service['toastsSubject'].value;
    expect(t1.variant).toBe('success');
    expect(t2.variant).toBe('destructive');
    expect(t3.variant).toBe('default');
  });

  it('dismiss() removes the toast with the given id', () => {
    service.show({ title: 'A', variant: 'default' });
    const id = service['toastsSubject'].value[0].id;
    service.dismiss(id);
    expect(service['toastsSubject'].value).toEqual([]);
  });

  it('auto-dismisses after the given duration', fakeAsync(() => {
    service.show({ title: 'A', variant: 'default' }, 1000);
    expect(service['toastsSubject'].value.length).toBe(1);
    tick(1000);
    expect(service['toastsSubject'].value.length).toBe(0);
  }));
});
