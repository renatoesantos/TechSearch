import type { CheerioAPI } from 'cheerio';

const OUT_OF_STOCK_PATTERNS = [
  /sem\s+estoque/i,
  /esgotado/i,
  /indispon[ií]vel/i,
  /fora\s+de\s+estoque/i,
  /produto\s+indispon[ií]vel/i,
];

/**
 * Converte formatos brasileiros e JSON-LD para número em reais.
 * Exemplos aceitos: "R$ 1.299,90", "1299.90", 1299.9.
 */
export function parseBrazilianPrice(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? roundCurrency(value) : null;
  }
  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/\u00a0/g, ' ').trim();
  const matches = cleaned.match(/\d[\d.\s]*(?:,\d{1,2})?/);
  if (!matches) return null;

  let numeric = matches[0].replace(/\s/g, '');
  if (numeric.includes(',')) {
    numeric = numeric.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = numeric.split('.');
    const decimalPart = parts[1] ?? '';
    if (parts.length > 2 || (parts.length === 2 && decimalPart.length === 3)) {
      numeric = numeric.replace(/\./g, '');
    }
  }

  const parsed = Number(numeric);
  return Number.isFinite(parsed) && parsed > 0 ? roundCurrency(parsed) : null;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Não confia só em botão; procura sinais no texto renderizado. */
export function isOutOfStock($: CheerioAPI): boolean {
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return OUT_OF_STOCK_PATTERNS.some((pattern) => pattern.test(text));
}

export function textFromSelectors($: CheerioAPI, selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = $(selector).first().text().replace(/\s+/g, ' ').trim();
    if (value) return value;
  }
  return null;
}

/**
 * Extrai o preço com tipo de pagamento explícito. Preços de cartão/parcelado
 * não entram nesta rotina, por regra de negócio do TechSearch.
 */
export function priceFromPixOrBoletoText(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(?:pix|boleto)[^R$\d]{0,80}(R\$\s*)?([\d.]+(?:,\d{1,2})?)/i);
  return parseBrazilianPrice(match ? match[0] : null);
}

export function firstJsonLdOffer($: CheerioAPI): number | null {
  let price: number | null = null;
  $('script[type="application/ld+json"]').each((_index, element) => {
    if (price !== null) return;
    try {
      const raw = $(element).contents().text();
      const json = JSON.parse(raw) as unknown;
      const candidates = Array.isArray(json) ? json : [json];
      for (const item of candidates) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const offers = record.offers;
        const offerRecords = Array.isArray(offers) ? offers : [offers];
        for (const offer of offerRecords) {
          if (!offer || typeof offer !== 'object') continue;
          const candidate = parseBrazilianPrice((offer as Record<string, unknown>).price);
          if (candidate !== null) {
            price = candidate;
            return;
          }
        }
      }
    } catch {
      // JSON-LD de terceiros pode estar incompleto; o parser segue para
      // seletores visíveis sem derrubar a oferta/loja.
    }
  });
  return price;
}
