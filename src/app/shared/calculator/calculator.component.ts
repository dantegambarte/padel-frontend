import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CalculatorService } from '../../core/services/calculator.service';

@Component({
  standalone: false,
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
})
export class CalculatorComponent implements OnInit, OnDestroy {
  visible = false;

  /** Número que se está tipeando actualmente o el resultado mostrado. */
  currentInput = '0';
  /** Primer operando guardado antes de aplicar el operador. */
  previousInput = '';
  /** Operador pendiente (+, −, ×, ÷). */
  operator = '';
  /** Texto del renglón superior: muestra la operación acumulada. */
  expressionHistory = '';

  /** Cuando es `true`, el próximo dígito reemplaza el display. */
  private waitingForOperand2 = false;
  /** Indica que se acaba de pulsar `=` — el próximo dígito arranca una operación nueva. */
  private justEvaluated = false;

  private sub = new Subscription();

  constructor(private calcService: CalculatorService) {}

  ngOnInit(): void {
    this.sub.add(
      this.calcService.visible$.subscribe((v) => (this.visible = v)),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Cierra la calculadora flotante. */
  close(): void {
    this.calcService.close();
  }

  @HostListener('window:keydown', ['$event'])
  /** Maneja los eventos de teclado para operar la calculadora sin usar el ratón. */
  onKey(e: KeyboardEvent): void {
    if (!this.visible) return;

    const HANDLED = new Set([
      'Escape',
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '.',
      ',',
      '+',
      '-',
      '*',
      '/',
      'Enter',
      '=',
      'Backspace',
      'Delete',
    ]);

    if (!HANDLED.has(e.key)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (e.key === 'Escape') {
      this.close();
      return;
    }
    if (e.key >= '0' && e.key <= '9') {
      this.appendDigit(e.key);
      return;
    }
    if (e.key === '.' || e.key === ',') {
      this.appendDot();
      return;
    }
    if (e.key === '+') {
      this.setOperator('+');
      return;
    }
    if (e.key === '-') {
      this.setOperator('−');
      return;
    }
    if (e.key === '*') {
      this.setOperator('×');
      return;
    }
    if (e.key === '/') {
      this.setOperator('÷');
      return;
    }
    if (e.key === 'Enter' || e.key === '=') {
      this.calculate();
      return;
    }
    if (e.key === 'Backspace') {
      this.backspace();
      return;
    }
    if (e.key === 'Delete') {
      this.clear();
      return;
    }
  }

  /** Agrega un dígito al número actual respetando el estado de la máquina. */
  appendDigit(d: string): void {
    if (this.justEvaluated) {
      this.currentInput = d;
      this.expressionHistory = '';
      this.justEvaluated = false;
      return;
    }
    if (this.waitingForOperand2) {
      this.currentInput = d;
      this.waitingForOperand2 = false;
    } else {
      this.currentInput = this.currentInput === '0' ? d : this.currentInput + d;
    }
    if (this.currentInput.replace('.', '').replace('-', '').length > 15) {
      this.currentInput = this.currentInput.slice(0, -1);
    }
  }

  /** Agrega el separador decimal si aún no existe en el número actual. */
  appendDot(): void {
    if (this.justEvaluated) {
      this.currentInput = '0.';
      this.expressionHistory = '';
      this.justEvaluated = false;
      return;
    }
    if (this.waitingForOperand2) {
      this.currentInput = '0.';
      this.waitingForOperand2 = false;
      return;
    }
    if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
  }

  /** Borra el último dígito o cancela el operador pendiente si el input está vacío. */
  backspace(): void {
    if (this.justEvaluated) return;

    if (this.waitingForOperand2) {
      this.currentInput = this.previousInput || '0';
      this.operator = '';
      this.previousInput = '';
      this.waitingForOperand2 = false;
      this.expressionHistory = '';
      return;
    }

    if (this.currentInput.length > 1) {
      const sliced = this.currentInput.slice(0, -1);
      this.currentInput = sliced === '-' || sliced === '.' ? '0' : sliced;
      return;
    }

    if (this.operator) {
      this.currentInput = '0';
      this.waitingForOperand2 = true;
      this.expressionHistory = `${this.fmtNumber(this.previousInput)} ${this.operator}`;
    } else {
      this.currentInput = '0';
    }
  }

  /** Establece el operador activo y encadena el resultado si había una operación previa pendiente. */
  setOperator(op: string): void {
    if (this.justEvaluated) {
      this.justEvaluated = false;
    }

    if (this.operator && !this.waitingForOperand2) {
      const result = this.evaluate(
        parseFloat(this.previousInput),
        parseFloat(this.currentInput),
        this.operator,
      );
      if (result === null) {
        this.currentInput = 'Error';
        this.resetState();
        return;
      }
      this.currentInput = String(result);
    }

    this.previousInput = this.currentInput;
    this.operator = op;
    this.waitingForOperand2 = true;
    this.expressionHistory = `${this.fmtNumber(this.previousInput)} ${op}`;
  }

  /** Ejecuta la operación pendiente y muestra el resultado en el display. */
  calculate(): void {
    if (!this.operator || this.waitingForOperand2) return;

    this.expressionHistory = `${this.fmtNumber(this.previousInput)} ${this.operator} ${this.fmtNumber(this.currentInput)} =`;

    const result = this.evaluate(
      parseFloat(this.previousInput),
      parseFloat(this.currentInput),
      this.operator,
    );

    if (result === null) {
      this.currentInput = 'Error';
      this.resetState();
      return;
    }

    this.currentInput = String(result);
    this.resetState();
    this.justEvaluated = true;
  }

  /** Invierte el signo del número actual. */
  toggleSign(): void {
    if (this.currentInput === '0' || this.currentInput === 'Error') return;
    this.currentInput = this.currentInput.startsWith('-')
      ? this.currentInput.slice(1)
      : '-' + this.currentInput;
  }

  /** Divide el número actual entre 100 para convertirlo a porcentaje. */
  percent(): void {
    const n = parseFloat(this.currentInput);
    if (isNaN(n)) return;
    this.currentInput = String(parseFloat((n / 100).toPrecision(12)));
  }

  /** Reinicia la calculadora al estado inicial (AC). */
  clear(): void {
    this.currentInput = '0';
    this.previousInput = '';
    this.operator = '';
    this.expressionHistory = '';
    this.waitingForOperand2 = false;
    this.justEvaluated = false;
  }

  /** Formatea el display con separador de miles (punto) y decimal (coma) argentino. */
  get formattedDisplay(): string {
    if (this.currentInput === 'Error') return 'Error';
    const parts = this.currentInput.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  }

  /** Aplica la operación aritmética a los dos operandos. Devuelve null en caso de división por cero. */
  private evaluate(a: number, b: number, op: string): number | null {
    let result: number;
    switch (op) {
      case '+':
        result = a + b;
        break;
      case '−':
        result = a - b;
        break;
      case '×':
        result = a * b;
        break;
      case '÷':
        if (b === 0) return null;
        result = a / b;
        break;
      default:
        return null;
    }
    return parseFloat(result.toPrecision(12));
  }

  /** Limpia el operador y los operandos sin tocar el display (se llama después de calcular). */
  private resetState(): void {
    this.previousInput = '';
    this.operator = '';
    this.waitingForOperand2 = false;
  }

  /** Formatea un número raw para mostrar en el historial. */
  private fmtNumber(value: string): string {
    if (!value || value === 'Error') return value;
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  }
}
