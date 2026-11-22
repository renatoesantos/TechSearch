import type { RequestHandler } from 'express';
import type { ZodError, ZodTypeAny } from 'zod';
import { AppError } from '../lib/errors';

function formatIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : null,
    message: issue.message,
  }));
}

function validate(source: 'body' | 'query' | 'params', schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(AppError.unprocessable('VALIDATION_ERROR', 'Dados inválidos.', formatIssues(result.error)));
      return;
    }
    req[source] = result.data;
    next();
  };
}

export function validateBody(schema: ZodTypeAny): RequestHandler { return validate('body', schema); }
export function validateQuery(schema: ZodTypeAny): RequestHandler { return validate('query', schema); }
export function validateParams(schema: ZodTypeAny): RequestHandler { return validate('params', schema); }
