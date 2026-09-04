import { ChangeDetectionStrategy, Component, HostListener, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CalculatorService } from '../../core/services/calculator.service';

import { ModalScrollLockDirective } from '../modal-scroll-lock.directive';

@Component({
    selector: 'app-calculator',
    templateUrl: './calculator.component.html',
    imports: [
    ModalScrollLockDirective
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculatorComponent {
  private calcService = inject(CalculatorService);
  visible = toSignal(this.calcService.visible$, { initialValue: false });

  /** Número que se está tipeando actualmente o el resultado mostrado. */
  currentInput = signal('0');
  /** Primer operando guardado antes de aplicar el operador. */
  previousInput = signal('');
  /** Operador pendiente (+, −, ×, ÷). */
  operator = signal('');
  /** Texto del renglón superior: muestra la operación acumulada. */
  expressionHistory = signal('');

  /** Cuando es `true`, el próximo dígito reemplaza el display. */
  private waitingForOperand2 = false;
  /** Indica que se acaba de pulsar `=` — el próximo dígito arranca una operación nueva. */
  private justEvaluated = false;

  /** Cierra la calculadora flotante. */
  close(): void {
    this.calcService.close();
  }

  @HostListener('window:keydown', ['$event'])
  /** Maneja los eventos de teclado para operar la calculadora sin usar el ratón. */
  onKey(e: KeyboardEvent): void {
    if (!this.visible()) return;

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
      this.currentInput.set(d);
      this.expressionHistory.set('');
      this.justEvaluated = false;
      return;
    }
    if (this.waitingForOperand2) {
      this.currentInput.set(d);
      this.waitingForOperand2 = false;
    } else {
      this.currentInput.update((v) => (v === '0' ? d : v + d));
    }
    if (this.currentInput().replace('.', '').replace('-', '').length > 15) {
      this.currentInput.update((v) => v.slice(0, -1));
    }
  }

  /** Agrega el separador decimal si aún no existe en el número actual. */
  appendDot(): void {
    if (this.justEvaluated) {
      this.currentInput.set('0.');
      this.expressionHistory.set('');
      this.justEvaluated = false;
      return;
    }
    if (this.waitingForOperand2) {
      this.currentInput.set('0.');
      this.waitingForOperand2 = false;
      return;
    }
    if (!this.currentInput().includes('.')) {
      this.currentInput.update((v) => v + '.');
    }
  }

  /** Borra el último dígito o cancela el operador pendiente si el input está vacío. */
  backspace(): void {
    if (this.justEvaluated) return;

    if (this.waitingForOperand2) {
      this.currentInput.set(this.previousInput() || '0');
      this.operator.set('');
      this.previousInput.set('');
      this.waitingForOperand2 = false;
      this.expressionHistory.set('');
      return;
    }

    if (this.currentInput().length > 1) {
      const sliced = this.currentInput().slice(0, -1);
      this.currentInput.set(sliced === '-' || sliced === '.' ? '0' : sliced);
      return;
    }

    if (this.operator()) {
      this.currentInput.set('0');
      this.waitingForOperand2 = true;
      this.expressionHistory.set(
        `${this.fmtNumber(this.previousInput())} ${this.operator()}`,
      );
    } else {
      this.currentInput.set('0');
    }
  }

  /** Establece el operador activo y encadena el resultado si había una operación previa pendiente. */
  setOperator(op: string): void {
    if (this.justEvaluated) {
      this.justEvaluated = false;
    }

    if (this.operator() && !this.waitingForOperand2) {
      const result = this.evaluate(
        parseFloat(this.previousInput()),
        parseFloat(this.currentInput()),
        this.operator(),
      );
      if (result === null) {
        this.currentInput.set('Error');
        this.resetState();
        return;
      }
      this.currentInput.set(String(result));
    }

    this.previousInput.set(this.currentInput());
    this.operator.set(op);
    this.waitingForOperand2 = true;
    this.expressionHistory.set(`${this.fmtNumber(this.previousInput())} ${op}`);
  }

  /** Ejecuta la operación pendiente y muestra el resultado en el display. */
  calculate(): void {
    if (!this.operator() || this.waitingForOperand2) return;

    this.expressionHistory.set(
      `${this.fmtNumber(this.previousInput())} ${this.operator()} ${this.fmtNumber(this.currentInput())} =`,
    );

    const result = this.evaluate(
      parseFloat(this.previousInput()),
      parseFloat(this.currentInput()),
      this.operator(),
    );

    if (result === null) {
      this.currentInput.set('Error');
      this.resetState();
      return;
    }

    this.currentInput.set(String(result));
    this.resetState();
    this.justEvaluated = true;
  }

  /** Invierte el signo del número actual. */
  toggleSign(): void {
    if (this.currentInput() === '0' || this.currentInput() === 'Error') return;
    this.currentInput.update((v) => (v.startsWith('-') ? v.slice(1) : '-' + v));
  }

  /** Divide el número actual entre 100 para convertirlo a porcentaje. */
  percent(): void {
    const n = parseFloat(this.currentInput());
    if (isNaN(n)) return;
    this.currentInput.set(String(parseFloat((n / 100).toPrecision(12))));
  }

  /** Reinicia la calculadora al estado inicial (AC). */
  clear(): void {
    this.currentInput.set('0');
    this.previousInput.set('');
    this.operator.set('');
    this.expressionHistory.set('');
    this.waitingForOperand2 = false;
    this.justEvaluated = false;
  }

  /** Formatea el display con separador de miles (punto) y decimal (coma) argentino. */
  formattedDisplay = computed(() => {
    const currentInput = this.currentInput();
    if (currentInput === 'Error') return 'Error';
    const parts = currentInput.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  });

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
    this.previousInput.set('');
    this.operator.set('');
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
