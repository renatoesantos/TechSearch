import type { StoreScraper } from './types';
import { GenericBrazilianStoreScraper } from './generic.scraper';
import { isOutOfStock, parseBrazilianPrice, priceFromPixOrBoletoText, textFromSelectors } from './utils';

/**
 * Cada loja tem sua própria instância e try/catch no worker.
 * Seletores são deliberadamente mantidos aqui, fora do orchestration code,
 * para que uma mudança de layout exija alterar apenas o adaptador afetado.
 */
class KabumScraper implements StoreScraper {
  readonly key = 'kabum';
  async scrape({ $ }: Parameters<StoreScraper['scrape']>[0]) {
    if (isOutOfStock($)) return { price: null, outOfStock: true, source: 'selector' as const };
    const text = textFromSelectors($, ['[data-testid="product-price"]', '[class*="price"]', 'body']);
    const price = priceFromPixOrBoletoText(text) ?? priceFromPixOrBoletoText($('body').text());
    if (price === null) throw new Error('Preço Pix/Boleto não encontrado na KaBuM');
    return { price: parseBrazilianPrice(price)!, outOfStock: false, source: 'pix' as const };
  }
}

class PichauScraper implements StoreScraper {
  readonly key = 'pichau';
  async scrape({ $ }: Parameters<StoreScraper['scrape']>[0]) {
    if (isOutOfStock($)) return { price: null, outOfStock: true, source: 'selector' as const };
    const text = textFromSelectors($, ['.p-price', '.price', '[class*="price"]', 'body']);
    const price = priceFromPixOrBoletoText(text) ?? priceFromPixOrBoletoText($('body').text());
    if (price === null) throw new Error('Preço Pix/Boleto não encontrado na Pichau');
    return { price, outOfStock: false, source: 'pix' as const };
  }
}

class TerabyteScraper implements StoreScraper {
  readonly key = 'terabyte';
  async scrape({ $ }: Parameters<StoreScraper['scrape']>[0]) {
    if (isOutOfStock($)) return { price: null, outOfStock: true, source: 'selector' as const };
    const text = textFromSelectors($, ['.product-price', '.produto-preco', '[class*="price"]', 'body']);
    const price = priceFromPixOrBoletoText(text) ?? priceFromPixOrBoletoText($('body').text());
    if (price === null) throw new Error('Preço Pix/Boleto não encontrado na Terabyte');
    return { price, outOfStock: false, source: 'boleto' as const };
  }
}

const fallback = new GenericBrazilianStoreScraper();
const adapters: StoreScraper[] = [new KabumScraper(), new PichauScraper(), new TerabyteScraper(), fallback];

export function getStoreScraper(scraperKey: string): StoreScraper {
  return adapters.find((adapter) => adapter.key === scraperKey) ?? fallback;
}
