/** Role assigned to a system user. */
export type UserRole = 'admin' | 'employee';

/** A system user entity. */
export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

/** Payload for creating a new user. */
export interface CreateUserDto {
  username: string;
  fullName: string;
  password: string;
  role?: UserRole;
}

/** Payload for partially updating an existing user. */
export interface UpdateUserDto {
  fullName?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

/** Response returned by the authentication endpoints (login / refresh). */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** Credentials submitted during login. */
export interface LoginCredentials {
  username: string;
  password: string;
}
