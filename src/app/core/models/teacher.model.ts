export interface Teacher {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeacherDto {
  fullName: string;
  phoneNumber?: string;
  email?: string;
}

export interface UpdateTeacherDto extends Partial<CreateTeacherDto> {
  isActive?: boolean;
}
