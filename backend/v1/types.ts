import type { Request } from 'express';

export type AuthUser = {
  userId: string;
  email: string;
  role?: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passwordHash: string;
  username: string;
  role?: string;
  isVerified?: string;
  isActive?: boolean;
};

export type UpdateUserPasswordInput = {
  userId: string;
  passwordHash: string;
};

export type UserLookupResult = {
  userId?: string;
  email?: string;
  passwordHash?: string;
  role?: string;
};

export type JwtTokenType = 'all' | 'forgotPassword' | 'refreshToken' | 'token';

export type PasswordResetMail = {
  to: string;
  subject: string;
  html?: string;
  resetToken?: string;
};

export type PublicRoute = {
  method: string;
  pattern: any
}

export type PaginationInput = {
  page?: number;
  limit?: number;
};