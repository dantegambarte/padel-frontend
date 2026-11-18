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
  /** Si es `true`, el usuario debe cambiar su contraseña antes de continuar. */
  mustChangePassword?: boolean;
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

/**
 * Login response. The refresh token is not in the body: the backend sets it
 * as an HttpOnly cookie.
 */
export interface AuthResponse {
  accessToken: string;
  user: User;
}

/** Refresh response: only a new access token (the cookie is rotated server-side). */
export interface RefreshResponse {
  accessToken: string;
}

/** Credenciales enviadas durante el login. */
export interface LoginCredentials {
  username: string;
  password: string;
}
