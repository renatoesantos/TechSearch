import rateLimit, { type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { isTest } from '../config/env';

/**
 * Rate limiting em camadas:
 *  - global: protege a API como um todo (DoS, bots de scraping)
 *  - login: só conta tentativas falhas (skipSuccessfulRequests), o que
 *    bloqueia força bruta sem atrapalhar quem acerta a senha
 *  - cadastro: evita criação massiva de contas
 *  - recuperação de senha: evita abuso de envio de e-mail e spam
 *
 * Em produção com várias instâncias, troque o store em memória por
 * `rate-limit-redis` para o limite ser compartilhado.
 */
function createLimiter(options: Partial<Options>) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Desligado nos testes automatizados para não acoplar testes a janelas.
    skip: () => isTest,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Muitas requisições. Aguarde alguns minutos e tente novamente.',
        },
      });
    },
    ...options,
  });
}

/** 120 requisições por minuto por IP — folgado para uso normal do app. */
export const globalLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 120,
});

/** 10 tentativas de login falhas a cada 15 minutos por IP. */
export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
});

/** 20 cadastros por hora por IP. */
export const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 20,
});

/** 5 pedidos de recuperação/redefinição por 15 minutos por IP. */
export const passwordResetLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
});
