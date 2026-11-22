import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../lib/jwt';
import { tokenDenylist } from '../lib/token-denylist';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

/**
 * Middleware de autenticação.
 *
 * Ordem das checagens:
 *  1. Cabeçalho `Authorization: Bearer <token>` presente
 *  2. Assinatura/expiração/issuer/audience válidos
 *  3. Token não está na denylist (logout)
 *  4. Usuário existe e não foi excluído (soft delete)
 *  5. Token foi emitido depois da última troca de senha
 *
 * A consulta ao banco a cada requisição garante que exclusão de conta e
 * troca de senha tenham efeito imediato. Se isso virar gargalo, cacheie
 * por poucos segundos (ex.: Redis) mantendo as mesmas regras.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw AppError.unauthorized('Token de acesso ausente.');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw AppError.unauthorized('Token de acesso ausente.');

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw AppError.unauthorized('Sessão expirada. Faça login novamente.', 'TOKEN_EXPIRED');
      }
      throw AppError.unauthorized('Token de acesso inválido.', 'INVALID_TOKEN');
    }

    if (tokenDenylist.isRevoked(claims.jti)) {
      throw AppError.unauthorized('Sessão encerrada. Faça login novamente.', 'TOKEN_REVOKED');
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, name: true, email: true, role: true, deletedAt: true, passwordChangedAt: true },
    });

    if (!user || user.deletedAt) {
      throw AppError.unauthorized('Conta indisponível.', 'ACCOUNT_UNAVAILABLE');
    }

    // `iat` tem precisão de segundos; comparamos com folga de 1s para não
    // rejeitar um token emitido no mesmo segundo da troca de senha.
    if (user.passwordChangedAt && claims.iat * 1000 + 1000 < user.passwordChangedAt.getTime()) {
      throw AppError.unauthorized('Sessão invalidada por alteração de senha.', 'PASSWORD_CHANGED');
    }

    req.auth = { userId: user.id, role: user.role, jti: claims.jti, expiresAt: claims.exp };
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
};
