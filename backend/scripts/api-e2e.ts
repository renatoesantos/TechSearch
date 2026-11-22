
import http from 'node:http';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const suffix = Date.now().toString();
const email = `api-${suffix}@example.com`;

const server = http.createServer(createApp());

let categoryId: string | undefined;
let storeId: string | undefined;
let productId: string | undefined;
let serverStarted = false;

async function request(path: string, options: RequestInit = {}) {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Servidor de teste não está disponível.');
  }

  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
}

async function cleanup() {
  // Exclui o usuário e seus dados relacionados.
  // A exclusão do usuário depende das regras de cascata do schema.
  try {
    await prisma.user.deleteMany({ where: { email } });
  } catch (error) {
    console.error('Erro ao limpar usuário de teste:', error);
  }

  if (productId) {
    try {
      await prisma.productOffer.deleteMany({
        where: { productId },
      });
    } catch (error) {
      console.error('Erro ao limpar ofertas:', error);
    }

    try {
      await prisma.product.deleteMany({
        where: { id: productId },
      });
    } catch (error) {
      console.error('Erro ao limpar produto:', error);
    }
  }

  if (storeId) {
    try {
      await prisma.store.deleteMany({
        where: { id: storeId },
      });
    } catch (error) {
      console.error('Erro ao limpar loja:', error);
    }
  }

  if (categoryId) {
    try {
      await prisma.category.deleteMany({
        where: { id: categoryId },
      });
    } catch (error) {
      console.error('Erro ao limpar categoria:', error);
    }
  }
}

async function main() {
  try {
    const category = await prisma.category.create({
      data: {
        name: `API Category ${suffix}`,
        slug: `api-category-${suffix}`,
      },
    });
    categoryId = category.id;

    const store = await prisma.store.create({
      data: {
        name: `API Store ${suffix}`,
        slug: `api-store-${suffix}`,
        websiteUrl: 'https://example.test',
        scraperKey: `api-${suffix}`,
      },
    });
    storeId = store.id;

    const product = await prisma.product.create({
      data: {
        name: `API Product ${suffix}`,
        slug: `api-product-${suffix}`,
        brand: 'Test',
        categoryId: category.id,
      },
    });
    productId = product.id;

    await prisma.productOffer.create({
      data: {
        productId: product.id,
        storeId: store.id,
        url: 'https://example.test/offer',
        currentPrice: new Prisma.Decimal('123.45'),
        outOfStock: false,
        lastCheckedAt: new Date(),
      },
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    serverStarted = true;

    // 1. Consulta pública de produto
    const publicResponse = await request(
      `/api/products/${product.id}`,
    );

    const publicProduct = await publicResponse.json() as {
      offers: Array<{ price: number }>;
    };

    if (
      publicResponse.status !== 200 ||
      publicProduct.offers[0]?.price !== 123.45
    ) {
      throw new Error(`Produto público: ${publicResponse.status}`);
    }

    // 2. Cadastro de usuário
    const register = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'API Tester',
        email,
        password: 'StrongPass123!',
      }),
    });

    if (register.status !== 201) {
      throw new Error(`Registro: ${register.status}`);
    }

    const auth = await register.json() as { token: string };

    const headers = {
      'content-type': 'application/json',
      authorization: `Bearer ${auth.token}`,
    };

    // 3. Criação de lista
    const createdList = await request('/api/wishlists', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'API Build',
        description: 'Teste',
      }),
    });

    if (createdList.status !== 201) {
      throw new Error(`Lista: ${createdList.status}`);
    }

    const list = await createdList.json() as { id: string };

    // 4. Adição de produto à lista
    const item = await request(
      `/api/wishlists/${list.id}/items`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
          targetPrice: 120,
        }),
      },
    );

    if (item.status !== 201) {
      throw new Error(`Item: ${item.status}`);
    }

    // 5. Verificação de alerta
    const alerts = await request('/api/alerts', { headers });

    const alertRows = await alerts.json() as Array<{
      productId: string;
      targetPrice: number;
    }>;

    if (
      alerts.status !== 200 ||
      alertRows.length !== 1 ||
      alertRows[0].targetPrice !== 120
    ) {
      throw new Error('Alerta não persistido.');
    }

    // 6. Verificação de rota privada
    const unauthenticated = await request('/api/wishlists');

    if (unauthenticated.status !== 401) {
      throw new Error(
        `Rota privada sem token: ${unauthenticated.status}`,
      );
    }

    console.log(
      'API_E2E_OK',
      JSON.stringify({
        publicStatus: publicResponse.status,
        listStatus: createdList.status,
        alertCount: alertRows.length,
        unauthorizedStatus: unauthenticated.status,
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
    console.error('Falha no teste de API:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
