import { z } from 'zod';
import './env';

const booleanEnv = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}, z.boolean());

/** Configuração operacional do worker de scraping. */
const scraperConfigSchema = z.object({
  SCRAPER_ENABLED: booleanEnv.default(true),
  SCRAPER_CRON: z.string().default('0 0,12 * * *'),
  SCRAPER_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(30_000),
  SCRAPER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  SCRAPER_USER_AGENT: z
    .string()
    .default('TechSearchPriceBot/1.0 (+https://techsearch.app/bot-info)'),
  SCRAPER_HEADLESS: booleanEnv.default(true),
});

const parsed = scraperConfigSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Configuração de scraper inválida: ${parsed.error.message}`);
}

export const scraperConfig = parsed.data;
