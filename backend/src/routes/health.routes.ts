import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../utils/async-handler';
import { AppError } from '../lib/errors';

export const healthRouter = Router();

/** GET /health — liveness: a API está de pé? */
healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/** GET /health/ready — readiness: a API consegue falar com o banco? */
healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados indisponível.');
    }
    res.json({ status: 'ready' });
  }),
);
