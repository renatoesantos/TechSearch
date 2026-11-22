import type { Browser } from 'puppeteer';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { scraperConfig } from '../config/scraper';
import { launchScraperBrowser, loadOfferPage } from '../scrapers/browser';
import { getStoreScraper } from '../scrapers/stores';
import type { ScraperStoreSummary } from '../scrapers/types';
import { persistScrapeFailure, persistScrapedPrice } from '../services/scraper-persistence.service';
import { runPriceAlertCycle } from '../services/price-alert.service';

/**
 * Executa uma loja por vez (ou em lotes no futuro), com isolamento total:
 * qualquer exceção do adapter ou de uma oferta é capturada localmente.
 * O ciclo continua para as outras lojas mesmo se uma loja inteira quebrar.
 */
export async function runScrapingCycle(): Promise<ScraperStoreSummary[]> {
  const stores = await prisma.store.findMany({
    where: { isActive: true },
    include: {
      offers: {
        where: { product: { deletedAt: null } },
        select: { id: true, productId: true, storeId: true, url: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  if (stores.length === 0) {
    logger.info('Ciclo de scraping encerrado: nenhuma loja ativa cadastrada.');
    return [];
  }

  let browser: Browser | null = null;
  const summaries: ScraperStoreSummary[] = [];

  try {
    browser = await launchScraperBrowser();

    for (const store of stores) {
      // REGRA DE OURO: este try/catch engloba uma loja inteira.
      // Falha em KaBuM não pula nem cancela Pichau/Terabyte.
      const summary = await runStoreBlock(browser, store);
      summaries.push(summary);
    }
  } finally {
    await browser?.close().catch((error) => logger.warn('Falha ao fechar browser do scraper', { error: String(error) }));
  }

  logger.info('Ciclo de scraping concluído', { summaries });
  // O alerta é avaliado somente depois que todas as ofertas foram atualizadas,
  // evitando notificar com um snapshot parcial do ciclo.
  await runPriceAlertCycle();
  return summaries;
}

async function runStoreBlock(
  browser: Browser,
  store: {
    id: string;
    name: string;
    scraperKey: string;
    offers: Array<{ id: string; productId: string; storeId: string; url: string }>;
  },
): Promise<ScraperStoreSummary> {
  const startedAt = new Date();
  const run = await prisma.scraperRun.create({ data: { storeId: store.id, status: 'RUNNING', startedAt } });
  const adapter = getStoreScraper(store.scraperKey);
  let processed = 0;
  let failed = 0;
  let fatalError: string | undefined;

  try {
    for (const offer of store.offers) {
      const checkedAt = new Date();
      try {
        const context = await loadOfferPage(browser, {
          productId: offer.productId,
          storeId: offer.storeId,
          url: offer.url,
        });
        try {
          const result = await adapter.scrape(context);
          await persistScrapedPrice({
            offerId: offer.id,
            productId: offer.productId,
            storeId: offer.storeId,
            result,
            checkedAt,
          });
          processed += 1;
        } finally {
          await context.page.close().catch(() => undefined);
        }
      } catch (error) {
        failed += 1;
        await persistScrapeFailure(offer.id, checkedAt, error).catch((persistError) => {
          logger.error('Falha ao persistir erro de oferta', { store: store.name, offerId: offer.id, error: String(persistError) });
        });
        logger.warn('Oferta não processada; próximas ofertas continuam', {
          store: store.name,
          offerId: offer.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    // Defesa adicional: erro inesperado no bloco da loja vira PARTIAL/FAILED,
    // mas nunca escapa para abortar o for das lojas.
    fatalError = error instanceof Error ? error.message : String(error);
    failed += 1;
    logger.error('Bloco de loja interrompido; próximas lojas continuam', {
      store: store.name,
      error: fatalError,
    });
  }

  const status = processed === 0 && failed > 0 ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'SUCCESS';
  await prisma.scraperRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt: new Date(),
      offersProcessed: processed,
      offersFailed: failed,
      errorMessage: fatalError ?? null,
    },
  });

  return {
    storeId: store.id,
    storeName: store.name,
    scraperKey: store.scraperKey,
    processed,
    failed,
    status,
    ...(fatalError ? { errorMessage: fatalError } : {}),
  };
}

/** Execução manual: `npm run scraper:run`. */
if (process.argv.includes('--once')) {
  void runScrapingCycle()
    .catch((error) => {
      logger.error('Ciclo manual de scraping falhou', { error: String(error) });
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
