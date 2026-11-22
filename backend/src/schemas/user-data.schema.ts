import { z } from 'zod';

const uuid = z.string().uuid('ID inválido.');
const money = z.coerce.number().finite().min(0.01).max(99_999_999.99);

export const wishlistIdParamsSchema = z.object({ id: uuid });
export const wishlistItemParamsSchema = z.object({ id: uuid, productId: uuid });
export const createWishlistSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});
export const updateWishlistSchema = createWishlistSchema.partial().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');
export const addWishlistItemSchema = z.object({
  productId: uuid,
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  notes: z.string().trim().max(500).optional(),
  targetPrice: money.optional(),
});
export const updateWishlistItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(99).optional(),
  notes: z.string().trim().max(500).optional(),
  targetPrice: money.optional(),
}).refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');
export const alertIdParamsSchema = z.object({ id: uuid });
export const createAlertSchema = z.object({ productId: uuid, targetPrice: money });
export const updateAlertSchema = z.object({ targetPrice: money.optional(), isActive: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');
