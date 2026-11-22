import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { sendPriceAlertEmail } from './mail.service';

export const PRICE_ALERT_COOLDOWN_DAYS = 7;
const COOLDOWN_MS = PRICE_ALERT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

interface AlertCandidate {
  id: string;
  targetPrice: Prisma.Decimal;
  user: { id: string; name: string; email: string };
  product: {
    name: string;
    slug: string;
    offers: Array<AlertOffer>;
  };
}

interface AlertOffer {
      currentPrice: Prisma.Decimal | null;
      url: string;
      store: { id: string; name: string };
}

interface InStockOffer extends Omit<AlertOffer, 'currentPrice'> {
  currentPrice: Prisma.Decimal;
}

export interface PriceAlertCycleResult {
  checked: number;
  eligible: number;
  notified: number;
  skippedCooldown: number;
  failed: number;
}

/**
 * Verifica todos os alertas ativos contra a melhor oferta em estoque.
 * A rotina pode ser executada após cada scraping e por scheduler de segurança.
 */
export async function runPriceAlertCycle(now = new Date()): Promise<PriceAlertCycleResult> {
  const alerts = await prisma.priceAlert.findMany({
    where: {
      isActive: true,
      user: { deletedAt: null },
      product: { deletedAt: null },
    },
    select: {
      id: true,
      targetPrice: true,
      lastNotifiedAt: true,
      user: { select: { id: true, name: true, email: true } },
      product: {
        select: {
          name: true,
          slug: true,
          offers: {
            where: { outOfStock: false, currentPrice: { not: null } },
            select: { currentPrice: true, url: true, store: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  const result: PriceAlertCycleResult = {
    checked: alerts.length,
    eligible: 0,
    notified: 0,
    skippedCooldown: 0,
    failed: 0,
  };

  for (const alert of alerts) {
    const bestOffer = findBestOffer(alert);
    if (!bestOffer) continue;
    if (Number(bestOffer.currentPrice) > Number(alert.targetPrice)) continue;
    result.eligible += 1;

    const claimed = await claimAlertNotification(alert, bestOffer, now);
    if (!claimed) {
      result.skippedCooldown += 1;
      continue;
    }

    try {
      await sendPriceAlertEmail({
        to: alert.user.email,
        name: alert.user.name,
        productName: alert.product.name,
        price: Number(bestOffer.currentPrice),
        targetPrice: Number(alert.targetPrice),
        storeName: bestOffer.store.name,
        productUrl: bestOffer.url,
      });

      await prisma.notification.update({
        where: { id: claimed.notificationId },
        data: { status: 'SENT', sentAt: new Date() },
      });
      result.notified += 1;
    } catch (error) {
      result.failed += 1;
      await markNotificationFailure(claimed.notificationId, alert.id, now, error);
      logger.error('Falha ao enviar alerta de preço', {
        alertId: alert.id,
        notificationId: claimed.notificationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('Ciclo de alertas de preço concluído', { result });
  return result;
}

function findBestOffer(alert: AlertCandidate): InStockOffer | null {
  let best: InStockOffer | null = null;
  for (const offer of alert.product.offers) {
    if (offer.currentPrice === null) continue;
    const inStockOffer: InStockOffer = { ...offer, currentPrice: offer.currentPrice };
    if (!best || Number(inStockOffer.currentPrice) < Number(best.currentPrice)) best = inStockOffer;
  }
  return best;
}

/**
 * Reserva o envio e cria a notificação na mesma transação.
 * O updateMany condicional é o ponto que torna o cooldown seguro contra duas
 * instâncias executando o worker simultaneamente: só uma consegue atualizar
 * lastNotifiedAt dentro da janela permitida.
 */
async function claimAlertNotification(
  alert: AlertCandidate & { lastNotifiedAt: Date | null },
  bestOffer: InStockOffer,
  now: Date,
): Promise<{ notificationId: string } | null> {
  const cooldownCutoff = new Date(now.getTime() - COOLDOWN_MS);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.priceAlert.updateMany({
      where: {
        id: alert.id,
        isActive: true,
        OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lte: cooldownCutoff } }],
      },
      data: {
        lastNotifiedAt: now,
        lastNotifiedPrice: bestOffer.currentPrice,
      },
    });

    if (claimed.count !== 1) return null;

    const notification = await tx.notification.create({
      data: {
        userId: alert.user.id,
        priceAlertId: alert.id,
        channel: 'EMAIL',
        status: 'PENDING',
        priceAtNotification: bestOffer.currentPrice,
        storeId: bestOffer.store.id,
      },
    });
    return { notificationId: notification.id };
  });
}

async function markNotificationFailure(notificationId: string, alertId: string, claimedAt: Date, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.$transaction([
    prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'FAILED', error: message.slice(0, 4_000) },
    }),
    // Permite retry se o envio falhar. A condição protege um eventual novo
    // claim manual que tenha acontecido entre o envio e o rollback lógico.
    prisma.priceAlert.updateMany({
      where: { id: alertId, lastNotifiedAt: claimedAt },
      data: { lastNotifiedAt: null, lastNotifiedPrice: null },
    }),
  ]);
}
