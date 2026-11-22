
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { runPriceAlertCycle } from '../src/services/price-alert.service';

const suffix = Date.now().toString();
const slug = `alert-fixture-${suffix}`;
const email = `alert-${suffix}@example.com`;

async function main() {
  let userId: string | undefined;
  let categoryId: string | undefined;
  let productId: string | undefined;
  let storeId: string | undefined;
  let offerId: string | undefined;
  let alertId: string | undefined;

  try {
    // Criação dos dados de teste
    const user = await prisma.user.create({
      data: {
        name: 'Alert Test',
        email,
        passwordHash: 'test-hash',
      },
    });
    userId = user.id;

    const category = await prisma.category.create({
      data: {
        name: `Alert Category ${suffix}`,
        slug,
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: `Alert Product ${suffix}`,
        slug,
        categoryId: category.id,
      },
    });
    productId = product.id;

    const store = await prisma.store.create({
      data: {
        name: `Alert Store ${suffix}`,
        slug,
        websiteUrl: 'http://example.test',
        scraperKey: 'generic',
      },
    });
    storeId = store.id;

    const offer = await prisma.productOffer.create({
      data: {
        productId: product.id,
        storeId: store.id,
        url: 'http://example.test/product',
        currentPrice: new Prisma.Decimal('99.90'),
        outOfStock: false,
        lastCheckedAt: new Date(),
      },
    });
    offerId = offer.id;

    const alert = await prisma.priceAlert.create({
      data: {
        userId: user.id,
        productId: product.id,
        targetPrice: new Prisma.Decimal('100.00'),
      },
    });
    alertId = alert.id;

    // Primeiro ciclo: deve enviar uma notificação
    const first = await runPriceAlertCycle(
      new Date('2026-11-10T12:00:00Z'),
    );

    // Segundo ciclo: deve respeitar o cooldown
    const second = await runPriceAlertCycle(
      new Date('2026-11-10T12:05:00Z'),
    );

    const afterSecond = await prisma.notification.count({
      where: { priceAlertId: alert.id },
    });

    if (
      first.notified !== 1 ||
      second.skippedCooldown !== 1 ||
      afterSecond !== 1
    ) {
      throw new Error(
        `Cooldown falhou: ${JSON.stringify({
          first,
          second,
          afterSecond,
        })}`,
      );
    }

    // Simula uma última notificação ocorrida há mais de 7 dias
    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: {
        lastNotifiedAt: new Date('2026-11-01T12:00:00Z'),
      },
    });

    // Terceiro ciclo: deve permitir uma nova notificação
    const third = await runPriceAlertCycle(
      new Date('2026-11-10T12:10:00Z'),
    );

    const afterThird = await prisma.notification.count({
      where: {
        priceAlertId: alert.id,
        status: 'SENT',
      },
    });

    if (third.notified !== 1 || afterThird !== 2) {
      throw new Error(
        `Novo aviso após 7 dias falhou: ${JSON.stringify({
          third,
          afterThird,
        })}`,
      );
    }

    console.log(
      'ALERT_E2E_OK',
      JSON.stringify({
        first,
        second,
        third,
        notifications: afterThird,
      }),
    );
  } finally {
    // Limpeza dos registros, mesmo em caso de falha
    if (alertId) {
      await prisma.notification.deleteMany({
        where: { priceAlertId: alertId },
      });

      await prisma.priceAlert.deleteMany({
        where: { id: alertId },
      });
    }

    if (offerId) {
      await prisma.productOffer.deleteMany({
        where: { id: offerId },
      });
    }

    if (productId) {
      await prisma.product.deleteMany({
        where: { id: productId },
      });
    }

    if (storeId) {
      await prisma.store.deleteMany({
        where: { id: storeId },
      });
    }

    if (categoryId) {
      await prisma.category.deleteMany({
        where: { id: categoryId },
      });
    }

    if (userId) {
      await prisma.user.deleteMany({
        where: { id: userId },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error('Falha no teste de alertas:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
