import type {
  AppView,
  MenuItem,
  Order,
  OrderItem,
  RestaurantSettings,
  TableOccupancyInfo,
} from '../types/restaurant';

export const DEFAULT_SETTINGS: RestaurantSettings = {
  restaurantName: 'Lazira Restaurant',
  upiId: 'gadhavidiven34@oksbi',
  totalTables: 6,
  adminPin: '1234',
};

export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  {
    id: 'item-masala-tea',
    name: 'Masala Adrak Tea',
    price: 50,
    isVeg: true,
    prepTimeMins: 5,
    image: '/src/assets/images/menu_masala_tea_1794995111975.jpg',
  },
  {
    id: 'item-coffee',
    name: 'Coffee',
    price: 70,
    isVeg: true,
    prepTimeMins: 5,
    image: '/src/assets/images/menu_coffee_1794995111455.jpg',
  },
  {
    id: 'item-milk',
    name: 'Milk',
    price: 70,
    isVeg: true,
    prepTimeMins: 5,
    image: '/src/assets/images/menu_milk_1794995112739.jpg',
  },
  {
    id: 'item-pizza',
    name: 'Pizza',
    price: 100,
    isVeg: true,
    prepTimeMins: 15,
    image: '/src/assets/images/menu_pizza_1794995113477.jpg',
  },
  {
    id: 'item-cake',
    name: 'Cake',
    price: 200,
    isVeg: true,
    prepTimeMins: 10,
    image: '/src/assets/images/menu_cake_1794995112490.jpg',
  },
  {
    id: 'item-chocolate',
    name: 'Chocolate',
    price: 30,
    isVeg: true,
    prepTimeMins: 2,
    image: '/src/assets/images/menu_chocolate_1794995113472.jpg',
  },
];

export function parseRoute(
  pathname: string,
  totalTables = 6,
  search = '',
  hash = ''
): { view: AppView; tableNumber: number } {
  // Check query parameter ?table=X first (prevents 404 on static/deployed hosts)
  if (search) {
    const params = new URLSearchParams(search);
    const tableParam = params.get('table');
    if (tableParam && /^\d+$/.test(tableParam.trim())) {
      const parsed = Number.parseInt(tableParam.trim(), 10);
      const clamped = Math.min(Math.max(parsed, 1), totalTables);
      return { view: 'customer', tableNumber: clamped };
    }
  }

  // Check hash routing (#table=X or #/table/X)
  if (hash) {
    const hashMatch = hash.match(/table[=/](\d+)/i);
    if (hashMatch) {
      const parsed = Number.parseInt(hashMatch[1], 10);
      const clamped = Math.min(Math.max(parsed, 1), totalTables);
      return { view: 'customer', tableNumber: clamped };
    }
  }

  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  if (cleanPath === '/kitchen') {
    return { view: 'kitchen', tableNumber: 1 };
  }
  if (cleanPath === '/reception') {
    return { view: 'reception', tableNumber: 1 };
  }
  if (cleanPath === '/table-qrs') {
    return { view: 'table-qrs', tableNumber: 1 };
  }
  if (cleanPath === '/admin') {
    return { view: 'admin', tableNumber: 1 };
  }

  const tableMatch = cleanPath.match(/^\/table\/(\d+)$/);
  if (tableMatch) {
    const parsed = Number.parseInt(tableMatch[1], 10);
    const clamped = Math.min(Math.max(parsed, 1), totalTables);
    return { view: 'customer', tableNumber: clamped };
  }

  return { view: 'customer', tableNumber: 1 };
}

export function isCustomerOnlyUrl(
  pathname: string,
  search = '',
  hash = ''
): boolean {
  if (search) {
    const params = new URLSearchParams(search);
    const tableParam = params.get('table');
    if (tableParam && /^\d+$/.test(tableParam.trim())) {
      return true;
    }
  }
  if (hash && /table[=/]\d+/i.test(hash)) {
    return true;
  }
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  return /^\/table\/\d+$/i.test(cleanPath);
}

export function getDefaultLiveBaseUrl(origin: string, pathname: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const strippedPath = pathname
    .replace(/\/(table\/\d+|kitchen|reception|table-qrs|admin)\/?$/i, '')
    .replace(/\/+$/, '');
  return strippedPath ? `${cleanOrigin}${strippedPath}` : `${cleanOrigin}/`;
}

export function buildTableQrUrl(baseUrl: string, tableNumber: number): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return `?table=${tableNumber}`;
  }
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    url.searchParams.set('table', String(tableNumber));
    return url.toString();
  } catch {
    const sep = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${sep}table=${tableNumber}`;
  }
}

export function getRoutePath(view: AppView, tableNumber = 1): string {
  switch (view) {
    case 'kitchen':
      return '/kitchen';
    case 'reception':
      return '/reception';
    case 'table-qrs':
      return '/table-qrs';
    case 'admin':
      return '/admin';
    case 'customer':
    default:
      return `/table/${tableNumber}`;
  }
}

export interface CartSummary {
  totalItems: number;
  totalAmount: number;
  estimatedPrepMins: number;
  lineItems: OrderItem[];
}

export function calculateCartSummary(
  cart: Record<string, number>,
  menu: MenuItem[]
): CartSummary {
  const menuById = new Map(menu.map((item) => [item.id, item]));
  const lineItems: OrderItem[] = [];
  let totalItems = 0;
  let totalAmount = 0;
  let estimatedPrepMins = 0;

  for (const [menuItemId, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = menuById.get(menuItemId);
    if (!item) continue;

    lineItems.push({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: qty,
      prepTimeMins: item.prepTimeMins,
    });
    totalItems += qty;
    totalAmount += item.price * qty;
    if (item.prepTimeMins > estimatedPrepMins) {
      estimatedPrepMins = item.prepTimeMins;
    }
  }

  return {
    totalItems,
    totalAmount,
    estimatedPrepMins,
    lineItems,
  };
}

export type UpiAppId = 'gpay' | 'phonepe' | 'paytm';

const UPI_APP_PACKAGES: Record<UpiAppId, string> = {
  gpay: 'com.google.android.apps.nbu.paisa.user',
  phonepe: 'com.phonepe.app',
  paytm: 'net.one97.paytm',
};

export function buildAppUpiUri(
  app: UpiAppId,
  upiId: string,
  restaurantName: string,
  amount: number
): string {
  const cleanUpi = upiId.trim();
  const encodedName = encodeURIComponent(restaurantName.trim());
  const formattedAmount = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2);
  const query = `pa=${cleanUpi}&pn=${encodedName}&am=${formattedAmount}&cu=INR`;
  const pkg = UPI_APP_PACKAGES[app];
  return `intent://pay?${query}#Intent;scheme=upi;package=${pkg};end`;
}

export function buildUpiUri(
  upiId: string,
  restaurantName: string,
  amount: number
): string {
  const cleanUpi = upiId.trim();
  const encodedName = encodeURIComponent(restaurantName.trim());
  const formattedAmount = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2);
  return `upi://pay?pa=${cleanUpi}&pn=${encodedName}&am=${formattedAmount}&cu=INR`;
}

export function computeRemainingSeconds(order: Order, nowMs: number): number {
  if (order.status === 'ready' || order.status === 'completed') {
    return 0;
  }
  const targetMs = order.createdAt + order.estimatedPrepMins * 60 * 1000;
  const diffSecs = Math.ceil((targetMs - nowMs) / 1000);
  return Math.max(0, diffSecs);
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function getTableOccupancy(
  orders: Order[],
  totalTables: number
): TableOccupancyInfo[] {
  const result: TableOccupancyInfo[] = [];

  for (let t = 1; t <= totalTables; t += 1) {
    const tableOrders = orders
      .filter((o) => o.tableNumber === t)
      .sort((a, b) => b.createdAt - a.createdAt);

    // A table is occupied if it has any order that is not yet both completed & paid
    const activeOrders = tableOrders.filter(
      (o) => o.status !== 'completed' || o.paymentStatus !== 'paid'
    );

    const unpaidOrdersCount = activeOrders.filter(
      (o) => o.paymentStatus !== 'paid'
    ).length;

    const totalActiveAmount = activeOrders.reduce(
      (sum, o) => sum + o.totalAmount,
      0
    );

    result.push({
      tableNumber: t,
      isOccupied: activeOrders.length > 0,
      activeOrders,
      unpaidOrdersCount,
      totalActiveAmount,
      latestOrder: activeOrders[0] ?? tableOrders[0] ?? null,
    });
  }

  return result;
}

export function getNextOrderNumber(existingOrders: Order[]): string {
  const nextNum = existingOrders.length + 101;
  return `ORD-${nextNum}`;
}

export function getLocalDateKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface RevenueFilterOptions {
  date?: string;
  tableNumber?: number | 'all';
}

export function filterCompletedOrders(
  orders: Order[],
  filters: RevenueFilterOptions = {}
): Order[] {
  return orders
    .filter((order) => {
      if (order.status !== 'completed') return false;
      if (
        filters.tableNumber !== undefined &&
        filters.tableNumber !== 'all' &&
        order.tableNumber !== filters.tableNumber
      ) {
        return false;
      }
      if (filters.date) {
        const orderDateKey = getLocalDateKey(order.paidAt ?? order.createdAt);
        if (orderDateKey !== filters.date) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt));
}

export interface RevenueSummary {
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
  upiSales: number;
  cashSales: number;
}

export function calculateRevenueSummary(
  completedOrders: Order[]
): RevenueSummary {
  let totalSales = 0;
  let upiSales = 0;
  let cashSales = 0;

  for (const order of completedOrders) {
    totalSales += order.totalAmount;
    if (order.paymentMethod === 'upi') {
      upiSales += order.totalAmount;
    } else if (order.paymentMethod === 'cash') {
      cashSales += order.totalAmount;
    }
  }

  const orderCount = completedOrders.length;
  const averageOrderValue =
    orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

  return {
    totalSales,
    orderCount,
    averageOrderValue,
    upiSales,
    cashSales,
  };
}

export function getTablePaidOrderHistory(
  orders: Order[],
  tableNumber: number
): Order[] {
  return orders
    .filter(
      (order) =>
        order.tableNumber === tableNumber && order.paymentStatus === 'paid'
    )
    .sort((a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt));
}

export function parseIfStorageChanged<T>(
  prevRaw: string | null,
  nextRaw: string | null
): { changed: boolean; value: T | null } {
  if (!nextRaw || nextRaw === prevRaw) {
    return { changed: false, value: null };
  }
  try {
    return { changed: true, value: JSON.parse(nextRaw) as T };
  } catch {
    return { changed: false, value: null };
  }
}


