import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateInternalConsumptionDto,
  InternalConsumption,
  InternalConsumptionFilters,
  SettleTeacherDebtDto,
  TeacherDebtSummary,
} from '../models/internal-consumption.model';

@Injectable({ providedIn: 'root' })
export class InternalConsumptionService {
  private readonly apiUrl = `${environment.apiUrl}/internal-consumption`;

  constructor(private http: HttpClient) {}

  /**
   * Busqueda de consumos internos con filtros opcionales.
   * Permite filtrar por estado, tipo de consumidor, docente, usuario y rango de fechas.
   * @param filters
   * @returns
   */
  getAll(
    filters?: InternalConsumptionFilters,
  ): Observable<InternalConsumption[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.consumerType)
      params = params.set('consumerType', filters.consumerType);
    if (filters?.teacherId) params = params.set('teacherId', filters.teacherId);
    if (filters?.userId) params = params.set('userId', filters.userId);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
    return this.http.get<InternalConsumption[]>(this.apiUrl, { params });
  }

  /**
   * Obtiene un consumo interno específico por su ID.
   * Permite ver detalles completos del consumo, incluyendo información del producto, consumidor y estado.
   * @param id
   * @returns
   */
  getOne(id: string): Observable<InternalConsumption> {
    return this.http.get<InternalConsumption>(`${this.apiUrl}/${id}`);
  }

  /**
   * Registra un nuevo consumo interno en el sistema.
   * Requiere información del producto, cantidad, tipo de consumidor, y fecha.
   * Opcionalmente se pueden incluir notas y asignar el consumo a un usuario o docente específico.
   * @param dto
   * @returns
   */
  create(dto: CreateInternalConsumptionDto): Observable<InternalConsumption> {
    return this.http.post<InternalConsumption>(this.apiUrl, dto);
  }

  /**
   * Marca consumos internos pendientes de docentes como pagados, generando un registro de pago.
   * Permite liquidar deudas acumuladas por consumos internos de docentes, ya sea seleccionando consumos específicos o liquidando toda la deuda.
   * @param dto
   * @returns
   */
  settleTeacherDebt(
    dto: SettleTeacherDebtDto,
  ): Observable<InternalConsumption[]> {
    return this.http.patch<InternalConsumption[]>(`${this.apiUrl}/settle`, dto);
  }

  /**
   * Obtiene un resumen de la deuda acumulada por cada docente, incluyendo cantidad total de items consumidos y costo total pendiente.
   * Este resumen es útil para identificar rápidamente qué docentes tienen deudas pendientes y el monto total a pagar.
   * @returns
   */
  getTeacherDebtSummary(): Observable<TeacherDebtSummary[]> {
    return this.http.get<TeacherDebtSummary[]>(
      `${this.apiUrl}/teacher-debt-summary`,
    );
  }

  /**
   * Builds a wa.me URL with an itemized breakdown of a specific withdrawal.
   */
  buildItemizedWhatsAppUrl(
    phoneNumber: string,
    teacherName: string,
    items: { name: string; quantity: number; subtotal: number }[],
    total: number,
  ): string {
    const digits = phoneNumber.replace(/\D/g, '');
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      }).format(n);

    const lines = items
      .map((i) => `  • ${i.quantity}x ${i.name} (${fmt(i.subtotal)})`)
      .join('\n');

    const message =
      `Hola ${teacherName}! 👋\n` +
      `Acabás de retirar de cantina:\n${lines}\n` +
      `*Total de este retiro: ${fmt(total)}*\n` +
      `¡Gracias! 🎾`;

    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Builds a wa.me URL reminding a teacher of their total accumulated debt.
   */
  buildDebtReminderWhatsAppUrl(
    phoneNumber: string,
    teacherName: string,
    totalDebt: number,
  ): string {
    const digits = phoneNumber.replace(/\D/g, '');
    const fmt = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(totalDebt);

    const message =
      `Hola ${teacherName}! 👋\n` +
      `Te recordamos que tenés un saldo pendiente en cantina de *${fmt}* por consumos acumulados.\n` +
      `¡Gracias! 🎾`;

    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }
}
