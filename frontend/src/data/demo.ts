export type Category = 'Todos' | 'Placas de vídeo' | 'Processadores' | 'Memória RAM' | 'Placas-mãe';

export interface Offer {
  store: string;
  price: number;
  previousPrice?: number;
  url: string;
  stock: boolean;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Exclude<Category, 'Todos'>;
  image: string;
  specs: Record<string, string>;
  offers: Offer[];
  history: { date: string; price: number | null }[];
}

export interface WishlistItem {
  productId: string;
  targetPrice: number;
  quantity: number;
}

export interface Wishlist {
  id: string;
  name: string;
  description: string;
  items: WishlistItem[];
}

export interface PriceAlert {
  id: string;
  productId: string;
  targetPrice: number;
  active: boolean;
  lastNotifiedAt?: string;
}

const makeHistory = (values: Array<number | null>) => values.map((price, index) => ({ date: `0${index + 1}/11`, price }));

export const demoProducts: Product[] = [
  {
    id: 'rtx-4060-ti',
    name: 'GeForce RTX 4060 Ti 8GB Dual OC',
    brand: 'ASUS',
    category: 'Placas de vídeo',
    image: 'GPU',
    specs: { VRAM: '8 GB GDDR6', Interface: '128-bit', Boost: '2595 MHz', TDP: '160 W' },
    offers: [
      { store: 'KaBuM!', price: 2_349.9, previousPrice: 2_499.9, url: '#kabum', stock: true },
      { store: 'Pichau', price: 2_399.0, url: '#pichau', stock: true },
      { store: 'Terabyte', price: 2_489.9, url: '#terabyte', stock: true },
    ],
    history: makeHistory([2_699, 2_599, 2_649, null, 2_499, 2_449, 2_349.9]),
  },
  {
    id: 'ryzen-7-7800x3d',
    name: 'Ryzen 7 7800X3D 4.2GHz',
    brand: 'AMD',
    category: 'Processadores',
    image: 'CPU',
    specs: { Núcleos: '8 / 16 threads', Socket: 'AM5', Cache: '96 MB', TDP: '120 W' },
    offers: [
      { store: 'Pichau', price: 2_199.9, previousPrice: 2_399.9, url: '#pichau', stock: true },
      { store: 'KaBuM!', price: 2_279.9, url: '#kabum', stock: true },
      { store: 'Terabyte', price: 2_399.0, url: '#terabyte', stock: false },
    ],
    history: makeHistory([2_499, 2_449, 2_399, 2_349, 2_299, null, 2_199.9]),
  },
  {
    id: 'kingston-fury-32gb',
    name: 'Memória Fury Beast 32GB DDR5 6000MHz',
    brand: 'Kingston',
    category: 'Memória RAM',
    image: 'RAM',
    specs: { Capacidade: '32 GB (2x16 GB)', Velocidade: '6000 MT/s', Latência: 'CL36', Perfil: 'EXPO' },
    offers: [
      { store: 'Terabyte', price: 769.9, previousPrice: 829.9, url: '#terabyte', stock: true },
      { store: 'KaBuM!', price: 799.9, url: '#kabum', stock: true },
      { store: 'Pichau', price: 849.9, url: '#pichau', stock: true },
    ],
    history: makeHistory([899, 859, 829.9, 819, 799, 799.9, 769.9]),
  },
  {
    id: 'b650m-pro-rs',
    name: 'B650M Pro RS WiFi',
    brand: 'ASRock',
    category: 'Placas-mãe',
    image: 'MB',
    specs: { Socket: 'AM5', Chipset: 'B650', Memória: 'DDR5 até 7200+', Formato: 'mATX' },
    offers: [
      { store: 'KaBuM!', price: 1_149.9, previousPrice: 1_299.9, url: '#kabum', stock: true },
      { store: 'Pichau', price: 1_199.9, url: '#pichau', stock: true },
      { store: 'Terabyte', price: 1_249.9, url: '#terabyte', stock: false },
    ],
    history: makeHistory([1_349, 1_299, 1_299, 1_249, 1_199, null, 1_149.9]),
  },
];

export const initialWishlists: Wishlist[] = [
  { id: 'gaming-2026', name: 'PC Gamer 2026', description: 'Peças para o próximo upgrade', items: [{ productId: 'rtx-4060-ti', targetPrice: 2_200, quantity: 1 }, { productId: 'ryzen-7-7800x3d', targetPrice: 2_000, quantity: 1 }] },
  { id: 'setup-estudo', name: 'Setup de estudo', description: 'Upgrade silencioso e eficiente', items: [{ productId: 'kingston-fury-32gb', targetPrice: 700, quantity: 1 }] },
];

export const initialAlerts: PriceAlert[] = [
  { id: 'alert-1', productId: 'rtx-4060-ti', targetPrice: 2_200, active: true, lastNotifiedAt: '2026-11-04' },
  { id: 'alert-2', productId: 'kingston-fury-32gb', targetPrice: 700, active: true },
];

export const categories: Category[] = ['Todos', 'Placas de vídeo', 'Processadores', 'Memória RAM', 'Placas-mãe'];
