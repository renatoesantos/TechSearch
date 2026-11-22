import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { logger } from '../utils/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Rota ${req.method} ${req.path} não encontrada.`));
};

/**
 * Handler central de erros. Toda resposta de erro segue o formato:
 *   { "error": { "code": "...", "message": "...", "details"?: [...] } }
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) return;

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(error.message, { path: req.path, stack: error.stack });
    }
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  // Violação de constraint única (corrida entre dois cadastros simultâneos).
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'Este registro já existe.' },
    });
    return;
  }

  // JSON malformado enviado pelo cliente.
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido.' },
    });
    return;
  }

  // CORS rejeitado (ver app.ts).
  if (error instanceof Error && error.message === 'CORS_NOT_ALLOWED') {
    res.status(403).json({
      error: { code: 'CORS_NOT_ALLOWED', message: 'Origem não permitida.' },
    });
    return;
  }

  logger.error('Erro não tratado', {
    path: req.path,
    method: req.method,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente em instantes.' },
  });
};
