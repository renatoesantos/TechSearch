import type { RequestHandler } from 'express';

/**
 * Express 4 não captura rejeições de promises em handlers async.
 * Este wrapper encaminha o erro para o errorHandler central.
 */
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
