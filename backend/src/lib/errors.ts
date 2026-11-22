/**
 * Erro de aplicação com status HTTP e código legível por máquina.
 * O `errorHandler` transforma isso em JSON sem vazar stack trace.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: string, message: string, details?: unknown): AppError {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Não autenticado.', code = 'UNAUTHORIZED'): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'Acesso negado.', code = 'FORBIDDEN'): AppError {
    return new AppError(403, code, message);
  }

  static notFound(message = 'Recurso não encontrado.', code = 'NOT_FOUND'): AppError {
    return new AppError(404, code, message);
  }

  static conflict(code: string, message: string): AppError {
    return new AppError(409, code, message);
  }

  static unprocessable(code: string, message: string, details?: unknown): AppError {
    return new AppError(422, code, message, details);
  }

  static tooManyRequests(message = 'Muitas requisições. Tente novamente mais tarde.'): AppError {
    return new AppError(429, 'RATE_LIMITED', message);
  }
}
