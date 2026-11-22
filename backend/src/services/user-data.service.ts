import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const productInclude = {
  product: { include: { category: true, offers: { where: { store: { isActive: true } }, include: { store: { select: { name: true } } }, orderBy: { currentPrice: 'asc' as const } } } },
};

function offerSummary(product: any) {
  const offers = product.offers.map((offer: any) => ({ store: offer.store.name, price: offer.currentPrice === null ? null : Number(offer.currentPrice), url: offer.url, stock: !offer.outOfStock && offer.currentPrice !== null }));
  return offers;
}
function serializeWishlist(wishlist: any) {
  return { id: wishlist.id, name: wishlist.name, description: wishlist.description, items: wishlist.items.map((item: any) => ({ id: item.id, productId: item.productId, quantity: item.quantity, notes: item.notes, targetPrice: item.priceAlert ? Number(item.priceAlert.targetPrice) : null, product: { id: item.product.id, name: item.product.name, brand: item.product.brand, category: item.product.category.name, image: item.product.imageUrl, offers: offerSummary(item.product) } })) };
}
function serializeAlert(alert: any) { return { id: alert.id, productId: alert.productId, targetPrice: Number(alert.targetPrice), active: alert.isActive, lastNotifiedAt: alert.lastNotifiedAt, lastNotifiedPrice: alert.lastNotifiedPrice === null ? null : Number(alert.lastNotifiedPrice), product: { id: alert.product.id, name: alert.product.name, brand: alert.product.brand, image: alert.product.imageUrl, category: alert.product.category.name, offers: offerSummary(alert.product) } }; }

async function ensureProduct(productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product) throw AppError.notFound('Produto não encontrado.', 'PRODUCT_NOT_FOUND');
}
async function ownedWishlist(userId: string, id: string) {
  const wishlist = await prisma.wishlist.findFirst({ where: { id, userId, deletedAt: null }, include: { items: { include: { ...productInclude, priceAlert: true } } } });
  if (!wishlist) throw AppError.notFound('Lista não encontrada.', 'WISHLIST_NOT_FOUND');
  return wishlist;
}

export async function listWishlists(userId: string) { const rows = await prisma.wishlist.findMany({ where: { userId, deletedAt: null }, include: { items: { include: { ...productInclude, priceAlert: true } } }, orderBy: { updatedAt: 'desc' } }); return rows.map(serializeWishlist); }
export async function createWishlist(userId: string, data: { name: string; description?: string }) { const row = await prisma.wishlist.create({ data: { userId, name: data.name, description: data.description }, include: { items: { include: { ...productInclude, priceAlert: true } } } }); return serializeWishlist(row); }
export async function updateWishlist(userId: string, id: string, data: { name?: string; description?: string }) { await ownedWishlist(userId, id); const row = await prisma.wishlist.update({ where: { id }, data, include: { items: { include: { ...productInclude, priceAlert: true } } } }); return serializeWishlist(row); }
export async function deleteWishlist(userId: string, id: string) { await ownedWishlist(userId, id); await prisma.wishlist.update({ where: { id }, data: { deletedAt: new Date() } }); }

export async function addWishlistItem(userId: string, wishlistId: string, data: { productId: string; quantity: number; notes?: string; targetPrice?: number }) {
  await ownedWishlist(userId, wishlistId); await ensureProduct(data.productId);
  const row = await prisma.wishlistItem.upsert({ where: { wishlistId_productId: { wishlistId, productId: data.productId } }, create: { wishlistId, productId: data.productId, quantity: data.quantity, notes: data.notes }, update: { quantity: data.quantity, notes: data.notes } });
  if (data.targetPrice !== undefined) await prisma.priceAlert.upsert({ where: { userId_productId: { userId, productId: data.productId } }, create: { userId, productId: data.productId, wishlistItemId: row.id, targetPrice: new Prisma.Decimal(data.targetPrice) }, update: { wishlistItemId: row.id, targetPrice: new Prisma.Decimal(data.targetPrice), isActive: true } });
  return getWishlistItem(userId, wishlistId, data.productId);
}
export async function updateWishlistItem(userId: string, wishlistId: string, productId: string, data: { quantity?: number; notes?: string; targetPrice?: number }) { await ownedWishlist(userId, wishlistId); const item = await prisma.wishlistItem.findUnique({ where: { wishlistId_productId: { wishlistId, productId } } }); if (!item) throw AppError.notFound('Item não encontrado.', 'WISHLIST_ITEM_NOT_FOUND'); await prisma.wishlistItem.update({ where: { id: item.id }, data: { quantity: data.quantity, notes: data.notes } }); if (data.targetPrice !== undefined) await prisma.priceAlert.upsert({ where: { userId_productId: { userId, productId } }, create: { userId, productId, wishlistItemId: item.id, targetPrice: new Prisma.Decimal(data.targetPrice) }, update: { targetPrice: new Prisma.Decimal(data.targetPrice), isActive: true } }); return getWishlistItem(userId, wishlistId, productId); }
async function getWishlistItem(userId: string, wishlistId: string, productId: string) { const list = await ownedWishlist(userId, wishlistId); const item = list.items.find((candidate: any) => candidate.productId === productId); if (!item) throw AppError.notFound('Item não encontrado.', 'WISHLIST_ITEM_NOT_FOUND'); return { id: item.id, productId: item.productId, quantity: item.quantity, notes: item.notes, targetPrice: item.priceAlert ? Number(item.priceAlert.targetPrice) : null, product: { id: item.product.id, name: item.product.name, brand: item.product.brand, category: item.product.category.name, image: item.product.imageUrl, offers: offerSummary(item.product) } }; }
export async function removeWishlistItem(userId: string, wishlistId: string, productId: string) { await ownedWishlist(userId, wishlistId); const item = await prisma.wishlistItem.findUnique({ where: { wishlistId_productId: { wishlistId, productId } } }); if (!item) throw AppError.notFound('Item não encontrado.', 'WISHLIST_ITEM_NOT_FOUND'); await prisma.$transaction([prisma.priceAlert.deleteMany({ where: { wishlistItemId: item.id } }), prisma.wishlistItem.delete({ where: { id: item.id } })]); }

const alertInclude = { product: { include: { category: true, offers: { where: { store: { isActive: true } }, include: { store: { select: { name: true } } }, orderBy: { currentPrice: 'asc' as const } } } } };
export async function listAlerts(userId: string) { const rows = await prisma.priceAlert.findMany({ where: { userId }, include: alertInclude, orderBy: { updatedAt: 'desc' } }); return rows.map(serializeAlert); }
export async function createAlert(userId: string, data: { productId: string; targetPrice: number }) { await ensureProduct(data.productId); const row = await prisma.priceAlert.upsert({ where: { userId_productId: { userId, productId: data.productId } }, create: { userId, productId: data.productId, targetPrice: new Prisma.Decimal(data.targetPrice) }, update: { targetPrice: new Prisma.Decimal(data.targetPrice), isActive: true } }); return getAlert(userId, row.id); }
export async function updateAlert(userId: string, id: string, data: { targetPrice?: number; isActive?: boolean }) { const existing = await prisma.priceAlert.findFirst({ where: { id, userId } }); if (!existing) throw AppError.notFound('Alerta não encontrado.', 'ALERT_NOT_FOUND'); const row = await prisma.priceAlert.update({ where: { id }, data: { targetPrice: data.targetPrice === undefined ? undefined : new Prisma.Decimal(data.targetPrice), isActive: data.isActive }, }); return getAlert(userId, row.id); }
export async function deleteAlert(userId: string, id: string) { const existing = await prisma.priceAlert.findFirst({ where: { id, userId } }); if (!existing) throw AppError.notFound('Alerta não encontrado.', 'ALERT_NOT_FOUND'); await prisma.priceAlert.delete({ where: { id } }); }
async function getAlert(userId: string, id: string) { const row = await prisma.priceAlert.findFirst({ where: { id, userId }, include: alertInclude }); if (!row) throw AppError.notFound('Alerta não encontrado.', 'ALERT_NOT_FOUND'); return serializeAlert(row); }
