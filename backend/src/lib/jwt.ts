import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env';

/** Expiração estrita: 24 horas. */
export const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export interface AccessTokenClaims {
  /** ID do usuário. */
  sub: string;
  role: UserRole;
  /** ID único do token — permite revogação individual (logout). */
  jti: string;
  iat: number;
  exp: number;
}

/**
 * Assina um access token HS256 com expiração de exatamente 24h.
 * `jti` é usado na denylist de logout; `iat` é comparado com
 * `User.passwordChangedAt` para invalidar sessões após troca de senha.
 */
export function signAccessToken(user: { id: string; role: UserRole }): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    jwtid: randomUUID(),
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

/**
 * Verifica assinatura, emissor, audiência e idade máxima do token.
 * Lança `jsonwebtoken` errors (TokenExpiredError / JsonWebTokenError).
 */
export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    // Defesa extra: mesmo que alguém emita um token sem exp, ele morre em 24h.
    maxAge: `${ACCESS_TOKEN_TTL_SECONDS}s`,
  });

  if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.jti !== 'string') {
    throw new jwt.JsonWebTokenError('Payload de token inválido');
  }

  return decoded as unknown as AccessTokenClaims;
}
