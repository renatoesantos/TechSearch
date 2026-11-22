import cron from 'node-cron';
import { runPriceAlertCycle } from '../services/price-alert.service';
import { logger } from '../utils/logger';

let running = false;

/** Executa a verificação a cada 15 minutos como rede de segurança. */
export function startAlertScheduler(): cron.ScheduledTask {
  const task = cron.schedule(
    '*/15 * * * *',
    () => {
      if (running) {
        logger.warn('Ciclo de alertas ignorado: execução anterior ainda está em andamento.');
        return;
      }
      running = true;
      void runPriceAlertCycle()
        .catch((error) => logger.error('Ciclo agendado de alertas falhou', { error: String(error) }))
        .finally(() => {
          running = false;
        });
    },
    { timezone: 'UTC' },
  );

  logger.info('Scheduler de alertas iniciado', { cron: '*/15 * * * *', timezone: 'UTC' });
  return task;
}
