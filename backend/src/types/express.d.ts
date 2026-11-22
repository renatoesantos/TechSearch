import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    /** Dados extraídos do JWT pelo middleware requireAuth. */
    interface AuthContext {
      userId: string;
      role: UserRole;
      jti: string;
      /** `exp` do token (segundos desde a epoch). */
      expiresAt: number;
    }

    /** Usuário carregado do banco pelo requireAuth. */
    interface AuthenticatedUser {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    }

    interface Request {
      auth?: AuthContext;
      user?: AuthenticatedUser;
    }
  }
}

export {};
