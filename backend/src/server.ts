import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { logger } from './utils/logger';
import { startScraperScheduler } from './workers/scraper.scheduler';
import { startAlertScheduler } from './workers/alert.scheduler';

const app = createApp();
const server = http.createServer(app);
const scraperTask = startScraperScheduler();
const alertTask = startAlertScheduler();

server.listen(env.PORT, () => {
  logger.info(`TechSearch API ouvindo em http://localhost:${env.PORT}`, { env: env.NODE_ENV });
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Sinal ${signal} recebido — encerrando o servidor...`);
  scraperTask?.stop();
  alertTask.stop();

  // Para de aceitar novas conexões e espera as em andamento terminarem.
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });

  // Rede de segurança se alguma conexão ficar pendurada.
  setTimeout(() => {
    logger.error('Encerramento forçado após timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Promise rejeitada sem tratamento', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Exceção não capturada — encerrando', { message: error.message, stack: error.stack });
  void shutdown('uncaughtException');
});
