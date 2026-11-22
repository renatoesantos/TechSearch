import { z } from 'zod';

export const productIdParamsSchema = z.object({ id: z.string().uuid('ID de produto inválido.') });

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});
