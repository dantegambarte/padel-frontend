import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [StatCardComponent],
    schemas: [NO_ERRORS_SCHEMA],
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
});
