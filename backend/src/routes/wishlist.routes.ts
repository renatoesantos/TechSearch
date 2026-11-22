import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { addWishlistItemSchema, createWishlistSchema, updateWishlistItemSchema, updateWishlistSchema, wishlistIdParamsSchema, wishlistItemParamsSchema } from '../schemas/user-data.schema';
import { addWishlistItem, createWishlist, deleteWishlist, listWishlists, removeWishlistItem, updateWishlist, updateWishlistItem } from '../services/user-data.service';

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth);

wishlistRouter.get('/', asyncHandler(async (req, res) => { res.json(await listWishlists(req.auth!.userId)); }));
wishlistRouter.post('/', validateBody(createWishlistSchema), asyncHandler(async (req, res) => { res.status(201).json(await createWishlist(req.auth!.userId, req.body)); }));
wishlistRouter.patch('/:id', validateParams(wishlistIdParamsSchema), validateBody(updateWishlistSchema), asyncHandler(async (req, res) => { res.json(await updateWishlist(req.auth!.userId, req.params.id!, req.body)); }));
wishlistRouter.delete('/:id', validateParams(wishlistIdParamsSchema), asyncHandler(async (req, res) => { await deleteWishlist(req.auth!.userId, req.params.id!); res.status(204).send(); }));

wishlistRouter.post('/:id/items', validateParams(wishlistIdParamsSchema), validateBody(addWishlistItemSchema), asyncHandler(async (req, res) => { res.status(201).json(await addWishlistItem(req.auth!.userId, req.params.id!, req.body)); }));
wishlistRouter.patch('/:id/items/:productId', validateParams(wishlistItemParamsSchema), validateBody(updateWishlistItemSchema), asyncHandler(async (req, res) => { res.json(await updateWishlistItem(req.auth!.userId, req.params.id!, req.params.productId!, req.body)); }));
wishlistRouter.delete('/:id/items/:productId', validateParams(wishlistItemParamsSchema), asyncHandler(async (req, res) => { await removeWishlistItem(req.auth!.userId, req.params.id!, req.params.productId!); res.status(204).send(); }));
