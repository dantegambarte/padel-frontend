import { TestBed } from '@angular/core/testing';
import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [StatCardComponent],
}).compileComponents();
  });

  it('creates with default inputs and renders without throwing', () => {
    const fixture = TestBed.createComponent(StatCardComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.icon()).toBe('dollar-sign');
  });

  it('accepts custom title, value, icon and trend inputs', () => {
    const fixture = TestBed.createComponent(StatCardComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Ingresos');
    fixture.componentRef.setInput('value', '$10.000');
    fixture.componentRef.setInput('icon', 'trending-up');
    fixture.componentRef.setInput('trend', { value: '+12%', positive: true });
    fixture.detectChanges();

    expect(component.title()).toBe('Ingresos');
    expect(component.value()).toBe('$10.000');
    expect(component.trend()?.positive).toBe(true);
  });

  it('renders the trend line only when a trend is provided', () => {
    const fixture = TestBed.createComponent(StatCardComponent);
    fixture.componentRef.setInput('value', '$10.000');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('$10.000');
    expect(el.querySelector('p.text-accent, p.text-destructive')).toBeNull();

    fixture.componentRef.setInput('trend', { value: '12%', positive: true });
    fixture.detectChanges();
    expect(el.querySelector('p.text-accent')?.textContent?.trim()).toBe('+12%');
  });
});
