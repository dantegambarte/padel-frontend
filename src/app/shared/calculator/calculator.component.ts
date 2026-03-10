import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CalculatorService } from '../../core/services/calculator.service';

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
})
export class CalculatorComponent implements OnInit, OnDestroy {
  visible = false;

  display = '0'; // lo que ve el usuario en pantalla
  operand1 = ''; // primer número acumulado (público: accedido desde el template)
  private operator = ''; // operador pendiente (+  −  ×  ÷)
  private waitingForOperand2 = false; // próximo dígito reemplaza display

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

  close(): void {
    this.calcService.close();
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.visible) return;

    // Lista de teclas que la calculadora intercepta completamente.
    // Cualquier tecla en esta lista detiene la propagación para que no
    // dispare acciones en modales de fondo (ej. Enter cerrando el modal de reservas).
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

    // Detener propagación SIEMPRE que la calculadora esté abierta y la tecla sea nuestra
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

  // ── Entrada de dígitos ────────────────────────────────────────────────────

  appendDigit(d: string): void {
    if (this.waitingForOperand2) {
      this.display = d;
      this.waitingForOperand2 = false;
    } else {
      this.display = this.display === '0' ? d : this.display + d;
    }
    // Límite de 15 dígitos para no desbordar la pantalla
    if (this.display.replace('.', '').replace('-', '').length > 15) {
      this.display = this.display.slice(0, -1);
    }
  }

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

  backspace(): void {
    if (this.waitingForOperand2) return;
    this.display = this.display.length > 1 ? this.display.slice(0, -1) : '0';
  }

  // ── Operadores ────────────────────────────────────────────────────────────

  setOperator(op: string): void {
    // Si ya hay una operación pendiente, calcular primero (chaining)
    if (this.operator && !this.waitingForOperand2) {
      this.calculate();
    }
    this.operand1 = this.display;
    this.operator = op;
    this.waitingForOperand2 = true;
  }

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

    // Evitar aritmética de punto flotante sucia (ej. 0.1+0.2 = 0.30000000000000004)
    const rounded = parseFloat(result.toPrecision(12));
    this.display = String(rounded);
    this.reset();
  }

  toggleSign(): void {
    if (this.display === '0' || this.display === 'Error') return;
    this.display = this.display.startsWith('-')
      ? this.display.slice(1)
      : '-' + this.display;
  }

  percent(): void {
    const n = parseFloat(this.display);
    if (isNaN(n)) return;
    this.display = String(parseFloat((n / 100).toPrecision(12)));
  }

  clear(): void {
    this.display = '0';
    this.reset();
  }

  private reset(): void {
    this.operand1 = '';
    this.operator = '';
    this.waitingForOperand2 = false;
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  /** Muestra el operador activo en el header para contexto visual. */
  get activeOperator(): string {
    return this.operator;
  }

  /** Formatea el display para facilitar la lectura (separador de miles). */
  get formattedDisplay(): string {
    if (this.display === 'Error') return 'Error';
    const parts = this.display.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  }
}
