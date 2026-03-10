export interface Court {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface CreateCourtDto {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateCourtDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}
