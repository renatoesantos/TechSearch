import puppeteer, { type Browser, type Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { scraperConfig } from '../config/scraper';
import type { ScraperOffer, StoreScraperContext } from './types';

export async function launchScraperBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: scraperConfig.SCRAPER_HEADLESS,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
}

export async function loadOfferPage(browser: Browser, offer: ScraperOffer): Promise<StoreScraperContext> {
  const page = await browser.newPage();
  await configurePage(page);

  try {
    await page.goto(offer.url, {
      waitUntil: 'domcontentloaded',
      timeout: scraperConfig.SCRAPER_TIMEOUT_MS,
    });
    // Aguarda o browser estabilizar componentes client-side sem depender de
    // uma classe CSS específica que possa mudar por loja.
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5_000 }).catch(() => undefined);
    const html = await page.content();
    return { page, $: cheerio.load(html), offer };
  } catch (error) {
    await page.close().catch(() => undefined);
    throw error;
  }
}

async function configurePage(page: Page): Promise<void> {
  await page.setUserAgent(scraperConfig.SCRAPER_USER_AGENT);
  await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' });
  // Não carregar recursos que não são necessários para preço/estoque.
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const resource = request.resourceType();
    if (resource === 'image' || resource === 'media' || resource === 'font') {
      void request.abort();
    } else {
      void request.continue();
    }
  });
}
