export interface PricingShift {
  id: string;
  name: string;
  /** Hora de inicio en formato 'HH:mm'. */
  startTime: string;
  /** Hora de fin en formato 'HH:mm'. */
  endTime: string;
  /** Días de la semana (0=Dom, 1=Lun, ..., 6=Sáb). */
  daysOfWeek: number[];
  price30min: number;
  price60min: number;
  price90min: number;
  price120min: number;
  teacherPricePerHour: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePricingShiftDto {
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  price30min?: number;
  price60min: number;
  price90min?: number;
  price120min?: number;
  teacherPricePerHour?: number;
  isActive?: boolean;
}

export type UpdatePricingShiftDto = Partial<CreatePricingShiftDto>;
