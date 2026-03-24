/** Entidad de una cancha de padel. */
export interface Court {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  price30: number;
  price60: number;
  price90: number;
  price120: number;
  teacherPrice: number;
}

/** Payload para crear una nueva cancha. */
export interface CreateCourtDto {
  name: string;
  description?: string;
  isActive?: boolean;
  price30?: number;
  price60?: number;
  price90?: number;
  price120?: number;
  teacherPrice?: number;
}

/** Payload para actualizar parcialmente una cancha existente. */
export interface UpdateCourtDto {
  name?: string;
  description?: string;
  isActive?: boolean;
  price30?: number;
  price60?: number;
  price90?: number;
  price120?: number;
  teacherPrice?: number;
}
