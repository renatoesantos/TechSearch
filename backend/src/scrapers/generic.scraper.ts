import type { StoreScraper } from './types';
import { isOutOfStock, parseBrazilianPrice, priceFromPixOrBoletoText, textFromSelectors } from './utils';

/**
 * Adaptador conservador para páginas que expõem preço em texto/JSON-LD.
 * A ausência de um preço Pix/Boleto é tratada como falha de coleta, não como
 * cartão/parcelado nem como R$ 0,00.
 */
export class GenericBrazilianStoreScraper implements StoreScraper {
  readonly key = 'generic';

  async scrape({ $ }: Parameters<StoreScraper['scrape']>[0]) {
    const outOfStock = isOutOfStock($);
    if (outOfStock) {
      return { price: null, outOfStock: true, source: 'selector' as const, note: 'Sinal de indisponibilidade encontrado' };
    }

    const bodyText = $('body').text().replace(/\s+/g, ' ');
    const explicitPixPrice = priceFromPixOrBoletoText(bodyText);
    if (explicitPixPrice !== null) {
      return { price: explicitPixPrice, outOfStock: false, source: 'pix' as const };
    }

    const visiblePrice = textFromSelectors($, [
      '[data-testid*="pix"]',
      '[data-testid*="boleto"]',
      '[class*="pix"]',
      '[class*="boleto"]',
      '[itemprop="price"]',
    ]);
    const parsedVisible = parseBrazilianPrice(visiblePrice);
    if (parsedVisible !== null) {
      return { price: parsedVisible, outOfStock: false, source: 'selector' as const };
    }

    throw new Error('Preço à vista (Pix/Boleto) não encontrado');
  }
}
