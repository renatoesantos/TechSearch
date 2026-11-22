import { demoProducts, initialAlerts, initialWishlists, type PriceAlert, type Product, type Wishlist } from '../data/demo';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'techsearch_token';
const WISHLIST_KEY = 'techsearch_wishlists';
const ALERT_KEY = 'techsearch_alerts';

export const isDemoMode = !API_URL;

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') as T; } catch { return fallback; }
}
function save<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }

export async function getProducts(): Promise<Product[]> {
  if (isDemoMode) return demoProducts;
  const response = await fetch(`${API_URL}/products`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Não foi possível carregar os produtos.');
  const payload = await response.json() as { items: Product[] };
  return payload.items;
}

export async function getProduct(id: string): Promise<Product> {
  if (isDemoMode) {
    const product = demoProducts.find((item) => item.id === id);
    if (!product) throw new Error('Produto não encontrado.');
    return product;
  }
  const response = await fetch(`${API_URL}/products/${id}`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Não foi possível carregar o produto.');
  return response.json();
}

export async function getWishlists(): Promise<Wishlist[]> {
  if (isDemoMode) return load(WISHLIST_KEY, initialWishlists);
  const response = await fetch(`${API_URL}/wishlists`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Não foi possível carregar suas listas.');
  return response.json();
}

export async function getAlerts(): Promise<PriceAlert[]> {
  if (isDemoMode) return load(ALERT_KEY, initialAlerts);
  const response = await fetch(`${API_URL}/alerts`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Não foi possível carregar seus alertas.');
  return response.json();
}

export async function persistWishlists(value: Wishlist[]) { if (isDemoMode) save(WISHLIST_KEY, value); }
export async function persistAlerts(value: PriceAlert[]) {
  if (isDemoMode) { save(ALERT_KEY, value); return; }
  for (const alert of value) {
    const body = { productId: alert.productId, targetPrice: alert.targetPrice };
    if (alert.id.startsWith('alert-')) {
      await fetch(`${API_URL}/alerts`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    } else {
      await fetch(`${API_URL}/alerts/${alert.id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ targetPrice: alert.targetPrice, isActive: alert.active }) });
    }
  }
}

export async function createWishlist(
  name: string,
  description?: string
) {
  const response = await fetch(`${API_URL}/wishlists`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, description }),
  });

  if (!response.ok) {
    throw new Error('Erro ao criar lista.');
  }

  return response.json();
}

export async function addWishlistItem(
  wishlistId: string,
  productId: string,
  quantity = 1,
  targetPrice?: number
) {
  const response = await fetch(
    `${API_URL}/wishlists/${wishlistId}/items`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        productId,
        quantity,
        targetPrice,
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao adicionar produto.');
  }

  return response.json();
}

export async function removeWishlistItem(
  wishlistId: string,
  productId: string
) {
  const response = await fetch(
    `${API_URL}/wishlists/${wishlistId}/items/${productId}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao remover produto.');
  }
}

export async function deleteAccount() {
  if (isDemoMode) { clearToken(); localStorage.clear(); return; }
  const response = await fetch(`${API_URL}/profile`, { method: 'DELETE', headers: authHeaders() });
  if (!response.ok) throw new Error('Não foi possível excluir a conta.');
  clearToken();
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('E-mail ou senha inválidos.');
  }

  const data = await response.json();

  setToken(data.token);

  return data;
}

export async function register(
  name: string,
  email: string,
  password: string
) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    throw new Error('Não foi possível criar sua conta.');
  }

  const data = await response.json();

  setToken(data.token);

  return data;
}

export async function logout() {
  const token = getToken();

  if (token) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: authHeaders(),
    });
  }

  clearToken();
}
