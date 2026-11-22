import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginLimiter, passwordResetLimiter, registerLimiter } from '../middleware/rate-limit';
import { asyncHandler } from '../utils/async-handler';
import { AppError } from '../lib/errors';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema';
import {
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from '../services/auth.service';

export const authRouter = Router();

/** POST /api/auth/register — cria a conta e já devolve um token (24h). */
authRouter.post(
  '/register',
  registerLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  }),
);

/** POST /api/auth/login */
authRouter.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await loginUser(req.body);
    res.status(200).json(result);
  }),
);

/** POST /api/auth/logout — revoga o token atual (denylist por `jti`). */
authRouter.post('/logout', requireAuth, (req, res, next) => {
  try {
    const auth = req.auth;
    if (!auth) throw AppError.unauthorized();
    logoutUser(auth.jti, auth.expiresAt);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/** GET /api/auth/me — dados da conta logada. */
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/** POST /api/auth/forgot-password — sempre 202 (anti-enumeração). */
authRouter.post(
  '/forgot-password',
  passwordResetLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    await requestPasswordReset(req.body.email);
    res.status(202).json({
      message: 'Se este e-mail estiver cadastrado, enviaremos as instruções de recuperação em instantes.',
    });
  }),
);

/** POST /api/auth/reset-password — troca a senha a partir do token do e-mail. */
authRouter.post(
  '/reset-password',
  passwordResetLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await resetPassword(req.body);
    res.status(200).json({
      message: 'Senha atualizada com sucesso. Faça login com a nova senha.',
    });
  }),
);
