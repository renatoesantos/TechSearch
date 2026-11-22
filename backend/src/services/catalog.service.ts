import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

function decimal(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function serializeProduct(product: any) {
  const offers = product.offers.map((offer: any) => ({
    id: offer.id,
    storeId: offer.storeId,
    store: offer.store.name,
    price: decimal(offer.currentPrice),
    url: offer.url,
    stock: !offer.outOfStock && offer.currentPrice !== null,
    lastCheckedAt: offer.lastCheckedAt,
  }));
  const historyMap = new Map<string, { date: string; price: number | null }>();
  for (const row of product.priceHistory) {
    const date = new Date(row.recordedDate).toISOString().slice(0, 10);
    historyMap.set(`${row.storeId}:${date}`, { date, price: row.outOfStock ? null : decimal(row.price) });
  }
  const history = [...historyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    model: product.model,
    description: product.description,
    category: product.category.name,
    categoryId: product.categoryId,
    image: product.imageUrl,
    specs: product.specs ?? {},
    offers,
    history,
  };
}

const productInclude = {
  category: true,
  offers: { where: { store: { isActive: true } }, include: { store: { select: { id: true, name: true } } }, orderBy: { currentPrice: 'asc' as const } },
  priceHistory: { orderBy: { recordedDate: 'asc' as const }, take: 90 },
};

export async function listProducts(input: { q?: string; category?: string; page: number; limit: number }) {
  const where: Prisma.ProductWhereInput = { deletedAt: null };
  if (input.q) where.OR = [
    { name: { contains: input.q, mode: 'insensitive' } },
    { brand: { contains: input.q, mode: 'insensitive' } },
    { model: { contains: input.q, mode: 'insensitive' } },
  ];
  if (input.category) where.category = { OR: [{ slug: input.category }, { name: { equals: input.category, mode: 'insensitive' } }] };
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ where, include: productInclude, orderBy: { updatedAt: 'desc' }, skip: (input.page - 1) * input.limit, take: input.limit }),
    prisma.product.count({ where }),
  ]);
  return { items: items.map(serializeProduct), pagination: { page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) } };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findFirst({ where: { id, deletedAt: null }, include: productInclude });
  if (!product) throw AppError.notFound('Produto não encontrado.', 'PRODUCT_NOT_FOUND');
  return serializeProduct(product);
}
