import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
import { prisma } from '../lib/prisma';

export const profileRouter = Router();
profileRouter.delete('/', requireAuth, asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: req.auth!.userId }, data: { deletedAt: new Date() } });
  res.status(204).send();
}));
