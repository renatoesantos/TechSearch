import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { corsOrigins, env } from './config/env';
import { globalLimiter } from './middleware/rate-limit';
import { authRouter } from './routes/auth.routes';
import { healthRouter } from './routes/health.routes';
import { catalogRouter } from './routes/catalog.routes';
import { wishlistRouter } from './routes/wishlist.routes';
import { alertRouter } from './routes/alert.routes';
import { profileRouter } from './routes/profile.routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

/**
 * Monta a aplicação Express (sem `listen`), o que facilita testes de
 * integração com supertest sem abrir porta.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  // Necessário para o rate limit enxergar o IP real atrás de proxy.
  if (env.TRUST_PROXY > 0) {
    app.set('trust proxy', env.TRUST_PROXY);
  }

  // Cabeçalhos de segurança (nosniff, frameguard, HSTS etc.).
  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        // Requisições sem Origin (curl, server-to-server) são permitidas.
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('CORS_NOT_ALLOWED'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );

  // Limite de payload: nenhuma rota aceita arquivos, então 16kb é generoso.
  app.use(express.json({ limit: '16kb' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));

  // Rate limit global aplicado antes de qualquer rota.
  app.use(globalLimiter);

  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/products', catalogRouter);
  app.use('/api/wishlists', wishlistRouter);
  app.use('/api/alerts', alertRouter);
  app.use('/api/profile', profileRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
