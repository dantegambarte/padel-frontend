import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CalculatorComponent } from './calculator.component';
import { CalculatorService } from '../../core/services/calculator.service';

describe('CalculatorComponent', () => {
  let visibleSubject: BehaviorSubject<boolean>;
  let calcServiceSpy: jasmine.SpyObj<CalculatorService>;

  beforeEach(async () => {
    visibleSubject = new BehaviorSubject<boolean>(false);
    calcServiceSpy = jasmine.createSpyObj('CalculatorService', ['close'], {
      visible$: visibleSubject.asObservable(),
    });

    await TestBed.configureTestingModule({
    imports: [CalculatorComponent],
    providers: [{ provide: CalculatorService, useValue: calcServiceSpy }],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  function create() {
    const fixture = TestBed.createComponent(CalculatorComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('mirrors visible$ from the service', () => {
    const fixture = create();
    visibleSubject.next(true);
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('close() delegates to the service', () => {
    const fixture = create();
    fixture.componentInstance.close();
    expect(calcServiceSpy.close).toHaveBeenCalled();
  });

  it('appendDigit() builds a multi-digit number, replacing the initial 0', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    component.appendDigit('5');
    component.appendDigit('3');
    expect(component.currentInput()).toBe('53');
  });

  it('performs a basic addition end to end', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    component.appendDigit('5');
    component.setOperator('+');
    component.appendDigit('3');
    component.calculate();
    expect(component.currentInput()).toBe('8');
  });

  it('chains operators, applying the pending operation first', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    component.appendDigit('2');
    component.setOperator('+');
    component.appendDigit('3');
    component.setOperator('×');
    // 2 + 3 = 5 gets applied before starting the multiplication
    component.appendDigit('4');
    component.calculate();
    expect(component.currentInput()).toBe('20');
  });

  it('division by zero shows Error and resets state', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    component.appendDigit('5');
    component.setOperator('÷');
    component.appendDigit('0');
    component.calculate();
    expect(component.currentInput()).toBe('Error');
    expect(component.operator()).toBe('');
  });

  it('clear() resets the calculator to its initial state', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    component.appendDigit('9');
    component.setOperator('+');
    component.clear();
    expect(component.currentInput()).toBe('0');
    expect(component.operator()).toBe('');
    expect(component.previousInput()).toBe('');
  });

  it('toggleSign() flips the sign of the current input', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    component.appendDigit('7');
    component.toggleSign();
    expect(component.currentInput()).toBe('-7');
    component.toggleSign();
    expect(component.currentInput()).toBe('7');
  });

  it('backspace() removes the last digit', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    component.appendDigit('1');
    component.appendDigit('2');
    component.appendDigit('3');
    component.backspace();
    expect(component.currentInput()).toBe('12');
  });

  it('appendDot() adds a decimal point only once', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    component.appendDigit('1');
    component.appendDot();
    component.appendDot();
    component.appendDigit('5');
    expect(component.currentInput()).toBe('1.5');
  });

  it('formattedDisplay adds thousands separators', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    ['1', '0', '0', '0'].forEach((d) => component.appendDigit(d));
    expect(component.formattedDisplay()).toBe('1.000');
  });

  it('onKey() ignores keys while the calculator is not visible', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    const event = new KeyboardEvent('keydown', { key: '5' });
    spyOn(event, 'preventDefault');
    component.onKey(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(component.currentInput()).toBe('0');
  });

  it('onKey() handles digit keys when visible', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    visibleSubject.next(true);
    const event = new KeyboardEvent('keydown', { key: '7' });
    component.onKey(event);
    expect(component.currentInput()).toBe('7');
  });

  it('onKey() Escape closes the calculator', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    visibleSubject.next(true);
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    component.onKey(event);
    expect(calcServiceSpy.close).toHaveBeenCalled();
  });
});
