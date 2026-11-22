type LogLevel = 'info' | 'warn' | 'error';

type LogMeta = Record<string, unknown>;

function write(level: LogLevel, message: string, meta?: LogMeta): void {
  const entry = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...meta,
  });

  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
}

/** Logger JSON mínimo. Troque por pino/winston quando houver agregação de logs. */
export const logger = {
  info: (message: string, meta?: LogMeta) => write('info', message, meta),
  warn: (message: string, meta?: LogMeta) => write('warn', message, meta),
  error: (message: string, meta?: LogMeta) => write('error', message, meta),
};
