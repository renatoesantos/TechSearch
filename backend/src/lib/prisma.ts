import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env';

/**
 * Singleton do PrismaClient.
 * Em desenvolvimento o `tsx watch` recarrega o módulo a cada alteração;
 * sem o cache no globalThis, cada reload abriria um novo pool de conexões.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
