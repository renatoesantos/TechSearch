import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validateParams, validateQuery } from '../middleware/validate';
import { catalogQuerySchema, productIdParamsSchema } from '../schemas/catalog.schema';
import { getProduct, listProducts } from '../services/catalog.service';

export const catalogRouter = Router();

catalogRouter.get('/', validateQuery(catalogQuerySchema), asyncHandler(async (req, res) => {
  res.json(await listProducts(req.query as unknown as { q?: string; category?: string; page: number; limit: number }));
}));

catalogRouter.get('/:id', validateParams(productIdParamsSchema), asyncHandler(async (req, res) => {
  res.json(await getProduct(req.params.id!));
}));
