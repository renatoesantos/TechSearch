import type { CheerioAPI } from 'cheerio';
import type { Page } from 'puppeteer';

export interface ScraperOffer {
  productId: string;
  storeId: string;
  url: string;
}

export interface ScrapedPrice {
  /** Preço à vista em reais. Nunca retorna 0 como fallback. */
  price: number | null;
  outOfStock: boolean;
  /** Opcional: diagnóstico sem dados sensíveis. */
  source: 'pix' | 'boleto' | 'json-ld' | 'selector';
  note?: string;
}

export interface StoreScraperContext {
  page: Page;
  $: CheerioAPI;
  offer: ScraperOffer;
}

export interface StoreScraper {
  readonly key: string;
  scrape(context: StoreScraperContext): Promise<ScrapedPrice>;
}

export interface ScraperStoreSummary {
  storeId: string;
  storeName: string;
  scraperKey: string;
  processed: number;
  failed: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errorMessage?: string;
}
