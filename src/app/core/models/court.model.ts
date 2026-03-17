/** A padel court entity. */
export interface Court {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

/** Payload for creating a new court. */
export interface CreateCourtDto {
  name: string;
  description?: string;
  isActive?: boolean;
}

/** Payload for partially updating an existing court. */
export interface UpdateCourtDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}
