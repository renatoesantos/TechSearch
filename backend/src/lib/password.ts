import bcrypt from 'bcryptjs';

/** Custo do bcrypt. 12 é um bom equilíbrio entre segurança e latência (~250ms). */
const BCRYPT_ROUNDS = 12;

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt ignora bytes após 72 — limitamos para não dar falsa sensação de senha longa. */
export const PASSWORD_MAX_LENGTH = 72;

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Hash descartável usado quando o e-mail informado não existe.
 * Sem isso, o login responderia muito mais rápido para e-mails inexistentes,
 * permitindo descobrir quais contas existem (timing attack / enumeração).
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('techsearch-dummy-password-do-not-use', BCRYPT_ROUNDS);
