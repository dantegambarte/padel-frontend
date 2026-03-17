/** Rol asignado a un usuario del sistema. */
export type UserRole = 'admin' | 'employee';

/** Entidad de usuario del sistema. */
export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

/** Payload para crear un nuevo usuario. */
export interface CreateUserDto {
  username: string;
  fullName: string;
  password: string;
  role?: UserRole;
}

/** Payload para actualizar parcialmente un usuario existente. */
export interface UpdateUserDto {
  fullName?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

/** Respuesta devuelta por los endpoints de autenticación (login / refresh). */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** Credenciales enviadas durante el login. */
export interface LoginCredentials {
  username: string;
  password: string;
}
