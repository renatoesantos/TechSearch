import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { ScrapedPrice } from '../scrapers/types';

export async function persistScrapedPrice(params: {
  offerId: string;
  productId: string;
  storeId: string;
  result: ScrapedPrice;
  checkedAt?: Date;
}): Promise<void> {
  const checkedAt = params.checkedAt ?? new Date();
  // Timestamps são UTC; Date.UTC evita que o dia do histórico mude conforme
  // o timezone do processo/container.
  const recordedDate = new Date(Date.UTC(
    checkedAt.getUTCFullYear(),
    checkedAt.getUTCMonth(),
    checkedAt.getUTCDate(),
  ));
  const price = params.result.outOfStock || params.result.price === null
    ? null
    : new Prisma.Decimal(params.result.price.toFixed(2));

  await prisma.$transaction([
    prisma.productOffer.update({
      where: { id: params.offerId },
      data: {
        currentPrice: price,
        outOfStock: params.result.outOfStock,
        lastCheckedAt: checkedAt,
        lastError: null,
      },
    }),
    prisma.priceHistory.upsert({
      where: {
        productId_storeId_recordedDate: {
          productId: params.productId,
          storeId: params.storeId,
          recordedDate,
        },
      },
      create: {
        productId: params.productId,
        storeId: params.storeId,
        price,
        outOfStock: params.result.outOfStock,
        recordedDate,
        recordedAt: checkedAt,
      },
      update: {
        price,
        outOfStock: params.result.outOfStock,
        recordedAt: checkedAt,
      },
    }),
  ]);
}

export async function persistScrapeFailure(offerId: string, checkedAt = new Date(), error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.productOffer.update({
    where: { id: offerId },
    data: { lastCheckedAt: checkedAt, lastError: message.slice(0, 4_000) },
  });
}
