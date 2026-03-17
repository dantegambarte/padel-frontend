/** Entidad de una cancha de pádel. */
export interface Court {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

/** Payload para crear una nueva cancha. */
export interface CreateCourtDto {
  name: string;
  description?: string;
  isActive?: boolean;
}

/** Payload para actualizar parcialmente una cancha existente. */
export interface UpdateCourtDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}
