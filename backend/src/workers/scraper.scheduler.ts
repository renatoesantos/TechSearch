import cron from 'node-cron';
import { scraperConfig } from '../config/scraper';
import { runScrapingCycle } from './scraper.worker';
import { logger } from '../utils/logger';

let running = false;

/**
 * Agenda padrão `0 0,12 * * *`: todos os dias à 00:00 e 12:00 UTC.
 * O lock em memória evita sobreposição se um ciclo demorar mais de 12h.
 */
export function startScraperScheduler(): cron.ScheduledTask | null {
  if (!scraperConfig.SCRAPER_ENABLED) {
    logger.info('Scraper desabilitado por SCRAPER_ENABLED=false.');
    return null;
  }

  const task = cron.schedule(
    scraperConfig.SCRAPER_CRON,
    () => {
      if (running) {
        logger.warn('Ciclo de scraping ignorado: ciclo anterior ainda está em execução.');
        return;
      }
      running = true;
      logger.info('Iniciando ciclo agendado de scraping', { cron: scraperConfig.SCRAPER_CRON });
      void runScrapingCycle()
        .catch((error) => logger.error('Ciclo agendado de scraping falhou', { error: String(error) }))
        .finally(() => {
          running = false;
        });
    },
    { timezone: 'UTC' },
  );

  logger.info('Scheduler de scraping iniciado', {
    cron: scraperConfig.SCRAPER_CRON,
    timezone: 'UTC',
  });
  return task;
}
