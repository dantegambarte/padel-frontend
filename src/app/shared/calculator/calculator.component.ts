import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CalculatorService } from '../../core/services/calculator.service';

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
})
export class CalculatorComponent implements OnInit, OnDestroy {
  visible = false;

  /** Valor actualmente mostrado en pantalla. */
  display = '0';
  /** Primer operando acumulado (accedido desde el template para mostrar contexto). */
  operand1 = '';
  /** Operador pendiente (+, −, ×, ÷). */
  private operator = '';
  /** Cuando es `true`, el próximo dígito reemplaza el display en lugar de concatenarse. */
  private waitingForOperand2 = false;

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

  /** Cierra la calculadora. */
  close(): void {
    this.calcService.close();
  }

  /**
   * Maneja el teclado cuando la calculadora está visible.
   * Detiene la propagación de las teclas interceptadas para evitar que disparen
   * acciones en componentes del fondo (por ejemplo, Enter cerrando un modal de reservas).
   */
  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.visible) return;

    const HANDLED = new Set([
      'Escape',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      '.', ',', '+', '-', '*', '/',
      'Enter', '=', 'Backspace', 'Delete',
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

  /** Agrega un dígito al display. Si se espera el segundo operando, reemplaza el valor actual. */
  appendDigit(d: string): void {
    if (this.waitingForOperand2) {
      this.display = d;
      this.waitingForOperand2 = false;
    } else {
      this.display = this.display === '0' ? d : this.display + d;
    }
    if (this.display.replace('.', '').replace('-', '').length > 15) {
      this.display = this.display.slice(0, -1);
    }
  }

  /** Agrega el separador decimal al display si aún no tiene uno. */
  appendDot(): void {
    if (this.waitingForOperand2) {
      this.display = '0.';
      this.waitingForOperand2 = false;
      return;
    }
    if (!this.display.includes('.')) {
      this.display += '.';
    }
  }

  /** Elimina el último carácter del display. */
  backspace(): void {
    if (this.waitingForOperand2) return;
    this.display = this.display.length > 1 ? this.display.slice(0, -1) : '0';
  }

  /**
   * Establece el operador pendiente. Si ya había una operación en curso,
   * calcula el resultado primero (encadenamiento de operaciones).
   */
  setOperator(op: string): void {
    if (this.operator && !this.waitingForOperand2) {
      this.calculate();
    }
    this.operand1 = this.display;
    this.operator = op;
    this.waitingForOperand2 = true;
  }

  /**
   * Ejecuta la operación pendiente y muestra el resultado.
   * Evita aritmética de punto flotante sucia usando `toPrecision(12)`.
   */
  calculate(): void {
    if (!this.operator || this.waitingForOperand2) return;

    const a = parseFloat(this.operand1);
    const b = parseFloat(this.display);
    let result: number;

    switch (this.operator) {
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
        if (b === 0) {
          this.display = 'Error';
          this.reset();
          return;
        }
        result = a / b;
        break;
      default:
        return;
    }

    const rounded = parseFloat(result.toPrecision(12));
    this.display = String(rounded);
    this.reset();
  }

  /** Invierte el signo del valor actual en pantalla. */
  toggleSign(): void {
    if (this.display === '0' || this.display === 'Error') return;
    this.display = this.display.startsWith('-')
      ? this.display.slice(1)
      : '-' + this.display;
  }

  /** Convierte el valor actual a su equivalente porcentual (divide por 100). */
  percent(): void {
    const n = parseFloat(this.display);
    if (isNaN(n)) return;
    this.display = String(parseFloat((n / 100).toPrecision(12)));
  }

  /** Resetea el display a 0 y limpia el estado interno. */
  clear(): void {
    this.display = '0';
    this.reset();
  }

  /** Limpia el estado interno de operandos y operador sin tocar el display. */
  private reset(): void {
    this.operand1 = '';
    this.operator = '';
    this.waitingForOperand2 = false;
  }

  /** Muestra el operador activo en el header para contexto visual. */
  get activeOperator(): string {
    return this.operator;
  }

  /** Formatea el display con separador de miles para facilitar la lectura. */
  get formattedDisplay(): string {
    if (this.display === 'Error') return 'Error';
    const parts = this.display.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  }
}
