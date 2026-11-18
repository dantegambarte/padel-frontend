import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { PrivacyComponent } from './privacy.component';
import { routes } from '../../app.routes';

describe('PrivacyComponent', () => {
  it('renders the privacy notice with processed data and a third-party licenses link', () => {
    TestBed.configureTestingModule({ imports: [PrivacyComponent] });
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('Aviso de privacidad');
    expect(el.textContent).toContain('responsable del tratamiento');
    expect(el.textContent).toContain('teléfono');
    const licenses = el.querySelector('a[href="/3rdpartylicenses.txt"]');
    expect(licenses).not.toBeNull();
  });

  it('is reachable at /privacy without authentication', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/privacy');
    expect(router.url).toBe('/privacy');
  });
});
