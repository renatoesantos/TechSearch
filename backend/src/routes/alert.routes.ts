import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { alertIdParamsSchema, createAlertSchema, updateAlertSchema } from '../schemas/user-data.schema';
import { createAlert, deleteAlert, listAlerts, updateAlert } from '../services/user-data.service';

export const alertRouter = Router();
alertRouter.use(requireAuth);

alertRouter.get('/', asyncHandler(async (req, res) => { res.json(await listAlerts(req.auth!.userId)); }));
alertRouter.post('/', validateBody(createAlertSchema), asyncHandler(async (req, res) => { res.status(201).json(await createAlert(req.auth!.userId, req.body)); }));
alertRouter.patch('/:id', validateParams(alertIdParamsSchema), validateBody(updateAlertSchema), asyncHandler(async (req, res) => { res.json(await updateAlert(req.auth!.userId, req.params.id!, req.body)); }));
alertRouter.delete('/:id', validateParams(alertIdParamsSchema), asyncHandler(async (req, res) => { await deleteAlert(req.auth!.userId, req.params.id!); res.status(204).send(); }));
