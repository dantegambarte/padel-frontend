export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserDto {
  username: string;
  fullName: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserDto {
  fullName?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
