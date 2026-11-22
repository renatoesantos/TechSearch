
import http from 'node:http';
import { prisma } from '../src/lib/prisma';
import { runScrapingCycle } from '../src/workers/scraper.worker';

let html = `
<html>
  <body>
    <h1>GPU</h1>
    <div>Preço no Pix: R$ 1.299,90</div>
  </body>
</html>
`;

const server = http.createServer((_req, res) => {
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
  });
  res.end(html);
});

const suffix = Date.now().toString();
const slug = `fixture-${suffix}`;

let serverStarted = false;
let categoryId: string | undefined;
let productId: string | undefined;
let storeId: string | undefined;

async function cleanup() {
  // Cada limpeza é independente para que uma falha
  // não impeça as demais tentativas.
  const operations = [
    async () => {
      if (productId) {
        await prisma.product.deleteMany({
          where: { id: productId },
        });
      }
    },
    async () => {
      if (storeId) {
        await prisma.store.deleteMany({
          where: { id: storeId },
        });
      }
    },
    async () => {
      if (categoryId) {
        await prisma.category.deleteMany({
          where: { id: categoryId },
        });
      }
    },
  ];

  for (const operation of operations) {
    try {
      await operation();
    } catch (error) {
      console.error('Erro durante limpeza do scraper:', error);
    }
  }
}

async function main() {
  try {
    // Inicializa servidor HTTP com porta dinâmica
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    serverStarted = true;

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Não foi possível obter a porta do servidor.');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    // Cria os registros de teste
    const category = await prisma.category.create({
      data: {
        name: `Fixture ${suffix}`,
        slug,
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: `Fixture GPU ${suffix}`,
        slug,
        categoryId: category.id,
      },
    });
    productId = product.id;

    const store = await prisma.store.create({
      data: {
        name: `Fixture Store ${suffix}`,
        slug,
        websiteUrl: baseUrl,
        scraperKey: 'generic',
      },
    });
    storeId = store.id;

    const offer = await prisma.productOffer.create({
      data: {
        productId: product.id,
        storeId: store.id,
        url: `${baseUrl}/gpu`,
      },
    });

    // Primeiro ciclo: captura do preço
    const first = await runScrapingCycle();

    const firstStore = first.find(
      (summary) => summary.storeId === store.id,
    );

    const offerAfterPrice =
      await prisma.productOffer.findUniqueOrThrow({
        where: { id: offer.id },
      });

    const historyAfterPrice =
      await prisma.priceHistory.findFirstOrThrow({
        where: {
          productId: product.id,
          storeId: store.id,
        },
      });

    if (
      firstStore?.status !== 'SUCCESS' ||
      Number(offerAfterPrice.currentPrice) !== 1299.90 ||
      Number(historyAfterPrice.price) !== 1299.90
    ) {
      throw new Error(
        `Preço não persistido corretamente: ${JSON.stringify({
          firstStore,
          currentPrice: offerAfterPrice.currentPrice?.toString(),
          historyPrice: historyAfterPrice.price?.toString(),
        })}`,
      );
    }

    // Segundo ciclo: simula produto esgotado
    html = `
      <html>
        <body>
          <h1>GPU</h1>
          <button>Produto esgotado</button>
          <div>Sem estoque</div>
        </body>
      </html>
    `;

    const second = await runScrapingCycle();

    const secondStore = second.find(
      (summary) => summary.storeId === store.id,
    );

    const offerOut =
      await prisma.productOffer.findUniqueOrThrow({
        where: { id: offer.id },
      });

    const historyOut =
      await prisma.priceHistory.findFirstOrThrow({
        where: {
          productId: product.id,
          storeId: store.id,
        },
      });

    if (
      secondStore?.status !== 'SUCCESS' ||
      offerOut.currentPrice !== null ||
      !offerOut.outOfStock ||
      historyOut.price !== null ||
      !historyOut.outOfStock
    ) {
      throw new Error(
        `Produto esgotado não persistido corretamente: ${JSON.stringify({
          secondStore,
          currentPrice: offerOut.currentPrice?.toString(),
          outOfStock: offerOut.outOfStock,
          historyPrice: historyOut.price?.toString(),
          historyOut: historyOut.outOfStock,
        })}`,
      );
    }

    const historyRows = await prisma.priceHistory.count({
      where: {
        productId: product.id,
        storeId: store.id,
      },
    });

    console.log(
      'SCRAPER_E2E_OK',
      JSON.stringify({
        firstStore,
        secondStore,
        historyRows,
      }),
    );
  } finally {
    await cleanup();

    if (serverStarted) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  }
}

main()
  .catch((error) => {
    console.error('Falha no teste de scraping:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
