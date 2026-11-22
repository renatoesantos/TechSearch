import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../lib/password';
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from '../lib/jwt';
import { tokenDenylist } from '../lib/token-denylist';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { sendPasswordResetEmail } from './mail.service';
import type { LoginInput, RegisterInput, ResetPasswordInput } from '../schemas/auth.schema';

/** Validade do link de recuperação de senha. */
const RESET_TOKEN_TTL_MINUTES = 60;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  tokenType: 'Bearer';
  /** Segundos até o token expirar (24h). */
  expiresIn: number;
  user: PublicUser;
}

function toPublicUser(user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'createdAt'>): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

function buildAuthResponse(user: User): AuthResponse {
  return {
    token: signAccessToken({ id: user.id, role: user.role }),
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: toPublicUser(user),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Hash do token de recuperação: o token em texto puro só existe no e-mail. */
function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw AppError.conflict('EMAIL_IN_USE', 'Já existe uma conta com este e-mail.');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });
    return buildAuthResponse(user);
  } catch (error) {
    // Corrida: outro cadastro com o mesmo e-mail entre o findUnique e o create.
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict('EMAIL_IN_USE', 'Já existe uma conta com este e-mail.');
    }
    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
  });

  if (!user) {
    // Compara contra um hash descartável para manter o tempo de resposta
    // parecido com o de uma senha errada (evita enumeração por timing).
    await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
    throw AppError.unauthorized('E-mail ou senha inválidos.', 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw AppError.unauthorized('E-mail ou senha inválidos.', 'INVALID_CREDENTIALS');
  }

  return buildAuthResponse(user);
}

/** Revoga o token atual até a expiração natural (logout real). */
export function logoutUser(jti: string, expiresAtSeconds: number): void {
  tokenDenylist.revoke(jti, expiresAtSeconds * 1000);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, name: true, email: true },
  });

  // Anti-enumeração: resposta idêntica exista ou não a conta.
  if (!user) return;

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  // Invalida pedidos anteriores ainda não usados: só o último link vale.
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
  ]);

  const resetUrl = `${env.APP_URL.replace(/\/$/, '')}/redefinir-senha?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });
  } catch (error) {
    // Não revela falha de e-mail ao cliente, mas registra para monitoramento.
    logger.error('Falha ao enviar e-mail de recuperação de senha', {
      userId: user.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashResetToken(input.token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, passwordHash: true, deletedAt: true } } },
  });

  const isExpired = record ? record.expiresAt.getTime() <= Date.now() : true;
  if (!record || record.usedAt || isExpired || record.user.deletedAt) {
    throw AppError.badRequest('INVALID_RESET_TOKEN', 'Link de recuperação inválido ou expirado. Solicite um novo.');
  }

  if (await verifyPassword(input.password, record.user.passwordHash)) {
    throw AppError.unprocessable('SAME_PASSWORD', 'A nova senha deve ser diferente da senha atual.');
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  await prisma.$transaction([
    // passwordChangedAt invalida todos os tokens emitidos antes de agora.
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: now },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, id: { not: record.id } },
    }),
  ]);
}
